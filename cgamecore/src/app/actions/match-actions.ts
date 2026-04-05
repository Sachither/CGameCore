"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { Match, MatchPlayer } from "@/lib/match-service";

/**
 * Helper to verify ID Token and return UID
 */
async function getVerifiedUid(idToken?: string) {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

/**
 * SERVER ACTION: CREATE MATCH
 * Deducts fee and creates match document atomically.
 */
export async function createMatchAction(
  idToken: string,
  username: string,
  avatarId: number,
  game: 'CODM' | 'EFOOTBALL',
  format: Match['format'],
  challengeFee: number,
  inGameName: string,
  weaponClass: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' | 'NONE' = 'NONE',
  duration: '12m' | '15m' | 'NONE' = 'NONE',
  maxPlayers: number = 2
) {
  const uid = await getVerifiedUid(idToken);
  
  const userRef = adminDb.collection("users").doc(uid);
  const matchRef = adminDb.collection("matches").doc();

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User profile not found.");

      const userData = userSnap.data()!;
      
      // 0. Security Check: Restricted?
      const now = Date.now();
      const suspensionEnd = userData.suspendedUntil ? (userData.suspendedUntil.toDate ? userData.suspendedUntil.toDate().getTime() : new Date(userData.suspendedUntil).getTime()) : 0;
      const isRestricted = userData.isBanned || (suspensionEnd > now);
      
      if (isRestricted) {
         throw new Error("SECURITY RESTRICTION: Your operative access has been suspended.");
      }

      if ((userData.balanceCoins || 0) < challengeFee) {
        throw new Error("Insufficient balance for this challenge fee.");
      }

      // 1. Deduct fee and track wager for AML rollover
      const userUpdate: any = {
        balanceCoins: admin.firestore.FieldValue.increment(-challengeFee),
        lifetimeWagered: admin.firestore.FieldValue.increment(challengeFee)
      };

      // Persistent Sync: If user has no inGameName set in profile, save it now
      const gameTagField = game === 'CODM' ? 'codTag' : 'efootballTag';
      if (!userData[gameTagField]) {
        userUpdate[gameTagField] = inGameName;
      }
      if (!userData.username) {
        userUpdate.username = inGameName; // Use as platform nickname if currently empty
      }
      if (!userData.inGameName) {
        userUpdate.inGameName = inGameName;
      }

      transaction.update(userRef, userUpdate);

      // 2. Create Match
      const matchData: Match = {
        game,
        format,
        challengeFee,
        status: 'WAITING',
        playerIds: [uid],
        players: {
          [uid]: { uid, username, avatarId, ready: false, team: 'alpha', inGameName: inGameName || "Unknown" }
        },
        championUid: null,
        creatorId: uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        weaponClass: game === 'CODM' ? weaponClass : 'NONE',
        duration,
        maxPlayers
      };

      transaction.set(matchRef, matchData);
    });

    return { success: true, matchId: matchRef.id };
  } catch (error: any) {
    console.error("[MatchAction] createMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: JOIN MATCH
 * Deducts fee and adds player to existing match.
 */
export async function joinMatchAction(
  idToken: string,
  username: string,
  avatarId: number,
  matchId: string,
  inGameName: string
) {
  const uid = await getVerifiedUid(idToken);
  
  const userRef = adminDb.collection("users").doc(uid);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const matchSnap = await transaction.get(matchRef);

      if (!userSnap.exists || !matchSnap.exists) throw new Error("Document not found.");

      const userData = userSnap.data()!;
      const matchData = matchSnap.data() as Match;

      // 0. Security Check: Restricted?
      const now = Date.now();
      const suspensionEnd = userData.suspendedUntil ? (userData.suspendedUntil.toDate ? userData.suspendedUntil.toDate().getTime() : new Date(userData.suspendedUntil).getTime()) : 0;
      const isRestricted = userData.isBanned || (suspensionEnd > now);
      
      if (isRestricted) {
         throw new Error("SECURITY RESTRICTION: Your operative access has been suspended.");
      }

      if (matchData.status !== 'WAITING') throw new Error("Arena is no longer accepting players.");
      if (matchData.players[uid]) throw new Error("You are already in this combat session.");
      
      const playerCount = Object.keys(matchData.players).length;
      const target = matchData.maxPlayers || 2;

      if ((userData.balanceCoins || 0) < matchData.challengeFee) {
        throw new Error("Insufficient balance to join this challenge.");
      }

      // 1. Deduct fee and track wager for AML rollover
      const userUpdate: any = {
        balanceCoins: admin.firestore.FieldValue.increment(-matchData.challengeFee),
        lifetimeWagered: admin.firestore.FieldValue.increment(matchData.challengeFee)
      };

      // Persistent Sync: If user has no inGameName set in profile, save it now
      const gameTagField = matchData.game === 'CODM' ? 'codTag' : 'efootballTag';
      if (!userData[gameTagField]) {
        userUpdate[gameTagField] = inGameName;
      }
      if (!userData.username) {
        userUpdate.username = inGameName; // Use as platform nickname if currently empty
      }
      if (!userData.inGameName) {
        userUpdate.inGameName = inGameName;
      }

      transaction.update(userRef, userUpdate);

      // 2. Add player
      const player: MatchPlayer = {
        uid,
        username,
        avatarId,
        ready: false,
        team: matchData.format === 'FFA' ? 'alpha' : (playerCount % 2 === 0 ? 'alpha' : 'bravo'),
        inGameName
      };

      const isFull = (playerCount + 1) >= target;
      
      let hostCandidateUid: string | null = null;
      if (isFull) {
        const allPlayerIds = [...Object.keys(matchData.players), uid];
        hostCandidateUid = allPlayerIds[Math.floor(Math.random() * allPlayerIds.length)];
      }

      // Merge isHostCandidate directly into the joining player's object
      // to avoid a Firestore "field specified multiple times" error.
      // If uid === hostCandidateUid, both players.uid and players.uid.isHostCandidate
      // would appear in the same update map — which Firestore forbids.
      if (hostCandidateUid === uid) {
        player.isHostCandidate = true;
      }

      const updates: any = {
        [`players.${uid}`]: player,
        playerIds: admin.firestore.FieldValue.arrayUnion(uid),
        ...(isFull && { status: 'READY' }),
        // Only set isHostCandidate on another player (not the joiner — handled above)
        ...(hostCandidateUid && hostCandidateUid !== uid && { [`players.${hostCandidateUid}.isHostCandidate`]: true }),
      };

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
 * Refunds fee and removes player.
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

      if (matchData.status !== 'WAITING' && matchData.status !== 'READY') {
        throw new Error("Cannot leave an active or completed challenge.");
      }

      // 1. Refund fee and undo wager tracking
      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(matchData.challengeFee),
        lifetimeWagered: admin.firestore.FieldValue.increment(-matchData.challengeFee)
      });

      // 2. Remove player
      const updatedPlayers = { ...matchData.players };
      delete updatedPlayers[uid];

      if (Object.keys(updatedPlayers).length === 0) {
        transaction.delete(matchRef);
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
 * Records the player's claim and sets resolution timer.
 */
export async function submitMatchResultAction(
  idToken: string,
  matchId: string,
  claim: 'WIN' | 'LOSS',
  proofUrl?: string,
  scoreFor?: number,
  scoreAgainst?: number,
  kills?: number
) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match not found.");

      const matchData = matchSnap.data() as Match;
      if (matchData.status === 'COMPLETED' || matchData.status === 'CLOSED') {
        throw new Error("Challenge already finalized.");
      }

      // Build a flat dot-notation update map to avoid duplicate field paths
      const updates: any = {
        [`players.${uid}.claim`]: claim,
        ...(proofUrl && { [`players.${uid}.proofUrl`]: proofUrl }),
        ...(scoreFor !== undefined && { [`players.${uid}.scoreFor`]: scoreFor }),
        ...(scoreAgainst !== undefined && { [`players.${uid}.scoreAgainst`]: scoreAgainst }),
        ...(kills !== undefined && { [`players.${uid}.kills`]: kills })
      };

      // In-memory projection for logic only — NOT written to Firestore
      const currentPlayers = matchData.players || {};
      const upcomingPlayers = {
        ...currentPlayers,
        [uid]: {
          ...currentPlayers[uid],
          claim,
          proofUrl: proofUrl || currentPlayers[uid]?.proofUrl,
          scoreFor: scoreFor ?? currentPlayers[uid]?.scoreFor,
          scoreAgainst: scoreAgainst ?? currentPlayers[uid]?.scoreAgainst,
          kills: kills ?? currentPlayers[uid]?.kills
        }
      };

      const playerList = Object.values(upcomingPlayers);
      const claimsSubmitted = playerList.filter(p => (p as any)?.claim).length;
      const totalPlayers = Object.keys(matchData.players).length;
      
      const winners = playerList.filter(p => (p as any).claim === 'WIN');
      const losers = playerList.filter(p => (p as any).claim === 'LOSS');

      if (claimsSubmitted < totalPlayers) {
        // First person submitted (Wait for opponent / Forfeit Timer)
        if (matchData.status !== 'WAITING_FOR_OPPONENT') {
           updates.status = 'WAITING_FOR_OPPONENT';
           // 15-minute strict forfeit timer
           updates.resolutionEndTime = new Date(Date.now() + 15 * 60 * 1000).toISOString();
           updates.championUid = (winners.length === 1) ? (winners[0] as any).uid : null;
        }
      } else {
        // Everyone has submitted! Double-Blind reveal.
        if (winners.length > 1) {
          updates.status = 'DISPUTED';
        } else if (winners.length === 1 && losers.length === (totalPlayers - 1)) {
          // RECONCILIATION CHECK: If exactly 2 players (1v1), verify exact scores
          if (totalPlayers === 2) {
            const winner = winners[0];
            const loser = losers[0];
            
            const scoreMatch = (winner.scoreFor === loser.scoreAgainst) && (winner.scoreAgainst === loser.scoreFor);
            
            if (scoreMatch) {
              // Clean consensus
              updates.championUid = (winner as any).uid;
              updates.status = 'RESOLVING'; 
              updates.resolutionEndTime = new Date(Date.now()).toISOString();
            } else {
              // Score discrepancy found but result (WIN/LOSS) is agreed.
              // FORCE RECONCILIATION: Return error to second submitter instead of disputing.
              throw new Error("SCORE_MISMATCH: Your scoreline does not match your opponent's report. Please verify the exact scoreline with your opponent.");
            }
          } else {
            // Non-1v1 consensus (Multiplayer FFA, etc. - fallback to claim only)
            updates.championUid = (winners[0] as any).uid;
            updates.status = 'RESOLVING';
            updates.resolutionEndTime = new Date(Date.now()).toISOString();
          }
        } else if (winners.length === 0 && losers.length > 0) {
           // Everyone claimed LOSS?
           updates.status = 'DISPUTED';
        }
      }

      transaction.update(matchRef, updates);
    });

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] submitMatchResult error:", error);
    return { success: false, error: String(error.message || error) };
  }
}

/**
 * SERVER ACTION: EXECUTE MATCH CLOSURE
 * The most critical action: Pays out the winner and updates all stats.
 */
export async function executeMatchClosureAction(idToken: string, matchId: string) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match missing.");

      const matchData = matchSnap.data() as Match;
      if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') return;
      if (matchData.status !== 'RESOLVING' && matchData.status !== 'WAITING_FOR_OPPONENT') {
         throw new Error("Match not in a valid finalization state.");
      }
      if (!matchData.championUid) throw new Error("No champion detected.");

      const championUid = matchData.championUid;

      const winnerRef = adminDb.collection("users").doc(championUid);
      const winnerSnap = await transaction.get(winnerRef);
      if (!winnerSnap.exists) throw new Error("Champion profile missing.");

      const playersCount = Object.keys(matchData.players).length;
      const totalPool = matchData.challengeFee * playersCount;
      const netPool = Math.floor(totalPool * 0.8);

      let victoryReward = netPool;
      const gameKey = matchData.game;

      // Update Winner (Winner Takes All + Platform Commission)
      transaction.update(winnerRef, {
        balanceCoins: admin.firestore.FieldValue.increment(victoryReward),
        totalWins: admin.firestore.FieldValue.increment(1),
        totalMatches: admin.firestore.FieldValue.increment(1),
        [`stats.${gameKey}.wins`]: admin.firestore.FieldValue.increment(1),
        [`stats.${gameKey}.matches`]: admin.firestore.FieldValue.increment(1)
      });

      // NOTIFICATION: Winner
      const winnerNoteRef = winnerRef.collection("notifications").doc();
      transaction.set(winnerNoteRef, {
        title: "Victory Confirmed!",
        message: `Objective Secured. You received ${victoryReward} CR for your performance in ${matchData.game} Match.`,
        type: "MATCH",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update All Losers strictly for match count tracking
      Object.values(matchData.players).forEach(p => {
         if (p.uid !== championUid) {
            const loserRef = adminDb.collection("users").doc(p.uid);
            transaction.update(loserRef, {
               totalMatches: admin.firestore.FieldValue.increment(1),
               [`stats.${gameKey}.matches`]: admin.firestore.FieldValue.increment(1)
            });

            // NOTIFICATION: Loser
            const loserNoteRef = loserRef.collection("notifications").doc();
            transaction.set(loserNoteRef, {
              title: "Outcome Recorded",
              message: `Combat concluded for ${matchData.game} Match. Objective was not met. Keep grinding, operator.`,
              type: "MATCH",
              read: false,
              createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
         }
      });

      // Close Match
      transaction.update(matchRef, {
        status: 'CLOSED',
        rewardAmount: victoryReward,
        resolvedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Update Global Platform Finances (Stat Aggregation)
      const platformFinancesRef = adminDb.collection("stats").doc("platform_finances");
      transaction.set(platformFinancesRef, {
        totalPayouts: admin.firestore.FieldValue.increment(victoryReward),
        totalPlatformCut: admin.firestore.FieldValue.increment(totalPool - victoryReward),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // LEAGUE UPDATES (Strictly 1v1 formats)
      if (matchData.leagueId) {
        const leagueRef = adminDb.collection("leagues").doc(matchData.leagueId);
        const loser = Object.values(matchData.players).find(p => p.uid !== championUid);
        const loserUid = loser?.uid;
        
        const leagueUpdates: any = {
           [`players.${championUid}.points`]: admin.firestore.FieldValue.increment(3),
           [`players.${championUid}.wins`]: admin.firestore.FieldValue.increment(1),
           [`players.${championUid}.played`]: admin.firestore.FieldValue.increment(1),
        };
        if (loserUid) {
           leagueUpdates[`players.${loserUid}.losses`] = admin.firestore.FieldValue.increment(1);
           leagueUpdates[`players.${loserUid}.played`] = admin.firestore.FieldValue.increment(1);
        }
        transaction.update(leagueRef, leagueUpdates);
      }
    });

    // Chat cleanup (Optional: Can be done in a separate non-blocking service)
    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] executeMatchClosure error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: REGISTER CHALLENGE INTEREST (WAITLIST)
 * Atomically manages queues and spawns matches when full.
 */
export async function registerChallengeInterestAction(
  idToken: string,
  username: string,
  avatarId: number,
  game: 'CODM' | 'EFOOTBALL',
  segment: '1v1' | '5v5' | 'br' | 'ffa' | 'league',
  fee: number = 500,
  inGameName?: string
) {
  const uid = await getVerifiedUid(idToken);
  const userRef = adminDb.collection("users").doc(uid);
  const queueId = `${game.toLowerCase()}_${segment}`;
  const queueRef = adminDb.collection("queues").doc(queueId);
  const matchRef = adminDb.collection("matches").doc();

  // Mapping of segment to required player count
  const quotaMap: Record<string, number> = {
    '1v1': 2,
    '5v5': 10,
    'br': 20,
    'ffa': 8,
    'league': 16
  };
  const target = quotaMap[segment] || 2;

  try {
     const result = await adminDb.runTransaction(async (transaction) => {
        const userSnap = await transaction.get(userRef);
        const queueSnap = await transaction.get(queueRef);

        if (!userSnap.exists) throw new Error("Operative profile not found.");
        const userData = userSnap.data()!;
        
        // 0. Balance Check
        if ((userData.balanceCoins || 0) < fee) {
          throw new Error("Insufficient balance for this combat vault.");
        }

        // 1. Queue Logic
        const queueData = queueSnap.exists ? queueSnap.data() : { playerIds: [], players: [] };
        const activePlayerIds = queueData?.playerIds || [];
        const activePlayers = queueData?.players || [];

        if (activePlayerIds.includes(uid)) {
           throw new Error("TACTICAL ALERT: You are already deployed to this queue. Awaiting reinforcements.");
        }

        // 2. Persistent Sync: Save IGN if provided and missing
        const ign = inGameName || userData.inGameName || userData.codTag || userData.efootballTag || "Unknown";
        const userUpdate: any = {
          balanceCoins: admin.firestore.FieldValue.increment(-fee),
          lifetimeWagered: admin.firestore.FieldValue.increment(fee)
        };
        const gameTagField = game === 'CODM' ? 'codTag' : 'efootballTag';
        if (inGameName && !userData[gameTagField]) userUpdate[gameTagField] = inGameName;
        if (inGameName && !userData.username) userUpdate.username = inGameName;
        
        transaction.update(userRef, userUpdate);

        // 3. Match Creation vs Queue Joining
        if (activePlayerIds.length + 1 >= target) {
           // QUEUE FULL: Spawn Match
           const allPlayers = [...activePlayers, { uid, username, avatarId, inGameName: ign }];
           
           const playersMap: Record<string, MatchPlayer> = {};
           allPlayers.forEach((p, idx) => {
              playersMap[p.uid] = {
                 uid: p.uid,
                 username: p.username,
                 avatarId: p.avatarId,
                 inGameName: p.inGameName,
                 ready: false,
                 team: segment === 'ffa' ? 'alpha' : (idx % 2 === 0 ? 'alpha' : 'bravo')
              };
           });

           // Auto-assign host (Winner of random selection)
           const hostUid = allPlayers[Math.floor(Math.random() * allPlayers.length)].uid;
           playersMap[hostUid].isHostCandidate = true;

           const matchData: Match = {
              game,
              format: segment.toUpperCase() as any,
              challengeFee: fee,
              status: 'READY', // High-stake queues move directly to READY state
              playerIds: allPlayers.map(p => p.uid),
              players: playersMap,
              championUid: null,
              creatorId: uid, // Current user triggered the spawn
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
              weaponClass: game === 'CODM' ? 'ALL GUNS' : 'NONE',
              duration: '15m',
              maxPlayers: target
           };

           transaction.set(matchRef, matchData);
           
           // Clear Queue
           transaction.delete(queueRef);
           
           return { matchCreated: true, matchId: matchRef.id };
        } else {
           // JOIN QUEUE
           transaction.set(queueRef, {
              playerIds: admin.firestore.FieldValue.arrayUnion(uid),
              players: admin.firestore.FieldValue.arrayUnion({ uid, username, avatarId, inGameName: ign }),
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
           }, { merge: true });
           
           return { matchCreated: false };
        }
     });

     return { success: true, ...result };
  } catch (error: any) {
    console.error("[MatchAction] registerInterest error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: TOGGLE READY STATUS
 * Transitions match to IN_PROGRESS when all players are ready.
 */
export async function setReadyStatusAction(
  idToken: string,
  matchId: string,
  ready: boolean
) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match lobby not found.");

      const matchData = matchSnap.data() as Match;
      
      // Update the player's ready state
      const updatedPlayers = {
        ...matchData.players,
        [uid]: { ...matchData.players[uid], ready }
      };

      const playersList = Object.values(updatedPlayers);
      const target = matchData.maxPlayers || 2;
      const allReady = playersList.every(p => p.ready) && playersList.length >= target;

      const updates: any = {
        [`players.${uid}.ready`]: ready,
        ...(allReady && { status: 'IN_PROGRESS' })
      };

      transaction.update(matchRef, updates);
      return { allReady };
    });

    return { success: true, allReady: result.allReady };
  } catch (error: any) {
    console.error("[MatchAction] setReadyStatus error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: RESPOND TO HOST ROLE
 * Atomically confirms or cycles the host candidate.
 */
export async function respondToHostRoleAction(
  idToken: string,
  matchId: string,
  action: 'ACCEPT' | 'PASS'
) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match lobby not found.");

      const matchData = matchSnap.data() as Match;

      if (action === 'ACCEPT') {
        transaction.update(matchRef, {
          hostUid: uid,
          [`players.${uid}.isHost`]: true,
          [`players.${uid}.isHostCandidate`]: false
        });
      } else {
        // PASS: Pick another candidate
        const otherPlayers = Object.values(matchData.players).filter(p => p.uid !== uid);
        if (otherPlayers.length > 0) {
           const nextCandidate = otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
           transaction.update(matchRef, {
             [`players.${uid}.isHostCandidate`]: false,
             [`players.${nextCandidate.uid}.isHostCandidate`]: true
           });
        }
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] respondToHostRole error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: UPDATE ROOM CODE
 * Allows the host to broadcast the specific in-game room ID.
 */
export async function updateRoomCodeAction(
  idToken: string,
  matchId: string,
  roomCode: string
) {
  const uid = await getVerifiedUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match missing.");

      const matchData = matchSnap.data() as Match;
      if (matchData.hostUid !== uid) {
        throw new Error("SEC-ALPHA-DENIED: Only the designated Host Operative can broadcast room credentials.");
      }

      transaction.update(matchRef, { roomCode });
    });

    return { success: true };
  } catch (error: any) {
    console.error("[MatchAction] updateRoomCode error:", error);
    return { success: false, error: error.message };
  }
}
