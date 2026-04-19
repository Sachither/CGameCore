import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { pushMatchNotification, pushGlobalCommand } from "./progression";

/**
 * UTILITY: Create Ghost Player Object (for finals when opponent doesn't advance)
 */
function createGhostPlayer(uid: string, team: 'alpha' | 'bravo') {
   return {
      username: 'GHOST',
      uid,
      avatarId: 0,
      team,
      inGameName: '',
      ready: false
   };
}

/**
 * INTERNAL: The "Spurn" mechanism.
 * Converts a full participant list into active matches.
 */
export async function spurnPromoTournamentInternal(promoId: string) {
  const promoRef = adminDb.collection("promo_events").doc(promoId);
  
  try {
    await adminDb.runTransaction(async (transaction) => {
      const promoSnap = await transaction.get(promoRef);
      if (!promoSnap.exists) throw new Error("Promo not found");
      
      const promo = promoSnap.data() as any;
      if (promo.status !== 'OPEN') return; // Already spurned

      const participants = promo.participants;
      const participantData = promo.participantData;
      const game = promo.game;

      if (game === 'EFOOTBALL') {
        // --- 128-Player (or Power-of-2) Knockout Spawning ---
        const circuitRef = adminDb.collection("circuits").doc();
        const circuitId = circuitRef.id;
        
        // Randomize pairing
        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        
        let byePlayer: string | null = null;
        let matchupPlayers = shuffled;
        if (shuffled.length % 2 === 1) {
           byePlayer = shuffled[shuffled.length - 1];
           matchupPlayers = shuffled.slice(0, -1);
        }
        const matchCount = Math.floor(matchupPlayers.length / 2);
        
        const expiresAt = new Date(Date.now() + 120 * 60 * 1000); 

        for (let i = 0; i < matchCount; i++) {
          const p1Uid = matchupPlayers[i * 2];
          const p2Uid = matchupPlayers[i * 2 + 1];
          const p1 = participantData[p1Uid];
          const p2 = participantData[p2Uid];

          const mRef = adminDb.collection("matches").doc();
          transaction.set(mRef, {
            game: 'EFOOTBALL',
            format: 'tournament',
            challengeFee: 0,
            status: 'WAITING',
            circuitId,
            round: 'QR1',
            leg: 'NONE',
            playerIds: [p1Uid, p2Uid],
            expiresAt,
            players: {
              [p1Uid]: { ...p1, uid: p1Uid, ready: false, team: 'alpha' },
              [p2Uid]: { ...p2, uid: p2Uid, ready: false, team: 'bravo' }
            },
            creatorId: 'SYSTEM_PROMO',
            isPromo: true,
            promoId: promoId,
            prizeUSD: promo.prizeUSD,
            prizeNGN: promo.prizeNGN,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // HQ Notifications
          pushMatchNotification(transaction, p1Uid, p2Uid, p2.username, mRef.id, 'PROMO R1', "2 Hours");
          pushMatchNotification(transaction, p2Uid, p1Uid, p1.username, mRef.id, 'PROMO R1', "2 Hours");
        }

        // Initialize Circuit record
        const initialUpdateObj: any = {
          title: `100K PROMO RUSH: ${game}`,
          game,
          format: 'PROMO_TOURNAMENT',
          challengeFee: 0,
          status: 'KNOCKOUT_Q',
          playerIds: participants,
          players: participantData,
          totalPool: promo.prizeUSD,
          prizeNGN: promo.prizeNGN,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          expiresAt,
          matchesCompleted: 0,
          matchesThisRound: matchCount,
          isPromo: true,
          promoId: promoId
        };

        if (byePlayer) {
           initialUpdateObj.byePlayer = byePlayer;
        }

        transaction.set(circuitRef, initialUpdateObj);

        transaction.update(promoRef, { status: 'ACTIVE', circuitId, spurnedAt: admin.firestore.FieldValue.serverTimestamp() });
        const byeNotice = byePlayer ? ` ${participantData[byePlayer]?.username?.toUpperCase() || byePlayer} ADVANCES WITH BYE.` : '';
        pushGlobalCommand(transaction, circuitId, `🚨 PROMO RUSH DEPLOYED: ${participants.length} OPERATIVES INFILTRATED. ROUND 1 COMMENCED.${byeNotice}`);

      } else if (game === 'CODM') {
        // --- 100-Player Battle Royale Room Spawning ---
        const matchRef = adminDb.collection("matches").doc();
        const players: any = {};
        participants.forEach((uid: string) => {
          players[uid] = {
            ...participantData[uid],
            uid,
            ready: false, // FORCE: Manual Neural Link required for deployment awareness
            team: 'alpha'
          };
        });

        transaction.set(matchRef, {
          game: 'CODM',
          format: 'br',
          challengeFee: 0,
          status: 'WAITING', // Reverted to WAITING to force manual link
          playerIds: participants,
          players,
          maxPlayers: promo.participantLimit,
          creatorId: 'SYSTEM_PROMO',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          isPromo: true,
          promoId: promoId,
          prizeUSD: promo.prizeUSD,
          prizeNGN: promo.prizeNGN,
          roomCode: "PENDING_ADMIN" // Admin needs to set the room ID manually
        });

        transaction.update(promoRef, { status: 'ACTIVE', matchId: matchRef.id, spurnedAt: admin.firestore.FieldValue.serverTimestamp() });
      }
    });

    console.log(`[PromoEngine] Spurn successful for Promo ${promoId}`);
  } catch (error) {
    console.error(`[PromoEngine] Critical Spurn Failure for Promo ${promoId}:`, error);
  }
}

/**
 * PROGRESSION: Handle the next round of a Promo Knockout
 */
export async function handlePromoAdvancement(
  transaction: admin.firestore.Transaction,
  circuitRef: admin.firestore.DocumentReference,
  circuit: any,
  round: string,
  tieWinner: string,
  matchId: string,
  operatorUid: string,
  game: string
) {
  // 1. Unified state update
  const currentRoundWinners = [...(circuit.roundWinners || []), tieWinner];
  const totalMatchesThisRound = circuit.matchesThisRound || 1;
  const matchesCompleted = (circuit.matchesCompleted || 0) + 1;
  const isRoundComplete = matchesCompleted >= totalMatchesThisRound;

  const updateObj: any = {
    matchesCompleted,
    roundWinners: admin.firestore.FieldValue.arrayUnion(tieWinner)
  };

  if (isRoundComplete) {
     if (round === 'FINAL') {
        updateObj.status = 'COMPLETED';
        updateObj.winner = tieWinner;
        updateObj.winnerUid = tieWinner;
     }
  }

  transaction.update(circuitRef, updateObj);

  // 2. Logic execution
  if (isRoundComplete) {
    if (round === 'FINAL') {
      const runnerUpUid = Object.keys(circuit.players).filter(pid => pid !== tieWinner)[0] || null;
      await distributePromoPrizes(transaction, circuitRef, circuit, tieWinner, runnerUpUid);
    } else {
      // Include bye player from previous round if exists
      const winnersWithBye = circuit.byePlayer ? [...currentRoundWinners, circuit.byePlayer] : currentRoundWinners;
      await spawnNextPromoRound(transaction, circuitRef, circuit, winnersWithBye, round, operatorUid);
    }
  }

  return { needsTournamentCleanup: isRoundComplete && round === 'FINAL' };
}

function getRoundIndex(round: string, limit: number): number {
  if (round === 'QR1') return 1;
  if (round === 'QR2') return 2;
  if (round === 'QR3') return 3;
  if (round === 'QR4') return 4;
  if (round === 'QF') return Math.log2(limit) - 2;
  if (round === 'SF') return Math.log2(limit) - 1;
  return Math.log2(limit);
}

function getNextRoundName(currentRound: string, limit: number, winnersRemaining: number): string {
  if (winnersRemaining === 4) return 'SF';
  if (winnersRemaining === 2) return 'FINAL';
  if (winnersRemaining === 8) return 'QF';
  if (currentRound === 'QR1') return 'QR2';
  if (currentRound === 'QR2') return 'QR3';
  if (currentRound === 'QR3') return 'QR4';
  return 'QR_NEXT';
}

async function spawnNextPromoRound(
  transaction: admin.firestore.Transaction,
  circuitRef: admin.firestore.DocumentReference,
  circuit: any,
  winners: string[],
  currentRound: string,
  operatorUid: string
) {
  // EDGE CASE: Only 1 survivor (all opponents disqualified)
  if (winners.length === 1) {
    const soloWinnerUid = winners[0];
    await distributePromoPrizes(transaction, circuitRef, circuit, soloWinnerUid, null);
    const { pushGlobalCommand } = await import("./progression");
    await pushGlobalCommand(
      transaction,
      circuitRef.id,
      `🏆 TOURNAMENT COMPLETE BY ATTRITION! ${circuit.players[soloWinnerUid]?.username.toUpperCase()} IS THE SOLE SURVIVOR AND PROMO RUSH CHAMPION!`
    );
    return;
  }

  const nextRoundName = getNextRoundName(currentRound, circuit.playerIds.length, winners.length);
  const shuffled = [...winners].sort(() => Math.random() - 0.5);
  
  // Handle odd number of winners: last player gets a BYE to next round
  let byePlayer: string | null = null;
  let matchupPlayers = shuffled;
  if (shuffled.length % 2 === 1) {
    byePlayer = shuffled[shuffled.length - 1];
    matchupPlayers = shuffled.slice(0, -1);
    console.log(`[Promo] BYE awarded to ${circuit.players[byePlayer]?.username || byePlayer} in ${nextRoundName}`);
  }
  
  const nextMatchCount = Math.floor(matchupPlayers.length / 2);
  
  const expiresAt = new Date(Date.now() + 120 * 60 * 1000); // Standard 2 Hour Window

  for (let i = 0; i < nextMatchCount; i++) {
    const p1Uid = matchupPlayers[i * 2];
    const p2Uid = matchupPlayers[i * 2 + 1];
    
    const mRef = adminDb.collection("matches").doc();
    transaction.set(mRef, {
      game: circuit.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
      circuitId: circuitRef.id, round: nextRoundName, playerIds: [p1Uid, p2Uid],
      expiresAt, hostUid: p1Uid, isPromo: true,
      players: {
        [p1Uid]: { ...(circuit.players?.[p1Uid] || (nextRoundName === 'FINAL' ? createGhostPlayer(p1Uid, 'alpha') : null)), ready: false, team: 'alpha' },
        [p2Uid]: { ...(circuit.players?.[p2Uid] || (nextRoundName === 'FINAL' ? createGhostPlayer(p2Uid, 'bravo') : null)), ready: false, team: 'bravo' }
      },
      creatorId: operatorUid, createdAt: admin.firestore.FieldValue.serverTimestamp(),
      promoId: circuit.promoId,
      prizeUSD: circuit.totalPool,
      prizeNGN: circuit.prizeNGN
    });

    if (p1Uid !== 'system' && p2Uid !== 'system') {
      pushMatchNotification(transaction, p1Uid, p2Uid, circuit.players?.[p2Uid]?.username || 'Opponent', mRef.id, nextRoundName, '2 Hours');
      pushMatchNotification(transaction, p2Uid, p1Uid, circuit.players?.[p1Uid]?.username || 'Opponent', mRef.id, nextRoundName, '2 Hours');
    }
  }

  const updateObj: any = { 
    roundWinners: [], // Reset for next round
    status: `PROMO_${nextRoundName}`,
    matchesCompleted: 0,
    matchesThisRound: nextMatchCount
  };
  
  // Store bye player if exists
  if (byePlayer) {
    updateObj.byePlayer = byePlayer;
  }
  
  transaction.update(circuitRef, updateObj);

  const { pushGlobalCommand } = await import("./progression");
  const byeNotice = byePlayer ? ` ${circuit.players[byePlayer]?.username?.toUpperCase()} ADVANCES WITH BYE.` : '';
  await pushGlobalCommand(transaction, circuitRef.id, `⚡ ROUND COMPLETE. NEXT PHASE SEEDED: ${nextRoundName.toUpperCase()} DEPLOYED.${byeNotice}`);
}

async function distributePromoPrizes(
  transaction: admin.firestore.Transaction,
  circuitRef: admin.firestore.DocumentReference,
  circuit: any,
  winnerUid: string,
  runnerUpUid: string | null
) {
  if (winnerUid === 'system') {
    transaction.update(circuitRef, { status: 'COMPLETED', prizeStatus: 'SUSPENDED' });
    if (circuit.promoId) {
      const promoRef = adminDb.collection("promo_events").doc(circuit.promoId);
      transaction.update(promoRef, { status: 'CLOSED' });
    }
    const { pushGlobalCommand } = await import("./progression");
    await pushGlobalCommand(transaction, circuitRef.id, `🚨 TOURNAMENT COMPLETE! DOUBLE DISQUALIFICATION IN FINAL: PRIZE POOL SUSPENDED.`);
    return;
  }

  const { pushGlobalCommand } = await import("./progression");
  // Strictly cast to Number to prevent "0" string corruption causing 0 rewards
  const prizeUSD = Number(circuit.totalPool) || 35;
  const prizeNGN = Number(circuit.prizeNGN) || 50000;
  
  // Convert USD prize to Coins (100 coins = $1.00)
  const coinPrize = prizeUSD * 100;

  // Pay winner
  const winRef = adminDb.collection("users").doc(winnerUid);
  transaction.update(winRef, { 
    balanceCoins: admin.firestore.FieldValue.increment(coinPrize),
    championBadge: {
      title: 'PROMO RUSH CHAMPION',
      tournament: circuit.title,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days
      awardedAt: admin.firestore.FieldValue.serverTimestamp()
    }
  });

  // Notify winner
  const winLogRef = adminDb.collection("transactions").doc();
  transaction.set(winLogRef, {
    uid: winnerUid,
    type: "CREDIT",
    category: "PROMO_PRIZE",
    description: `1ST PLACE: ${circuit.title}`,
    amount: coinPrize,
    status: "COMPLETED",
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (circuit.promoId) {
    const promoRef = adminDb.collection("promo_events").doc(circuit.promoId);
    transaction.update(promoRef, { status: 'CLOSED' });
  }

  await pushGlobalCommand(transaction, circuitRef.id, `🏆 TOURNAMENT COMPLETE! ${circuit.players[winnerUid]?.username.toUpperCase() || 'AGENT'} IS THE PROMO RUSH CHAMPION!`);
}

