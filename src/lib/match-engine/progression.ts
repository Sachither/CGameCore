import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineCircuit, EngineMatch, EngineTie } from "./types";

/**
 * UTILITY: Create Tournament/Circuit Notifications
 */
export async function pushMatchNotification(
   transaction: admin.firestore.Transaction,
   uid: string,
   oppId: string,
   oppName: string,
   matchId: string,
   round: string,
   deadlineText: string
) {
   const nRef = adminDb.collection("users").doc(uid).collection("notifications").doc();
   transaction.set(nRef, {
      type: 'MATCH_INVITE',
      title: `${round} DEPLOYMENT`,
      message: `Mission assigned vs ${oppName}. Deadline: ${deadlineText}.`,
      matchId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
   });
}

/**
 * LOGIC: Handle Single-Elimination Bracket Progression (PURE KNOCKOUT)
 * 🔒 [SECURITY] M-003/M-004 FIX: Validate exact bracket winner counts
 */
 export async function handleKnockoutAdvancement(
    transaction: admin.firestore.Transaction,
    circuitRef: admin.firestore.DocumentReference,
    circuit: EngineCircuit,
    round: string,
    tieIdx: number,
    tieWinner: string,
    matchId: string,
    operatorUid: string,
    game: string,
    p1Goals?: number,
    p2Goals?: number
 ) {
     const is16Player = circuit.format === '16_TOURNAMENT';

     if (round === 'QR1') {
        // Track Round 1 winners
        const mCount = (circuit.matchesCompleted || 0) + 1;
        transaction.update(circuitRef, {
           matchesCompleted: mCount,
           round1Winners: admin.firestore.FieldValue.arrayUnion(tieWinner)
        });

        // When all 8 QR1 matches complete, spawn QF
        const winners = [...(circuit.round1Winners || []), tieWinner];
        // 🔒 [SECURITY] Validate exact count: QR1 should have exactly 8 winners
        if (winners.length > 8) {
           throw new Error(`Invalid QR1 winner count: ${winners.length} (expected 8)`);
        }
        if (winners.length === 8) {
           await spawnQuarterFinals(transaction, circuitRef, { ...circuit, round1Winners: winners }, operatorUid);
        }
        return;
     }

     if (round === 'QF') {
        // Track QF winners
        const qfWinners = [...(circuit.qfWinners || []), tieWinner];
        transaction.update(circuitRef, {
           matchesCompleted: admin.firestore.FieldValue.increment(1),
           qfWinners: admin.firestore.FieldValue.arrayUnion(tieWinner)
        });

        // When all 4 QF matches complete, spawn SF
        // 🔒 [SECURITY] Validate exact count: QF should have exactly 4 winners
        if (qfWinners.length > 4) {
           throw new Error(`Invalid QF winner count: ${qfWinners.length} (expected 4)`);
        }
        if (qfWinners.length === 4) {
           await spawnSemiFinals(transaction, circuitRef, { ...circuit, qfWinners }, operatorUid);
        }
        return;
     }

     if (round === 'SF') {
        // Track SF winners
        const sfWinners = [...(circuit.sfWinners || []), tieWinner];
        transaction.update(circuitRef, {
           matchesCompleted: admin.firestore.FieldValue.increment(1),
           sfWinners: admin.firestore.FieldValue.arrayUnion(tieWinner)
        });

        // When all 2 SF matches complete, spawn Final
        // 🔒 [SECURITY] Validate exact count: SF should have exactly 2 winners
        if (sfWinners.length > 2) {
           throw new Error(`Invalid SF winner count: ${sfWinners.length} (expected 2)`);
        }
        if (sfWinners.length === 2) {
           await spawnFinal(transaction, circuitRef, { ...circuit, sfWinners }, operatorUid);
        }
        return;
     }

     if (round === 'FINAL') {
        // Tournament complete - distribute prizes
        const runnerUpUid = Object.keys(circuit.players).find(pid => pid !== tieWinner);
        await distributeCircuitPrizes(transaction, circuitRef, circuit, tieWinner, runnerUpUid);
        return;
     }
}

/**
 * UTILITY: Post Automated HQ Broadcast to Global Command Comms
 */
export async function pushGlobalCommand(
   transaction: admin.firestore.Transaction,
   competitionId: string,
   text: string
) {
   const cRef = adminDb.collection("competition_chats").doc(competitionId).collection("messages").doc();
   transaction.set(cRef, {
      text,
      senderUid: 'system',
      senderName: 'HQ OVERLORD',
      isSystem: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
   });
}

/**
 * HELPER: Spawn Quarter Finals (Random Pairing)
 */
async function spawnQuarterFinals(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuit: EngineCircuit,
   operatorUid: string
) {
   const winners = circuit.round1Winners || [];
   if (winners.length < 8) return;

   // Shuffle winners for random pairing
   const shuffled = [...winners].sort(() => Math.random() - 0.5);
   const pairs = [];
   for (let i = 0; i < 8; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
   }

   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3 hours

   for (const [p1, p2] of pairs) {
      const mRef = adminDb.collection("matches").doc();
      transaction.set(mRef, {
         game: circuit.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
         circuitId: circuitRef.id, round: 'QF', playerIds: [p1, p2],
         expiresAt, hostUid: p1,
         players: {
            [p1]: { ...circuit.players[p1], ready: false, team: 'alpha', isHost: true },
            [p2]: { ...circuit.players[p2], ready: false, team: 'bravo', isHost: false }
         },
         creatorId: operatorUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify both players
      pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'QF', '3 Hours');
      pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'QF', '3 Hours');
   }

   transaction.update(circuitRef, { status: 'KNOCKOUT_Q' });
   await pushGlobalCommand(transaction, circuitRef.id, `QUARTER FINALS BEGIN! 4 RANDOM MATCHES SEEDED — 3 HOUR DEADLINE.`);
}

/**
 * HELPER: Spawn Semi Finals (Random Pairing)
 */
async function spawnSemiFinals(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuit: EngineCircuit,
   operatorUid: string
) {
   const winners = circuit.qfWinners || [];
   if (winners.length < 4) return;

   // Shuffle winners for random pairing
   const shuffled = [...winners].sort(() => Math.random() - 0.5);
   const pairs = [];
   for (let i = 0; i < 4; i += 2) {
      pairs.push([shuffled[i], shuffled[i + 1]]);
   }

   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3 hours

   for (const [p1, p2] of pairs) {
      const mRef = adminDb.collection("matches").doc();
      transaction.set(mRef, {
         game: circuit.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
         circuitId: circuitRef.id, round: 'SF', playerIds: [p1, p2],
         expiresAt, hostUid: p1,
         players: {
            [p1]: { ...circuit.players[p1], ready: false, team: 'alpha', isHost: true },
            [p2]: { ...circuit.players[p2], ready: false, team: 'bravo', isHost: false }
         },
         creatorId: operatorUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify both players
      pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'SF', '3 Hours');
      pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'SF', '3 Hours');
   }

   transaction.update(circuitRef, { status: 'KNOCKOUT_S' });
   await pushGlobalCommand(transaction, circuitRef.id, `SEMI FINALS BEGIN! 2 RANDOM MATCHES SEEDED — 3 HOUR DEADLINE.`);
}

/**
 * HELPER: Spawn Final Match
 */
async function spawnFinal(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuit: EngineCircuit,
   operatorUid: string
) {
   const winners = circuit.sfWinners || [];
   if (winners.length < 2) return;

   const [p1, p2] = winners;
   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3 hours

   const mRef = adminDb.collection("matches").doc();
   transaction.set(mRef, {
      game: circuit.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
      circuitId: circuitRef.id, round: 'FINAL', playerIds: [p1, p2],
      expiresAt, hostUid: p1,
      players: {
         [p1]: { ...circuit.players[p1], ready: false, team: 'alpha', isHost: true },
         [p2]: { ...circuit.players[p2], ready: false, team: 'bravo', isHost: false }
      },
      creatorId: operatorUid, createdAt: admin.firestore.FieldValue.serverTimestamp()
   });

   transaction.update(circuitRef, { status: 'FINAL' });

   // Notify both players
   pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'FINAL', '3 Hours');
   pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'FINAL', '3 Hours');

   await pushGlobalCommand(transaction, circuitRef.id, `GRAND FINAL! ${circuit.players[p1]?.username?.toUpperCase()} vs ${circuit.players[p2]?.username?.toUpperCase()} — 3 HOUR DEADLINE.`);
}



/**
 * LOGIC: Distribute Circuit Prizes (Final Checkout)
 */
export async function distributeCircuitPrizes(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuitData: EngineCircuit,
   winnerUid: string | null,
   runnerUpUid: string | null
) {
   const totalPlayers = circuitData.format === 'MASTER_CIRCUIT' ? 12 : 16;
   const challengeFee = circuitData.challengeFee || 0;
   const totalStake = totalPlayers * challengeFee;
   
   // Apply 20% Platform Fee
   const platformFee = Math.floor(totalStake * 0.2);
   const netPrizePool = totalStake - platformFee;

   const threshold = 50000; // 50k threshold
   const isSplit = netPrizePool > threshold;

   const finalWinnerUid = winnerUid || (runnerUpUid ? runnerUpUid : null);

   if (!finalWinnerUid) {
      await pushGlobalCommand(transaction, circuitRef.id, "GRAND FINAL CLOSED. DOUBLE DISQUALIFICATION DETECTED. PRIZE POOL SUSPENDED.");
      transaction.update(circuitRef, { status: 'COMPLETED', prizeStatus: 'SUSPENDED' });
      return;
   }

   // 1. Calculate Shares
   let winnerShare = netPrizePool;
   let runnerUpShare = 0;

   if (isSplit && runnerUpUid && winnerUid) {
      winnerShare = Math.floor(netPrizePool * 0.75); // 75% for winner
      runnerUpShare = netPrizePool - winnerShare;    // 25% for runner-up
   }

   // 2. Pay Winner
   const winRef = adminDb.collection("users").doc(finalWinnerUid);
   transaction.update(winRef, { 
      balanceCoins: admin.firestore.FieldValue.increment(winnerShare),
      // TEMPORARY CHAMPION BADGE (24 hours)
      championBadge: {
         title: circuitData.format === '16_TOURNAMENT' ? 'ELITE CHAMPION' : 'MASTER CHAMPION',
         tournament: circuitData.title,
         expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
         awardedAt: admin.firestore.FieldValue.serverTimestamp()
      }
   });
   
   // Ledger entry for Winner
   const winLogRef = adminDb.collection("transactions").doc();
   transaction.set(winLogRef, {
      uid: finalWinnerUid,
      type: "CREDIT",
      category: "TOURNAMENT_PRIZE",
      description: `1ST PLACE: ${circuitData.title}`,
      amount: winnerShare,
      status: "COMPLETED",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
   });

   // 3. Pay Runner Up (if split)
   if (runnerUpShare > 0 && runnerUpUid) {
      const runRef = adminDb.collection("users").doc(runnerUpUid);
      transaction.update(runRef, { 
         balanceCoins: admin.firestore.FieldValue.increment(runnerUpShare),
         // TEMPORARY RUNNER-UP BADGE (24 hours)
         championBadge: {
            title: 'ELITE FINALIST',
            tournament: circuitData.title,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
            awardedAt: admin.firestore.FieldValue.serverTimestamp()
         }
      });
      
      const runLogRef = adminDb.collection("transactions").doc();
      transaction.set(runLogRef, {
         uid: runnerUpUid,
         type: "CREDIT",
         category: "TOURNAMENT_PRIZE",
         description: `2ND PLACE: ${circuitData.title}`,
         amount: runnerUpShare,
         status: "COMPLETED",
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
   }

   // 3b. Track platform payouts and fee revenue
   const statsRef = adminDb.collection("stats").doc("platform_finances");
   transaction.set(statsRef, {
      totalPayouts: admin.firestore.FieldValue.increment(winnerShare + runnerUpShare),
      totalPlatformCut: admin.firestore.FieldValue.increment(platformFee),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
   }, { merge: true });

   // 4. Update Circuit
   transaction.update(circuitRef, { 
      status: 'COMPLETED',
      totalPrizeDistributed: netPrizePool,
      winnerUid: finalWinnerUid,
      runnerUpUid: runnerUpUid || null
   });

   // 5. Final Announcement
   const winnerName = circuitData.players[finalWinnerUid]?.username || "An Operative";
   let broadcast = `CIRCUIT COMPLETE. ${winnerName.toUpperCase()} TAKES THE TITLE AND ${winnerShare.toLocaleString()} COINS.`;
   if (runnerUpShare > 0 && runnerUpUid) {
      const runnerName = circuitData.players[runnerUpUid]?.username || "Opponent";
      broadcast += ` SECOND PLACE: ${runnerName.toUpperCase()} SECURES ${runnerUpShare.toLocaleString()} COINS.`;
   }
   
   await pushGlobalCommand(transaction, circuitRef.id, broadcast);

   // 6. CLEANUP WILL RUN IMMEDIATELY AFTER FINALIZATION
   // Tournament metadata and bracket records are deleted once all payouts and announcements are complete.
}
