"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { Match, MatchPlayer, Circuit, CircuitTie } from "@/lib/match-schema";
import { getSummonEmailTemplate, getMatchStartEmailTemplate } from "@/lib/mail-templates";
import { sendTacticalEmail } from "@/lib/mail";
import { getVerifiedUid, getVerifiedIdentity, getVerifiedAdminUid } from "@/lib/server-utils";
import { sanitize } from "@/lib/validation-utils";
import { checkRateLimit } from "@/lib/rate-limiter";
import { createNotificationInternal } from "@/lib/notifications";
import { 
   handleKnockoutAdvancement,
   distributeCircuitPrizes
} from "@/lib/match-engine/progression";
import { 
   initializeCircuit 
} from "@/lib/match-engine/initialization";
import { 
   handlePromoAdvancement 
} from "@/lib/match-engine/promo-engine";
import { 
   resolveTechnicalWin, 
   validateAbsoluteVictory,
   resolveDoubleNoShow
} from "@/lib/match-engine/validation";
import { EngineMatch, EngineCircuit, EnginePlayer } from "@/lib/match-engine/types";
import { purgeMatchDataInternal, purgeMatchMessagesOnly } from "@/lib/match-cleanup";
import { cleanupTournamentData } from "@/lib/cleanup-utils";

// PHASE 2: Security enhancements (optional, non-breaking)
import { 
   validateCompleteProof, 
   ValidatedGameProof,
   isProofRecent,
   SignedGameProof 
} from "@/lib/game-proof";
import { 
   shouldRecordMatch, 
   initializeMatchRecording,
   finalizeMatchRecording,
   verifyMatchRecording 
} from "@/lib/match-recording";
import { 
   analyzeMatchForFraud 
} from "@/lib/fraud-detection";

/**
 * SHARED HELPER: Dispatch In-App Notifications for Match Resolution
 * Ensures consistent messaging across all resolution paths (Admin, Consensus, Auto-Nuke)
 */
async function dispatchMatchResolutionNotifications(matchId: string, status: string, championUid?: string | null) {
  try {
     const closedSnap = await adminDb.collection("matches").doc(matchId).get();
     if (!closedSnap.exists) return;
     const closedData = closedSnap.data() as Match;
     
     // Handle DISPUTED matches
     if (status === 'DISPUTED' || closedData?.status === 'DISPUTED') {
        const gameLabel = `${closedData.game} ${closedData.format.toUpperCase()}`;
        for (const pid of Object.keys(closedData.players)) {
           await createNotificationInternal(
              pid,
              "⚖️ Match Under Review",
              `Your ${gameLabel} match has conflicting results and is now under tribunal review.`,
              "DISPUTE"
           );
        }
     }
     
     // Handle CLOSED matches (agreed results)
     const finalChampion = championUid || closedData.championUid;
     if ((status === 'CLOSED' || closedData?.status === 'CLOSED') && finalChampion) {
        const reward = closedData.rewardAmount || 0;
        const gameLabel = `${closedData.game} ${closedData.format.toUpperCase()}`;

        for (const pid of Object.keys(closedData.players)) {
           if (pid === finalChampion) {
              await createNotificationInternal(
                 pid,
                 "🏆 Victory Confirmed",
                 `You won the ${gameLabel} match! ${reward > 0 ? `${reward} CR credited.` : 'Points updated.'}`,
                 "MATCH"
              );
           } else {
              await createNotificationInternal(
                 pid,
                 "Combat Result: Defeat",
                 `Your ${gameLabel} match resolved. Opponent victory verified.`,
                 "MATCH"
              );
           }
        }
     }
  } catch (notifError) {
     console.warn("[MatchAction] Post-match notification error:", notifError);
  }
}

/**
 * INTERNAL HELPER: The Finalization Sequence
 * Handles payouts, standings updates, and knockout advancement.
 * MUST be called within a transaction.
 */
export async function internalFinalizeMatchClosure(
  transaction: admin.firestore.Transaction,
  matchRef: admin.firestore.DocumentReference,
  matchData: Match,
  championUid: string,
  operatorUid: string, // Who triggered it (Admin or Player)
  circuitData?: any, // Pass circuit data if already fetched
  overridePlayers?: Record<string, any> // fresh submission data to avoid stale doc reads
): Promise<{ needsTournamentCleanup: boolean; circuitId?: string }> {
  // 1.0 FINANCIAL CALCULATIONS (DYNAMIC SCALING)
  const actualPlayers = matchData.playerIds?.length || 2;
  const totalStake = matchData.challengeFee * actualPlayers;
  const platformRake = Math.floor(totalStake * 0.20);
  let victoryReward = matchData.circuitId ? 0 : (totalStake - platformRake);

  // HARDENING: One-off Promo matches (like CODM BR) that aren't part of a circuit
  if (matchData.isPromo && !matchData.circuitId && !victoryReward) {
     const prizeUSD = (matchData as any).prizeUSD || 0;
     victoryReward = prizeUSD * 100; // $1.00 USD = 100 Coins platform standard
  }

  let needsTournamentCleanup = false;
  let tournamentCleanupCircuitId: string | null = null;

  transaction.update(matchRef, {
    status: 'CLOSED',
    rewardAmount: victoryReward,
    resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    championUid,
    isPromo: !!matchData.isPromo || !!circuitData?.isPromo,
    round: matchData.round || 'NONE'
  });

  // 1. Update Core Profile Stats (Universal for all match types)
  const playerIds = Object.keys(matchData.players);
  const gameKey = matchData.game; // 'CODM' or 'EFOOTBALL'

  for (const pid of playerIds) {
    const userRef = adminDb.collection("users").doc(pid);
    const isWinner = pid === championUid;
    // CRITICAL: use overridePlayers if available, otherwise fallback to doc state
    const playerMatchData = (overridePlayers?.[pid] || matchData.players[pid] || {}) as any;

    const statsUpdate: any = {
      totalMatches: admin.firestore.FieldValue.increment(1),
      ...(isWinner && { totalWins: admin.firestore.FieldValue.increment(1) })
    };

    if (gameKey === 'EFOOTBALL') {
      statsUpdate[`stats.EFOOTBALL.matches`] = admin.firestore.FieldValue.increment(1);
      statsUpdate[`stats.EFOOTBALL.goalsFor`] = admin.firestore.FieldValue.increment(playerMatchData.scoreFor || 0);
      statsUpdate[`stats.EFOOTBALL.goalsAgainst`] = admin.firestore.FieldValue.increment(playerMatchData.scoreAgainst || 0);
      if (isWinner) statsUpdate[`stats.EFOOTBALL.wins`] = admin.firestore.FieldValue.increment(1);
    } else if (gameKey === 'CODM') {
      statsUpdate[`stats.CODM.matches`] = admin.firestore.FieldValue.increment(1);
      statsUpdate[`stats.CODM.kills`] = admin.firestore.FieldValue.increment(playerMatchData.kills || 0);
      if (isWinner) statsUpdate[`stats.CODM.wins`] = admin.firestore.FieldValue.increment(1);
    }
    transaction.update(userRef, statsUpdate);
  }

  // 1.8 PARTNER COMMISSION ENGINE
  let partnerCommissionPaid = 0;
  try {
    // A. [CREATOR COMMISSION] If this is a Partner Lobby, the Creator gets the Partner Share of the Rake
    if (matchData.isPartnerTournament && matchData.creatorId) {
      const creatorRef = adminDb.collection("users").doc(matchData.creatorId);
      const creatorSnap = await transaction.get(creatorRef);
      
      if (creatorSnap.exists) {
        const creatorData = creatorSnap.data()!;
        const expiryDate = creatorData.partnerExpiresAt?.seconds ? new Date(creatorData.partnerExpiresAt.seconds * 1000) : null;
        
        // 🔒 [CONTRACT CHECK] Only pay if Partner Contract is active
        if (creatorData.role === 'PARTNER' && expiryDate && expiryDate > new Date()) {
          partnerCommissionPaid = Math.floor(platformRake * 0.50);
          if (partnerCommissionPaid > 0) {
            transaction.update(creatorRef, {
              balanceCoins: admin.firestore.FieldValue.increment(partnerCommissionPaid)
            });
            
            const partLogRef = adminDb.collection("transactions").doc();
            transaction.set(partLogRef, {
              uid: matchData.creatorId,
              type: "CREDIT",
              category: "PARTNER_COMMISSION",
              description: `Lobby Creator Commission: ${matchData.game} ${matchData.format}`,
              amount: partnerCommissionPaid,
              status: "COMPLETED",
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        } else {
          console.log(`[Commission] Creator ${matchData.creatorId} contract expired or invalid. Rake reverts to platform.`);
        }
      }
    } 
    // B. [RECRUIT COMMISSION] Otherwise, check for referrers (Influencer Recruits)
    else {
      const playerUsers = await transaction.getAll(...playerIds.map(pid => adminDb.collection("users").doc(pid)));
      
      for (const userSnap of playerUsers) {
        if (!userSnap.exists) continue;
        const profile = userSnap.data()!;
        const referrerUid = profile.referredBy;
        
        if (referrerUid) {
          const referrerRef = adminDb.collection("users").doc(referrerUid);
          const referrerSnap = await transaction.get(referrerRef);
          
          if (referrerSnap.exists) {
            const referrerData = referrerSnap.data()!;
            const expiryDate = referrerData.partnerExpiresAt?.seconds ? new Date(referrerData.partnerExpiresAt.seconds * 1000) : null;
            
            // 🔒 [LIFECYCLE CHECK] Verify the recruit's account is < 90 days old
            const accountAgeMs = Date.now() - new Date(profile.createdAt).getTime();
            const isEligible = accountAgeMs < (90 * 24 * 60 * 60 * 1000);

            // 🔒 [CONTRACT CHECK] Only pay if Influencer's Contract is active AND recruit is eligible
            if (referrerData.role === 'PARTNER' && expiryDate && expiryDate > new Date() && isEligible) {
              const rakePerPlayer = Math.floor(matchData.challengeFee * 0.20);
              const commission = Math.floor(rakePerPlayer * 0.50); 
              
              if (commission > 0) {
                partnerCommissionPaid += commission;
                transaction.update(referrerRef, {
                  balanceCoins: admin.firestore.FieldValue.increment(commission)
                });
                
                const commLogRef = adminDb.collection("transactions").doc();
                transaction.set(commLogRef, {
                  uid: referrerUid,
                  type: "CREDIT",
                  category: "PARTNER_COMMISSION",
                  description: `Recruit Commission: ${profile.username} @ ${matchData.game}`,
                  amount: commission,
                  status: "COMPLETED",
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
                });
              }
            } else {
               console.log(`[Commission] Referrer ${referrerUid} contract expired. Rake reverts to platform.`);
            }
          }
        }
      }
    }
  } catch (commError) {
    console.error("[MatchAction] Partner Commission error:", commError);
  }

  // 2. Payout Winner & Track Platform Finances
  if (!matchData.circuitId && victoryReward > 0) {
    const winnerRef = adminDb.collection("users").doc(championUid);
    transaction.update(winnerRef, {
      balanceCoins: admin.firestore.FieldValue.increment(victoryReward)
    });

    const prizeLogRef = adminDb.collection("transactions").doc();
    transaction.set(prizeLogRef, {
      uid: championUid,
      type: "CREDIT",
      category: "MATCH_PRIZE",
      description: `1ST PLACE WINNER: ${matchData.game} ${matchData.format}`,
      amount: victoryReward,
      status: "COMPLETED",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const finalPlatformCut = platformRake - partnerCommissionPaid;
    const statsRef = adminDb.collection("stats").doc("platform_finances");
    transaction.set(statsRef, {
      totalPayouts: admin.firestore.FieldValue.increment(victoryReward + partnerCommissionPaid),
      totalPlatformCut: admin.firestore.FieldValue.increment(finalPlatformCut),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }

  // 2. Circuit Logic (Standings/Advancement)
  if (matchData.circuitId && circuitData) {
    const circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
      
    // Group Standings
    if (matchData.group) {
      const g = matchData.group;
      const playersList = Object.values(matchData.players) as any[];
      const winner = playersList.find(p => p.uid === championUid);
      const loser = playersList.find(p => p.uid !== championUid);

      if (winner && loser && circuitData.groups?.[g]) {
        const winnerSF = (winner.scoreFor ?? winner.kills ?? 0);
        const loserSF = (loser.scoreFor ?? loser.kills ?? 0);
        
        transaction.update(circuitRef, {
          matchesCompleted: admin.firestore.FieldValue.increment(1),
          [`groups.${g}.standings.${winner.uid}.played`]: admin.firestore.FieldValue.increment(1),
          [`groups.${g}.standings.${winner.uid}.wins`]: admin.firestore.FieldValue.increment(1),
          [`groups.${g}.standings.${winner.uid}.pts`]: admin.firestore.FieldValue.increment(3),
          [`groups.${g}.standings.${winner.uid}.gf`]: admin.firestore.FieldValue.increment(winnerSF),
          [`groups.${g}.standings.${winner.uid}.ga`]: admin.firestore.FieldValue.increment(loserSF),
          [`groups.${g}.standings.${loser.uid}.played`]: admin.firestore.FieldValue.increment(1),
          [`groups.${g}.standings.${loser.uid}.losses`]: admin.firestore.FieldValue.increment(1),
          [`groups.${g}.standings.${loser.uid}.gf`]: admin.firestore.FieldValue.increment(loserSF),
          [`groups.${g}.standings.${loser.uid}.ga`]: admin.firestore.FieldValue.increment(winnerSF),
        });
      }
    } 
    
    // Knockout Advancement
    else if (matchData.round) {
      if (circuitData.isPromo) {
         // --- PROMO ENGINE REDIRECT ---
         const finalizeResult = await handlePromoAdvancement(transaction, circuitRef, circuitData, matchData.round, championUid, matchRef.id, operatorUid, matchData.game);
         if (finalizeResult?.needsTournamentCleanup) {
            needsTournamentCleanup = true;
            tournamentCleanupCircuitId = matchData.circuitId;
         }
      } else if (matchData.round === 'QR1') {
         await handleKnockoutAdvancement(transaction, circuitRef, circuitData, 'QR1', -1, championUid, matchRef.id, operatorUid, matchData.game);
      } else {
         const roundKey = matchData.round.includes('QF') ? 'quarters' : (matchData.round.includes('SF') ? 'semis' : 'final');
         const ties = roundKey === 'final' ? [circuitData.bracket?.final] : circuitData.bracket?.[roundKey];
         let tieIdx = -1;
         let p1G = 0;
         let p2G = 0;
         
         if (ties && Array.isArray(ties)) {
            tieIdx = (ties as any[]).findIndex(t => t?.matchId1 === matchRef.id || t?.matchId2 === matchRef.id || (t as any)?.matchId3 === matchRef.id);
            if (tieIdx !== -1) {
               const tie = (ties as any[])[tieIdx];
               p1G = matchData.players[tie.p1]?.scoreFor ?? matchData.players[tie.p1]?.kills ?? 0;
               p2G = matchData.players[tie.p2]?.scoreFor ?? matchData.players[tie.p2]?.kills ?? 0;
            }
         }

         if (matchData.round === 'FINAL' && tieIdx === -1 && !circuitData.bracket?.final?.matchId1) {
            // Legacy/Single Match Final fallback
            const runnerUpUid = Object.keys(matchData.players).find(pid => pid !== championUid);
            needsTournamentCleanup = true;
            tournamentCleanupCircuitId = matchData.circuitId;
            await distributeCircuitPrizes(transaction, circuitRef, circuitData, championUid, runnerUpUid || null);
         } else {
            if (matchData.round === 'FINAL') {
               needsTournamentCleanup = true;
               tournamentCleanupCircuitId = matchData.circuitId;
            }
            await handleKnockoutAdvancement(transaction, circuitRef, circuitData, matchData.round, tieIdx, championUid, matchRef.id, operatorUid, matchData.game, p1G, p2G);
         }
      }
    }
  }

  return {
    needsTournamentCleanup,
    circuitId: tournamentCleanupCircuitId || undefined
  };
}

/**
 * SERVER ACTION: CREATE MATCH
 */
export async function createMatchAction(
  idToken: string,
  _ignoredUsername: string,
  _ignoredAvatarId: number,
  game: 'CODM' | 'EFOOTBALL',
  format: Match['format'],
  challengeFee: number,
  inGameName: string,
  weaponClass: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' | 'NONE' = 'NONE',
  duration: '12m' | '15m' | 'NONE' = 'NONE',
  maxPlayers: number = 2,
  roomCode?: string,
  circuitId?: string,
  round?: 'QR1' | 'QR2' | 'QF' | 'SF' | 'FINAL' | 'NONE',
  group?: 'A' | 'B' | 'C' | 'D' | 'NONE',
  leg?: 1 | 2 | 3 | 'NONE'
) {
  const { uid, profile } = await getVerifiedIdentity(idToken);
  const username = profile.username || "Unknown";
  const avatarId = profile.avatarId || 1;

  if (challengeFee <= 0) throw new Error("Invalid challenge fee configuration.");

  // [PROT-TOUR-02] 🔒 Entry Fee Duplication Prevention
  // Only enforce for tournament format matches (gathering, not sub-matches)
  if (format === 'tournament' && !circuitId) {
    const existingTournaments = await adminDb
      .collection("matches")
      .where("format", "==", "tournament")
      .where("game", "==", game)
      .where("challengeFee", "==", challengeFee)
      .where("status", "in", ["WAITING", "READY"])
      .where("circuitId", "==", null)
      .get();
    
    for (const doc of existingTournaments.docs) {
      const tournament = doc.data() as any;
      const playerCount = tournament.playerIds?.length || 0;
      const maxPlayers = tournament.maxPlayers || 16;
      
      if (playerCount < maxPlayers) {
        throw new Error(
          `[BLOCKED] Tournament exists at this entry level. ` +
          `Join the existing ${game} tournament with ${playerCount}/${maxPlayers} players instead. ` +
          `Once it reaches full capacity, you can create a new tournament at this fee level.`
        );
      }
    }
  }

  // [PROT-TOUR-01] Quota Enforcement
  if (circuitId) {
     const cSnap = await adminDb.collection("circuits").doc(circuitId).get();
     if (cSnap.exists) {
        const c = cSnap.data() as EngineCircuit;
        const is16 = c.format === '16_TOURNAMENT';
        const max = is16 ? 1 : 0;
        
        if (max > 0) {
           let played = 0;
           if (is16) {
              const mSnap = await adminDb.collection("matches")
                 .where("circuitId", "==", circuitId)
                 .where("playerIds", "array-contains", uid)
                 .where("round", "==", "QR1")
                 .get();
              played = mSnap.docs.filter(d => d.data().status === 'CLOSED' || d.data().status === 'COMPLETED').length;
           }

           if (played >= max) {
              throw new Error("Operational Quota Reached. Awaiting seeding for next phase.");
           }
        }
     }
  }
  
  const userRef = adminDb.collection("users").doc(uid);
  const matchRef = adminDb.collection("matches").doc();

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User profile not found.");

      const userData = userSnap.data()!;
      if ((userData.balanceCoins || 0) < challengeFee) {
        throw new Error("Insufficient balance for this challenge fee.");
      }

      // Prepare user updates
      const userUpdates: any = {
        balanceCoins: admin.firestore.FieldValue.increment(-challengeFee),
        lifetimeWagered: admin.firestore.FieldValue.increment(challengeFee)
      };

      // Auto-save gaming name to profile if not already set (first-time input)
      const tagField = game === 'CODM' ? 'codTag' : 'efootballTag';
      if (inGameName && inGameName.trim() && !userData[tagField]) {
        userUpdates[tagField] = sanitize(inGameName);
      }

      transaction.update(userRef, userUpdates);

      const matchData: any = {
        game, format, challengeFee, status: 'WAITING',
        playerIds: [uid],
        players: { [uid]: { uid, username, avatarId, ready: false, team: 'alpha', inGameName: inGameName || "Unknown" } },
        championUid: null, creatorId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
        weaponClass: game === 'CODM' ? weaponClass : 'NONE', duration, maxPlayers,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 3 * 3600 * 1000)), // 3 hours for regular matches
      };

      if (roomCode) matchData.roomCode = roomCode;
      if (circuitId) matchData.circuitId = circuitId;
      if (round) matchData.round = round;
      if (group) matchData.group = group;
      if (leg) matchData.leg = leg;

      transaction.set(matchRef, matchData);
    });

    // PHASE 2: Initialize match recording for high-value matches (optional, non-blocking)
    try {
      if (shouldRecordMatch(challengeFee, format)) {
        await initializeMatchRecording(matchRef.id, uid, "PENDING_OPPONENT");
        console.log(`[Phase2] Match recording initialized for high-value match ${matchRef.id}`);
      }
    } catch (recordingError) {
      console.warn(`[Phase2] Failed to initialize match recording: ${recordingError}`);
      // Non-fatal - proceed without recording
    }

    return { success: true, matchId: matchRef.id };
  } catch (error: any) {
    console.error("[MatchAction] createMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: JOIN MATCH
 */
export async function joinMatchAction(
  idToken: string,
  _ignoredUsername: string,
  _ignoredAvatarId: number,
  matchId: string,
  inGameName: string,
  referralCode?: string
) {
  const { uid, profile } = await getVerifiedIdentity(idToken);
  const username = profile.username || "Unknown";
  const avatarId = profile.avatarId || 1;
  const userRef = adminDb.collection("users").doc(uid);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const matchSnap = await transaction.get(matchRef);
      if (!userSnap.exists || !matchSnap.exists) throw new Error("Document not found.");

      const userData = userSnap.data()!;
      const matchData = matchSnap.data() as Match;

      if (matchData.status !== 'WAITING') throw new Error("Arena is no longer accepting players.");
      
      // [PARTNER-OVERSEER] Allow creator to join as an observer without paying
      const isPartnerOverseer = matchData.isPartnerTournament && matchData.creatorId === uid;

      if (matchData.players[uid] && !isPartnerOverseer) throw new Error("You are already in this combat session.");

      // [PARTNER-GATE] Check referral status for influencer tournaments
      if (matchData.isPartnerTournament && !isPartnerOverseer) {
        const partnerId = matchData.creatorId;
        const isAlreadyRecruit = userData.referredBy === partnerId;

        if (!isAlreadyRecruit) {
          if (!referralCode) {
             throw new Error(`EXCLUSIVE_ACCESS: This tournament is reserved for ${matchData.partnerName || 'Partner'}'s recruits. Enter their referral code to join.`);
          }
          
          // Verify Referral Code
          const partnerSnap = await transaction.get(adminDb.collection("users").doc(partnerId));
          const partnerData = partnerSnap.data();
          if (partnerData?.myReferralCode !== referralCode) {
             throw new Error("INVALID_CODE: The referral code provided does not match this Partner's clearance.");
          }

          // [AUTO-RECRUIT] Successfully verified - link them to the partner
          transaction.update(userRef, { referredBy: partnerId });
        }
      }

      // [WHITELIST] Check for bracket matches
      if (matchData.circuitId || matchData.round) {
         if (!matchData.playerIds || !matchData.playerIds.includes(uid)) {
            throw new Error("Neural Lockdown: You are not authorized for this bracket match.");
         }
      }

      const updates: any = {};
      const userUpdates: any = {};

      if (!isPartnerOverseer) {
        // [FINANCIAL] Balance Check & Deduction
        const currentBalance = userData.balanceCoins || 0;
        if (currentBalance < matchData.challengeFee) {
          throw new Error("Insufficient balance to join this challenge.");
        }

        userUpdates.balanceCoins = admin.firestore.FieldValue.increment(-matchData.challengeFee);
        userUpdates.lifetimeWagered = admin.firestore.FieldValue.increment(matchData.challengeFee);

        // Auto-save gaming name
        const tagField = matchData.game === 'CODM' ? 'codTag' : 'efootballTag';
        if (inGameName && inGameName.trim() && !userData[tagField]) {
          userUpdates[tagField] = sanitize(inGameName);
        }

        transaction.update(userRef, userUpdates);

        // [ROSTER] Player Addition
        const playerCount = Object.keys(matchData.players).length;
        const target = matchData.maxPlayers || 2;
        if (playerCount >= target) throw new Error("Arena is full.");

        const player: MatchPlayer = {
          uid, username, avatarId, ready: false, inGameName,
          team: matchData.format === 'FFA' ? 'alpha' : (playerCount % 2 === 0 ? 'alpha' : 'bravo')
        };

        const updatedPlayersList = [...Object.values(matchData.players), player];
        updates[`players.${uid}`] = player;
        updates.playerIds = admin.firestore.FieldValue.arrayUnion(uid);

        const isFull = (playerCount + 1) >= target;
        const updatedPlayersMap = { ...matchData.players, [uid]: player };

        // [TRANSITION] Full Logic
        if (isFull && matchData.format === 'tournament' && !matchData.circuitId) {
          const circuitId = await initializeCircuit(transaction, matchRef, matchData as any as EngineMatch, updatedPlayersList as any as EnginePlayer[], uid);
          if (circuitId) {
            updates.circuitId = circuitId;
            updates.status = 'COMPLETED';
          }
        } else if (isFull) {
          updates.status = 'READY';
          // Host candidacy
          const isGatheringFormat = matchData.format === 'league' || matchData.format === 'tournament';
          if (!isGatheringFormat && !matchData.hostUid) {
            const candidate = updatedPlayersList[Math.floor(Math.random() * updatedPlayersList.length)];
            if (candidate.uid === uid) {
              updates[`players.${uid}`].isHostCandidate = true;
            } else {
              updates[`players.${candidate.uid}.isHostCandidate`] = true;
            }
          }
        }

        // [BROADCAST] Notify ALL operatives that deployment is imminent
        if (isFull) {
           const playersInRoom = Object.keys(updatedPlayersMap);
           // We need to fetch emails outside the transaction if we want to be clean, 
           // but since we are sending emails after the transaction commits (in a promise catch/then or just floating),
           // we can gather IDs here and fire them off.
           
           // HELPER: Batch notify after transaction completes
           (async () => {
              try {
                 const emails: string[] = [];
                 const playerDocs = await Promise.all(playersInRoom.map(pid => adminDb.collection("users").doc(pid).get()));
                 playerDocs.forEach(doc => {
                    if (doc.exists && doc.data()?.email) emails.push(doc.data()?.email);
                 });

                 const html = getMatchStartEmailTemplate("Operative", matchId, matchData.game);
                 await Promise.all(emails.map(email => 
                    sendTacticalEmail(email, `DEPLOYMENT IMMINENT: ${matchData.game} Match Ready`, html)
                 ));
              } catch (e) {
                 console.error("[MatchAction] Global notification failure:", e);
              }
           })();
        }
      } else {
        // [OVERSEER] Non-player addition
        updates[`overseers.${uid}`] = { uid, username, avatarId, role: 'PARTNER' };
      }

      transaction.update(matchRef, updates);
    });

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] joinMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: LEAVE MATCH
 */
export async function leaveMatchAction(idToken: string, matchId: string) {
  const uid = await getVerifiedUid(idToken);
  const userRef = adminDb.collection("users").doc(uid);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const matchSnap = await transaction.get(matchRef);
      if (!userSnap.exists || !matchSnap.exists) throw new Error("Document not found.");

      const matchData = matchSnap.data() as Match;
      if (matchData.status !== 'WAITING' && matchData.status !== 'READY') throw new Error("Cannot leave active session.");

      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(matchData.challengeFee),
        lifetimeWagered: admin.firestore.FieldValue.increment(-matchData.challengeFee)
      });

      const updatedPlayers = { ...matchData.players };
      delete updatedPlayers[uid];

      if (Object.keys(updatedPlayers).length === 0) {
        // Nuke the match and all its messages
        await purgeMatchDataInternal(matchId);
      } else {
        transaction.update(matchRef, {
          players: updatedPlayers,
          playerIds: admin.firestore.FieldValue.arrayRemove(uid),
          status: 'WAITING'
        });
      }
    });
    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] leaveMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: SUBMIT MATCH RESULT
 */
export async function submitMatchResultAction(
  idToken: string,
  matchId: string,
  claim: 'WIN' | 'LOSS',
  proofUrl?: string,
  scoreFor?: number,
  scoreAgainst?: number,
  kills?: number,
  // PHASE 2: Optional cryptographic proof (backward compatible)
  gameProofPlayerA?: SignedGameProof,
  gameProofPlayerB?: SignedGameProof,
  requiresAdminReview?: boolean
) {
  const uid = await getVerifiedUid(idToken);

  // 🔒 [SECURITY] PHASE 6: Rate limit match submissions (5 matches/minute per user)
  const rateLimitKey = `match_submissions_${uid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 5, 60 * 1000); // 5 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many match submissions. Try again in ${rateLimitResult.retryAfter} seconds.`,
      matchId
    };
  }

  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    let pendingTournamentCleanup: string | null = null;
    let needsNuke = false;
    let validatedProof: ValidatedGameProof | null = null;
    let fraudAnalysis: any = null;

    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match not found.");
      const matchData = matchSnap.data() as Match;

      // PRE-FETCH: If this match belongs to a circuit, read it NOW before any writes
      let circuitData = null;
      if (matchData.circuitId) {
         const circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
         const circuitSnap = await transaction.get(circuitRef);
         if (circuitSnap.exists) circuitData = circuitSnap.data();
      }

      if (!matchData.playerIds.includes(uid)) throw new Error("Unauthorized operative.");
      
      // 🔒 [SECURITY] Prevent modifications to resolved matches IF user already submitted
      const myData = matchData.players[uid];
      if ((matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') && (myData as any)?.claim) {
         throw new Error("Match has already been resolved. Tactical report cannot be modified.");
      }
      
      validateAbsoluteVictory(scoreFor || 0, scoreAgainst || 0, matchData.format);

      // [SCORE-VERIFICATION] Mirror-Score Lockdown
      // 🔒 [SECURITY] M-002 FIX: Validate scores atomically - require complete matching
      const isEFootball = matchData.game === 'EFOOTBALL';
      if (isEFootball && scoreFor !== undefined && scoreAgainst !== undefined) {
         const opponents = Object.entries(matchData.players).filter(([pid]) => pid !== uid);
         for (const [opUid, opData] of opponents) {
            const opScoreFor = (opData as any).scoreFor;
            const opScoreAgainst = (opData as any).scoreAgainst;

            // 🔒 If opponent has complete scores, they must match exactly
            if (opScoreFor !== undefined && opScoreAgainst !== undefined) {
               if (scoreFor !== opScoreAgainst || scoreAgainst !== opScoreFor) {
                  throw new Error("SCORE_MISMATCH: Tactical conflict detected. Your reported scoreline does not match your opponent's submission.");
               }
            } 
            // 🔒 If opponent has partial scores, this is an error (incomplete submission)
            else if ((opScoreFor !== undefined || opScoreAgainst !== undefined)) {
               throw new Error("INVALID: Opponent submitted incomplete score. Wait for full submission or dispute.");
            }
            // Otherwise opponent hasn't submitted yet - allow this submission (validation will happen when both have scores)
         }
      }

      const updates: any = {
        [`players.${uid}.claim`]: claim,
        ...(proofUrl && { [`players.${uid}.proofUrl`]: proofUrl }),
        ...(scoreFor !== undefined && { [`players.${uid}.scoreFor`]: scoreFor }),
        ...(scoreAgainst !== undefined && { [`players.${uid}.scoreAgainst`]: scoreAgainst }),
        ...(kills !== undefined && { [`players.${uid}.kills`]: kills }),
        ...(requiresAdminReview && { [`players.${uid}.requiresAdminReview`]: true })
      };

      const updatedPlayers = { ...matchData.players, [uid]: { ...matchData.players[uid], claim } };
      const playerList = Object.entries(updatedPlayers).map(([pid, p]) => ({ ...(p as any), uid: pid }));
      const winners = playerList.filter(p => (p as any).claim === 'WIN');
      const losers = playerList.filter(p => (p as any).claim === 'LOSS');
      const totalPlayers = Object.keys(matchData.players).length;
      const totalSubmitted = playerList.filter(p => (p as any).claim).length;

      const isCircuitMatch = !!matchData.circuitId || ['tournament', '16_TOURNAMENT'].includes(matchData.format);

      // 🔒 [SECURITY] MULTI-PLAYER CONSENSUS FIX
      // Auto-resolve if: ALL players submitted AND exactly ONE winner declared
      if (totalSubmitted === totalPlayers && winners.length === 1) {
         if (matchData.status !== 'CLOSED') {
            const attemptId = `finalize_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            updates.championUid = (winners[0] as any).uid;
            updates.status = 'CLOSED';
            updates.finalizationAttemptId = attemptId;
            
            const finalizeResult = await internalFinalizeMatchClosure(transaction, matchRef, matchData, (winners[0] as any).uid, uid, circuitData, updatedPlayers);
            if (finalizeResult.needsTournamentCleanup && finalizeResult.circuitId) {
               pendingTournamentCleanup = finalizeResult.circuitId;
            }
            
            if (!isCircuitMatch) needsNuke = true;
         }
      } 
      // 🔒 DISPUTE DETECTED: Conflict (Multiple winners) or Deadlock (Zero winners)
      else if (totalSubmitted === totalPlayers && (winners.length > 1 || winners.length === 0)) {
         updates.status = 'DISPUTED';
         updates.disputedAt = admin.firestore.FieldValue.serverTimestamp();
         updates.championUid = null;
      } 
      // 🕒 PENDING: Awaiting more results
      else if (winners.length > 0 && matchData.status !== 'WAITING_FOR_OPPONENT' && matchData.status !== 'DISPUTED') {
         updates.status = 'WAITING_FOR_OPPONENT';
         updates.resolutionEndTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
         updates.championUid = (winners[0] as any).uid || null;
      }

      transaction.update(matchRef, updates);
    });

    // PHASE 2: SECURITY VALIDATIONS (Post-transaction, non-blocking)
    // These validations don't affect payouts but improve security audit trail
    try {
      const matchSnap = await adminDb.collection("matches").doc(matchId).get();
      const matchData = matchSnap.data() as Match;

      // 1. Validate cryptographic proof if provided (optional)
      if (gameProofPlayerA && gameProofPlayerB && isProofRecent(gameProofPlayerA.timestamp)) {
        try {
          validatedProof = validateCompleteProof(gameProofPlayerA, gameProofPlayerB);
          
          if (validatedProof.proofStatus === 'VALID') {
            // Store validated proof with match for audit
            await adminDb.collection("matches").doc(matchId).update({
              gameProof: {
                hash: validatedProof.hash,
                playerA_uid: validatedProof.playerA_uid,
                playerB_uid: validatedProof.playerB_uid,
                verifiedAt: validatedProof.verifiedAt,
                proofStatus: 'VALID'
              },
              proofVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log(`[Phase2] Game proof validated for match ${matchId}`);
          } else {
            console.warn(`[Phase2] Game proof INVALID for match ${matchId}: ${validatedProof.proofStatus}`);
          }
        } catch (proofError) {
          console.warn(`[Phase2] Game proof validation error: ${proofError}`);
          // Non-fatal - proceed without proof validation
        }
      }

      // 2. Initialize match recording for high-value matches (optional)
      if (shouldRecordMatch(matchData.challengeFee, matchData.format)) {
        try {
          await initializeMatchRecording(
            matchId,
            Object.keys(matchData.players)[0],
            Object.keys(matchData.players)[1]
          );
          
          // Finalize recording if match is already closed
          if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') {
            const winner = matchData.championUid;
            const loser = Object.keys(matchData.players).find(p => p !== winner);
            const playerData = winner ? (matchData.players as any)[winner] : null;
            
            await finalizeMatchRecording(
              matchId,
              playerData?.scoreFor || playerData?.kills || 0,
              0 // Loser score
            );
            
            // Verify the recording
            const verification = await verifyMatchRecording(matchId);
            console.log(`[Phase2] Match recording verified: ${verification.status}`);
          }
        } catch (recordError) {
          console.warn(`[Phase2] Match recording error: ${recordError}`);
          // Non-fatal - proceed without recording
        }
      }

      // 3. Run fraud detection analysis (optional, non-blocking)
      if (matchData.championUid) {
        try {
          fraudAnalysis = await analyzeMatchForFraud(matchData, matchData.championUid);
          
          if (fraudAnalysis.flagged) {
            console.warn(`[Phase2] Fraud flag on match ${matchId}: score=${fraudAnalysis.baseScore}`);
            
            // Store fraud analysis with match for admin review
            await adminDb.collection("matches").doc(matchId).update({
              fraudAnalysis: {
                score: fraudAnalysis.baseScore,
                flagged: fraudAnalysis.flagged,
                autoHold: fraudAnalysis.autoHold,
                reasons: fraudAnalysis.reasons.slice(0, 5) // Store first 5 reasons
              },
              fraudAnalyzedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // If AUTO HOLD, create admin alert
            if (fraudAnalysis.autoHold) {
              const alertRef = adminDb.collection("fraud_holds").doc();
              await alertRef.set({
                matchId,
                playerId: matchData.championUid,
                holdReason: 'AUTO_HOLD: High fraud score',
                fraudScore: fraudAnalysis.baseScore,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                resolved: false
              });
              console.error(`[Phase2] FRAUD AUTO-HOLD on match ${matchId}`);
            }
          }
        } catch (fraudError) {
          console.warn(`[Phase2] Fraud detection error: ${fraudError}`);
          // Non-fatal - proceed without fraud analysis
        }
      }
    } catch (phase2Error) {
      console.warn(`[Phase2] Post-transaction security check error: ${phase2Error}`);
      // Non-fatal - Phase 2 is optional and non-blocking
    }

    if (needsNuke) {
       await purgeMatchMessagesOnly(matchId);
    }

    if (pendingTournamentCleanup) {
       await cleanupTournamentData(pendingTournamentCleanup);
    }

    // PHASE 3: POST-MATCH NOTIFICATIONS
    // Send win/loss in-app alerts to all players after the match is settled.
    await dispatchMatchResolutionNotifications(matchId, 'RESOLVED'); // Helper will check actual doc status

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] submitMatchResult error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: EXECUTE MATCH CLOSURE
 */
export async function executeMatchClosureAction(idToken: string, matchId: string) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    let pendingTournamentCleanup: string | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) return; // Already purged by Auto-Nuke Protocol
      const matchData = matchSnap.data() as Match;

      if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') return;
      
      let circuitSnap = null;
      let circuitRef: admin.firestore.DocumentReference | null = null;
      if (matchData.circuitId) {
        circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
        circuitSnap = await transaction.get(circuitRef);
      }

      let championUid = matchData.championUid;
      if (!championUid) {
         const winners = Object.values(matchData.players).filter(p => (p as any).claim === 'WIN');
         if (winners.length === 1) championUid = (winners[0] as any).uid;
      }
      if (!championUid) throw new Error("No champion detected.");

      const finalizeResult = await internalFinalizeMatchClosure(transaction, matchRef, matchData, championUid, uid, circuitSnap?.exists ? circuitSnap.data() : null);
      if (finalizeResult.needsTournamentCleanup && finalizeResult.circuitId) {
         pendingTournamentCleanup = finalizeResult.circuitId;
      }
    });

    // --- STEP 2: Message Cleanup (preserve match for history) ---
    // Eradicate chat history but keep match document for rankings and history
    await purgeMatchMessagesOnly(matchId);

    if (pendingTournamentCleanup) {
       await cleanupTournamentData(pendingTournamentCleanup);
    }

    // PHASE 3: POST-MATCH NOTIFICATIONS
    await dispatchMatchResolutionNotifications(matchId, 'CLOSED');

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] executeClosure error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: REGISTER INTEREST
 */
export async function registerChallengeInterestAction(
  idToken: string,
  _ignoredUsername: string,
  _ignoredAvatarId: number,
  game: 'CODM' | 'EFOOTBALL',
  segment: '1v1' | '5v5' | 'br' | 'ffa' | 'tournament' | 'alcatraz',
  fee: number = 500,
  inGameName?: string
) {
  const { uid, profile } = await getVerifiedIdentity(idToken);
  const userRef = adminDb.collection("users").doc(uid);
  const queueRef = adminDb.collection("queues").doc(`${game.toLowerCase()}_${segment}`);
  const quotaMap: Record<string, number> = { 'tournament': 16, 'alcatraz': 20, 'ffa': 8 };
  const target = quotaMap[segment] || 2;

  try {
     const result = await adminDb.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const queueSnap = await transaction.get(queueRef);

        if (!userSnap.exists) throw new Error("Operative profile not found.");
        const userData = userSnap.data()!;
        const queueData = (queueSnap.exists ? queueSnap.data() : { playerIds: [], players: [] }) as any;

        // --- GHOST QUEUE CLEANUP ---
        // If the queue was recently materialized (completed), reset it for the new operative.
        const isMaterialized = queueData.status === 'MATERIALIZED';
        const effectivePlayerIds = isMaterialized ? [] : (queueData.playerIds || []);
        const effectivePlayers = isMaterialized ? [] : (queueData.players || []);

        const currentBalance = Number(userData.balanceCoins || 0);
        const requiredFee = Number(fee);

        // 1. Check for Duplicate Entry
        if (effectivePlayerIds.includes(uid)) {
           return { matchCreated: false, alreadyRegistered: true };
        }

        // 2. Validate Balance (Strictly)
        if (currentBalance < requiredFee) {
           throw new Error(`Insufficient Credits. 500 CR required for High-Stake Secure Vaulting. Your current balance: ${currentBalance} CR.`);
        }

        // 3. Vault the Credits & Save Profile Tag
        const tagField = game === 'CODM' ? 'codTag' : 'efootballTag';
        transaction.update(userRef, {
           balanceCoins: admin.firestore.FieldValue.increment(-requiredFee),
           lifetimeWagered: admin.firestore.FieldValue.increment(requiredFee),
           [tagField]: inGameName || (userData[tagField] || "Unknown"), // Persist to profile
           updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        if (effectivePlayerIds.length + 1 >= target) {
           const currentRegistered = { uid, username: profile.username, avatarId: profile.avatarId, inGameName: inGameName || (userData[tagField] || "Unknown") };
           const allPlayers = [...effectivePlayers, currentRegistered];

           // Shared players map for all types
           const playersMap: Record<string, any> = {};
           allPlayers.forEach((p: any) => {
             playersMap[p.uid] = { ...p, ready: false, team: 'alpha' };
           });

           // --- ALCATRAZ WEEKEND BLITZ: Spawn a standard 20-player BR match ---
           if (segment === 'alcatraz') {
             const matchRef = adminDb.collection("matches").doc();
             transaction.set(matchRef, {
               game,
               format: 'alcatraz',
               challengeFee: fee,
               status: 'WAITING',
               maxPlayers: 20,
               playerIds: allPlayers.map((p: any) => p.uid),
               players: playersMap,
               championUid: null,
               creatorId: uid,
               createdAt: admin.firestore.FieldValue.serverTimestamp(),
               expiresAt: new Date(Date.now() + 6 * 3600 * 1000), // 6h window
             });
             transaction.set(queueRef, { matchId: matchRef.id, status: 'MATERIALIZED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
             return { matchCreated: true, matchId: matchRef.id };
           }

            // --- FREE FOR ALL: Spawn a single FFA match ---
            if (segment === 'ffa') {
              const matchRef = adminDb.collection("matches").doc();
              transaction.set(matchRef, {
                game,
                format: 'FFA',
                challengeFee: fee,
                status: 'WAITING',
                maxPlayers: 8,
                playerIds: allPlayers.map((p: any) => p.uid),
                players: playersMap,
                championUid: null,
                creatorId: uid,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: new Date(Date.now() + 6 * 3600 * 1000), // 6h window
              });
              transaction.set(queueRef, { matchId: matchRef.id, status: 'MATERIALIZED', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
              return { matchCreated: true, matchId: matchRef.id };
            }

            // --- ELITE TOURNAMENT: Auto-Materialize the Main Room ---
            const matchRef = adminDb.collection("matches").doc();
            const matchData: any = {
              game,
              format: 'tournament',
              challengeFee: fee,
              status: 'WAITING',
              maxPlayers: 16,
              playerIds: allPlayers.map((p: any) => p.uid),
              players: playersMap,
              championUid: null,
              creatorId: uid,
              hostUid: uid,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };

            // Set the match doc FIRST so initializeCircuit has a reference
            transaction.set(matchRef, matchData);

            // AUTO-INITIALIZE: The "Normal Way" immediately converts full lobbies into circuits
            const circuitId = await initializeCircuit(
              transaction, 
              matchRef, 
              matchData as any, 
              allPlayers as EnginePlayer[], 
              uid
            );

            // 1.3 FIX: Update the match status to COMPLETED so the UI knows to show brackets
            transaction.set(matchRef, {
               status: 'COMPLETED',
               circuitId
            }, { merge: true });

            // Notify all 16 players via the queue document before it is reset by the next user
            transaction.set(queueRef, { 
              matchId: matchRef.id, 
              status: 'MATERIALIZED',
              updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });

            return { matchCreated: true, matchId: matchRef.id };
        } else {
           // Standard Add to Queue
           transaction.set(queueRef, {
             playerIds: admin.firestore.FieldValue.arrayUnion(uid),
             players: admin.firestore.FieldValue.arrayUnion({ uid, username: profile.username, avatarId: profile.avatarId, inGameName: inGameName || (userData[tagField] || "Unknown") }),
             status: 'OPEN',
             updatedAt: admin.firestore.FieldValue.serverTimestamp()
           }, { merge: true });
           return { matchCreated: false };
        }
     });
     return { success: true, ...result };
  } catch (error: any) {
    console.error("[CombatQueue] Register Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: LEAVE CHALLENGE QUEUE
 * Withdraws from the vault and refunds the fee.
 */
export async function unregisterChallengeInterestAction(
  idToken: string,
  game: 'CODM' | 'EFOOTBALL',
  segment: '1v1' | '5v5' | 'br' | 'ffa' | 'tournament' | 'alcatraz',
  fee: number = 500
) {
  const { uid } = await getVerifiedIdentity(idToken);
  const userRef = adminDb.collection("users").doc(uid);
  const queueId = `${game.toLowerCase()}_${segment}`;
  const queueRef = adminDb.collection("queues").doc(queueId);

  try {
     await adminDb.runTransaction(async (transaction) => {
        const queueSnap = await transaction.get(queueRef);
        if (!queueSnap.exists) throw new Error("Queue not found or already closed.");
        
        const queueData = queueSnap.data()!;
        const playerIds = queueData.playerIds || [];
        const players = queueData.players || [];

        if (!playerIds.includes(uid)) {
           throw new Error("You are not registered in this combat queue.");
        }

        // 1. Remove from Queue
        const newPlayerIds = playerIds.filter((pid: string) => pid !== uid);
        const newPlayers = players.filter((p: any) => p.uid !== uid);

        if (newPlayerIds.length === 0) {
           transaction.delete(queueRef);
        } else {
           transaction.update(queueRef, {
              playerIds: newPlayerIds,
              players: newPlayers,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
           });
        }

        // 2. Refund User
        transaction.update(userRef, {
           balanceCoins: admin.firestore.FieldValue.increment(fee),
           lifetimeWagered: admin.firestore.FieldValue.increment(-fee)
        });
     });

     return { success: true };
  } catch (error: any) {
    console.error("[CombatQueue] Leave Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: SET READY STATUS
 */
export async function setReadyStatusAction(idToken: string, matchId: string, ready: boolean) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match missing.");
      const matchData = matchSnap.data() as Match;
      
      const updatedPlayers = { ...matchData.players, [uid]: { ...matchData.players[uid], ready } };
      const playersList = Object.values(updatedPlayers);
      const isGathering = matchData.format === 'league' || matchData.format === 'tournament';
      
      let allReady = playersList.every(p => p.ready) && playersList.length >= (matchData.maxPlayers || 2);
      
      // TACTICAL OVERRIDE: For gathering lobbies (leagues/tournaments), 
      // if the room is full and the host/creator triggers deployment, force allReady to true.
      if (isGathering && !allReady) {
         // Fix: explicitly check the match format or round if maxPlayers isn't stored. Knockout rounds only expect 2.
         const targetSize = matchData.maxPlayers || (matchData.round ? 2 : 12);
         const isFull = playersList.length >= targetSize;
         const isHost = matchData.hostUid === uid || (matchData as any).creatorId === uid;
         
         // TACTICAL OVERRIDE FIX: Only allow for large lobbies. 1v1 matches MUST both be ready.
         if (isFull && isHost && targetSize > 2) {
            allReady = true;
         }
      }

      const updates: any = { [`players.${uid}.ready`]: ready };

      if (allReady) {
         if (isGathering && !matchData.circuitId) {
            // Initialize the tournament circuit and assign the circuitId back to the gathering match
            const generatedCircuitId = await initializeCircuit(transaction, matchRef, matchData as any as EngineMatch, playersList as any as EnginePlayer[], uid);
            if (generatedCircuitId) {
               updates.circuitId = generatedCircuitId;
            }
            // Mark the gathering match as completed since its purpose (gathering players) is done
            updates.status = 'COMPLETED';
         } else {
            updates.status = 'IN_PROGRESS';
         }
      }
      transaction.update(matchRef, updates);
      return { allReady };
    });
    return { success: true, ...result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: RESPOND TO HOST ROLE
 */
export async function respondToHostRoleAction(idToken: string, matchId: string, action: 'ACCEPT' | 'PASS') {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match missing.");
      const matchData = matchSnap.data() as Match;
      if (!matchData.players[uid]?.isHostCandidate) throw new Error("Unauthorized.");

      if (action === 'ACCEPT') {
        transaction.update(matchRef, { hostUid: uid, [`players.${uid}.isHost`]: true, [`players.${uid}.isHostCandidate`]: false });
      } else {
        const others = Object.values(matchData.players).filter(p => p.uid !== uid);
        if (others.length > 0) {
           const next = others[Math.floor(Math.random() * others.length)];
           transaction.update(matchRef, { [`players.${uid}.isHostCandidate`]: false, [`players.${next.uid}.isHostCandidate`]: true });
        }
      }
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: UPDATE ROOM CODE
 * 🔒 [SECURITY] H-003 FIX: Add explicit null check on hostUid
 */
export async function updateRoomCodeAction(idToken: string, matchId: string, roomCode: string) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      const matchData = matchSnap.data() as Match;
      
      // 🔒 [SECURITY] Prevent null/undefined hostUid bypass
      if (!matchData.hostUid || matchData.hostUid !== uid) {
        throw new Error("Unauthorized: Only the assigned host can set the room code.");
      }
      
      transaction.update(matchRef, { roomCode: sanitize(roomCode).slice(0, 20) });
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: CLAIM TECHNICAL WIN
 */
export async function claimTechnicalWinAction(idToken: string, matchId: string) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      const matchData = matchSnap.data() as Match;
      
      // Prevent race conditions and duplicate claims
      if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED' || matchData.status === 'RESOLVING') {
         throw new Error("Match has already been resolved.");
      }

      const hasGhostOpponent = Object.values(matchData.players).some(p => p.username === 'GHOST');
      if (!hasGhostOpponent && !matchData.players[uid]?.ready) {
         throw new Error("You must be READY.");
      }
      
      await resolveTechnicalWin(transaction, matchRef, matchData as any as EngineMatch, uid);
    });

    // PHASE 3: POST-MATCH NOTIFICATIONS
    await dispatchMatchResolutionNotifications(matchId, 'CLOSED', uid);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: APPLY EXPIRATION EXTRACTION
 */
export async function applyExpirationExtractionAction(idToken: string, matchId: string) {
   const uid = await getVerifiedUid(idToken);
   const matchRef = adminDb.collection("matches").doc(matchId);
   try {
      await adminDb.runTransaction(async (transaction) => {
         const matchSnap = await transaction.get(matchRef);
         if (!matchSnap.exists) throw new Error("Match missing.");
         const matchData = matchSnap.data() as Match;
         
         const isPlayer = !!matchData.players[uid];
         const isAdmin = (await adminAuth.getUser(uid)).customClaims?.role === 'ADMIN';
         if (!isPlayer && !isAdmin) throw new Error("Unauthorized.");

         const playersList = Object.values(matchData.players);
         const readyCount = playersList.filter(p => p.ready).length;
         const claimCount = playersList.filter(p => (p as any).claim).length;

         if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') return;

         if (matchData.status === 'WAITING') {
            // MATCHMAKING FAILED: Nobody joined before the lobby expired. Refund the creator.
            for (const pid of matchData.playerIds) {
               transaction.update(adminDb.collection("users").doc(pid), {
                  balanceCoins: admin.firestore.FieldValue.increment(matchData.challengeFee || 0),
               });
               const logRef = adminDb.collection("transactions").doc();
               transaction.set(logRef, {
                  uid: pid,
                  type: "CREDIT",
                  category: "MATCH_REFUND",
                  description: "Matchmaking expired before opponent joined. Refund processed.",
                  amount: matchData.challengeFee || 0,
                  status: "COMPLETED",
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
               });
            }
            transaction.update(matchRef, {
               status: 'CLOSED',
               disputeReason: 'MATCHMAKING_EXPIRED_REFUNDED',
               resolvedAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return;
         }

         if (readyCount === 0 || (readyCount === playersList.length && claimCount === 0)) {
            await resolveDoubleNoShow(transaction, matchRef, matchData as any as EngineMatch);
         } else if (claimCount === 1) {
            // 🏆 AUTO-RESOLVE: One person submitted, the other vanished. Award win to claimant.
            const winnerUid = Object.keys(matchData.players).find(pid => !!(matchData.players[pid] as any).claim);
            if (winnerUid) {
               const { resolveTechnicalWin } = await import("@/lib/match-engine/validation");
               await resolveTechnicalWin(transaction, matchRef, matchData as any as EngineMatch, winnerUid);
            } else {
               throw new Error("Claimant data missing.");
            }
         } else {
            // If both submitted, consensus should handled by the standard submit action.
            // If we hit here, it means they might have conflicting claims or some other edge case.
            // We'll leave it for manual result submission or tribunal if it hasn't closed yet.
            return;
         }
      });

      // PHASE 3: POST-MATCH NOTIFICATIONS
      await dispatchMatchResolutionNotifications(matchId, 'RESOLVED');

      return { success: true };
   } catch (error: any) {
      return { success: false, error: error.message };
   }
}

/**
 * SERVER ACTION: ADMIN FORCE DELETE
 */
export async function adminForceDeleteMatchAction(idToken: string, matchId: string) {
   await getVerifiedAdminUid(idToken);
   await adminDb.collection("matches").doc(matchId).delete();
   return { success: true };
}

/**
 * SERVER ACTION: ADMIN RESOLVE MATCH
 * Manually forces a match to resolve with a specific winner.
 */
export async function adminResolveMatchAction(
  idToken: string,
  matchId: string,
  winnerUid: string
) {
   const { profile } = await getVerifiedIdentity(idToken);
   await getVerifiedAdminUid(idToken);

  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match missing.");
      const matchData = matchSnap.data() as Match;

      let circuitSnap = null;
      let circuitRef: admin.firestore.DocumentReference | null = null;
      if (matchData.circuitId) {
        circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
        circuitSnap = await transaction.get(circuitRef);
      }

      // Add admin footprint
      transaction.update(matchRef, {
        adminResolved: true,
        adminResolvedBy: profile.uid
      });

      // Crucial: Finally close the match to distribute circuit points
      await internalFinalizeMatchClosure(
         transaction, 
         matchRef, 
         matchData, 
         winnerUid, 
         profile.uid, 
         circuitSnap?.exists ? circuitSnap.data() : null
      );
    });

    // PHASE 3: POST-MATCH NOTIFICATIONS
    await dispatchMatchResolutionNotifications(matchId, 'CLOSED', winnerUid);

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] adminResolveMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: REQUEST ADMIN INTERVENTION
 * High-stakes alert for Alpha-1 Support (Moderators).
 */
export async function requestAdminInterventionAction(
  idToken: string,
  matchId: string,
  reason: string
) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("Match missing.");
    const matchData = matchSnap.data() as Match;

    if (!matchData.playerIds.includes(uid)) throw new Error("Unauthorized.");

    // Update match with intervention status
    await matchRef.update({
      interventionRequested: true,
      interventionReason: reason,
      intervenedBy: uid,
      intervenedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] requestIntervention error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * USER ACTION: Ping Opponent (Tactical Alert)
 * 🔒 [SECURITY] M-010: Enforce 3m cooldown on pings
 */
export async function pingOpponentAction(idToken: string, matchId: string) {
  const { uid, profile } = await getVerifiedIdentity(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match not found.");
      
      const match = matchSnap.data()!;
      if (!match.playerIds.includes(uid)) throw new Error("Unauthorized.");
      if (match.status === 'CLOSED' || match.status === 'COMPLETED') throw new Error("Session closed.");

      // Check Cooldown (3 minutes)
      const now = Date.now();
      const lastPing = match.lastPingAt?.toMillis() || 0;
      const cooldown = 3 * 60 * 1000;
      
      if (now - lastPing < cooldown) {
        const remaining = Math.ceil((cooldown - (now - lastPing)) / 1000);
        throw new Error(`Ping Cooldown Active: Wait ${remaining}s.`);
      }

      // Identify Opponent
      const opponentId = match.playerIds.find((pid: string) => pid !== uid);
      if (!opponentId) throw new Error("No opponent found.");

      // Update Match with lastPingAt
      transaction.update(matchRef, {
        lastPingAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 4. Send Tactical Ping Signals (Mass Broadcast to ALL participants)
      const others = match.playerIds.filter((pid: string) => pid !== uid);
      
      for (const recipientId of others) {
        const userRef = adminDb.collection("users").doc(recipientId);
        
        // Profile Signal (Real-Time HUD)
        transaction.update(userRef, {
          ping: {
            active: true,
            matchId: matchId,
            from: profile.username,
            message: `${profile.username} is waiting for you in the combat zone!`,
            timestamp: admin.firestore.FieldValue.serverTimestamp()
          }
        });

        // Historical Record (Notification Inbox)
        const nRef = userRef.collection("notifications").doc();
        transaction.set(nRef, {
          type: 'QUICK_PING',
          title: 'TACTICAL ALERT',
          message: `${profile.username} is waiting for you in the combat zone!`,
          matchId,
          senderName: profile.username,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      return { success: true };
    });

    return result;
  } catch (error: any) {
    console.error("[PingAction] Failure:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Summon Admin for Judgement
 * Flags a match as DISPUTED and alerts the command center.
 */
export async function setMatchDisputedAction(idToken: string, matchId: string, reason: string) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);
  
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match de-synchronized.");
      
      const matchData = matchSnap.data()!;
      if (!matchData.playerIds.includes(uid)) throw new Error("UNAUTHORIZED: Only participants can summon judgement.");
      
      transaction.update(matchRef, {
        status: 'DISPUTED',
        disputeReason: reason,
        disputeTriggeredBy: uid,
        disputeAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Log the dispute for audit
      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: 'MATCH_DISPUTE',
        matchId,
        uid,
        reason,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    });

    return result;
  } catch (error: any) {
    console.error("[MatchAction] setMatchDisputed error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Summon Partner to Dispute
 * Called by Admins to bring the lobby creator into the judgement process.
 */
export async function summonPartnerAction(idToken: string, matchId: string) {
  const uid = await getVerifiedUid(idToken);
  
  try {
    // 1. Verify caller is Admin
    const adminRef = adminDb.collection("users").doc(uid);
    const adminSnap = await adminRef.get();
    if (adminSnap.data()?.role !== 'ADMIN' && adminSnap.data()?.role !== 'SUPER_ADMIN') {
      throw new Error("UNAUTHORIZED: Only Command Center Staff can summon Partners.");
    }

    const matchRef = adminDb.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("Match not found.");
    
    const matchData = matchSnap.data()!;
    const partnerUid = matchData.creatorId;
    if (!partnerUid) throw new Error("This is not a Partner-created lobby.");

    await matchRef.update({
      partnerSummoned: true,
      partnerSummonedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 2. Fetch Partner Data for Email
    const partnerRef = adminDb.collection("users").doc(partnerUid);
    const partnerSnap = await partnerRef.get();
    const partnerData = partnerSnap.data();

    // 3. Dispatch In-App Notification
    const nRef = partnerRef.collection("notifications").doc();
    await nRef.set({
      type: 'TACTICAL_SUMMONS',
      title: 'COMMAND CENTER SUMMONS',
      message: `You are required for judgement in Match #${matchId.slice(-6)}. Open your Partner Portal immediately.`,
      matchId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. Dispatch Critical Email Alert
    if (partnerData?.email) {
      const emailHtml = getSummonEmailTemplate(partnerData.username, matchId);
      await sendTacticalEmail(partnerData.email, "CRITICAL ALERT: Command Center Summons", emailHtml);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] summonPartner error:", error);
    return { success: false, error: error.message };
  }
}
