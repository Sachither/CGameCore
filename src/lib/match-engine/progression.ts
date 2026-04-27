import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineCircuit, EngineMatch, EngineTie } from "./types";

/**
 * UTILITY: Create Ghost Player Object (for eliminated/missing players)
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
    p2Goals?: number,
    partnerSnap?: admin.firestore.DocumentSnapshot
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
        // Expect exactly 4 QF winners (no byes possible since 4 matches = 4 winners)
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

        // When all SF matches complete, spawn Final
        // With bye system: if started with odd players, one had a bye
        // So we expect: number of SF matches (which is floor(QF winners / 2))
        const initialQFWinners = circuit.qfWinners?.length || 0;
        const expectedSFMatches = 2;
        
        if (sfWinners.length === expectedSFMatches) {
           await spawnFinal(transaction, circuitRef, { ...circuit, sfWinners }, operatorUid);
        }
        return;
     }

        // Tournament complete - distribute prizes
        const runnerUpUid = Object.keys(circuit.players).find(pid => pid !== tieWinner) || null;
        await distributeCircuitPrizes(transaction, circuitRef, circuit, tieWinner, runnerUpUid, partnerSnap);
        return;
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
         creatorId: (circuit as any).creatorId || operatorUid, 
         isPartnerTournament: !!(circuit as any).isPartnerTournament,
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify both players
      pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'QF', '3 Hours');
      pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'QF', '3 Hours');
   }

   transaction.update(circuitRef, { status: 'KNOCKOUT_Q' });
   await pushGlobalCommand(transaction, circuitRef.id, `QUARTER FINALS BEGIN! 4 RANDOM MATCHES SEEDED — 3 HOUR DEADLINE.`);
}

/**
 * HELPER: Spawn Semi Finals (Random Pairing + BYE for odd winners)
 */
async function spawnSemiFinals(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuit: EngineCircuit,
   operatorUid: string
) {
   const winners = circuit.qfWinners || [];
   if (winners.length < 2) return;

   // Shuffle winners for random pairing
   const shuffled = [...winners].sort(() => Math.random() - 0.5);
   
   // Handle odd number of winners: last player gets a BYE to Finals
   let byePlayer: string | null = null;
   let matchupPlayers = shuffled;
   if (shuffled.length % 2 === 1) {
      byePlayer = shuffled[shuffled.length - 1];
      matchupPlayers = shuffled.slice(0, -1);
      console.log(`[SF] BYE awarded to ${circuit.players[byePlayer]?.username || byePlayer}`);
   }

   const pairs = [];
   for (let i = 0; i < matchupPlayers.length; i += 2) {
      pairs.push([matchupPlayers[i], matchupPlayers[i + 1]]);
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
         creatorId: (circuit as any).creatorId || operatorUid, 
         isPartnerTournament: !!(circuit as any).isPartnerTournament,
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Notify both players
      pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'SF', '3 Hours');
      pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'SF', '3 Hours');
   }

   // Store bye player for finals
   if (byePlayer) {
      transaction.update(circuitRef, { 
         status: 'KNOCKOUT_S',
         sfByePlayer: byePlayer
      });
   } else {
      transaction.update(circuitRef, { status: 'KNOCKOUT_S' });
   }
   
   await pushGlobalCommand(transaction, circuitRef.id, `SEMI FINALS BEGIN!${byePlayer ? ` ${circuit.players[byePlayer]?.username?.toUpperCase()} ADVANCES WITH BYE.` : ''} ${pairs.length} MATCHES SEEDED — 3 HOUR DEADLINE.`);
}

/**
 * HELPER: Spawn Final Match (+ BYE player from SF if exists)
 */
async function spawnFinal(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuit: EngineCircuit,
   operatorUid: string
) {
   const winners = circuit.sfWinners || [];
   const byePlayer = circuit.sfByePlayer || null;
   
   // Winners + bye player should result in 2 finalists
   const finalPlayers = byePlayer ? [...winners, byePlayer] : winners;
   if (finalPlayers.length < 2) return;

   const [p1, p2] = finalPlayers.slice(0, 2);
   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3 hours

   const mRef = adminDb.collection("matches").doc();
   transaction.set(mRef, {
      game: circuit.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
      circuitId: circuitRef.id, round: 'FINAL', playerIds: [p1, p2],
      expiresAt, hostUid: p1,
      players: {
            [p1]: { ...(circuit.players[p1] || createGhostPlayer(p1, 'alpha')), ready: false, team: 'alpha', isHost: true },
            [p2]: { ...(circuit.players[p2] || createGhostPlayer(p2, 'bravo')), ready: false, team: 'bravo', isHost: false }
      },
      creatorId: (circuit as any).creatorId || operatorUid, 
      isPartnerTournament: !!(circuit as any).isPartnerTournament,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
   });
   
   pushMatchNotification(transaction, p1, p2, circuit.players[p2]?.username || 'Opponent', mRef.id, 'FINAL', '3 Hours');
   pushMatchNotification(transaction, p2, p1, circuit.players[p1]?.username || 'Opponent', mRef.id, 'FINAL', '3 Hours');

   transaction.update(circuitRef, { status: 'KNOCKOUT_F' });
   const byeNotice = (byePlayer && p2 === byePlayer) ? ' (BYE ADVANCE)' : '';
   await pushGlobalCommand(transaction, circuitRef.id, `GRAND FINAL! ${circuit.players[p1]?.username?.toUpperCase()} vs ${circuit.players[p2]?.username?.toUpperCase()}${byeNotice} — 3 HOUR DEADLINE.`);
}



/**
 * LOGIC: Distribute Circuit Prizes (Final Checkout)
 */
export async function distributeCircuitPrizes(
   transaction: admin.firestore.Transaction,
   circuitRef: admin.firestore.DocumentReference,
   circuitData: EngineCircuit,
   winnerUid: string | null,
   runnerUpUid: string | null,
   partnerSnap?: admin.firestore.DocumentSnapshot // Optional pre-fetched snap
) {
    const totalPlayers = Object.keys(circuitData.players || {}).length;
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

   // [PROMO-OVERRIDE] If this is a promo circuit, use the fixed prize pool
   if (circuitData.isPromo) {
      const prizeUSD = Number(circuitData.totalPool) || 35;
      winnerShare = prizeUSD * 100;
   }

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
      category: circuitData.isPromo ? "PROMO_PRIZE" : "TOURNAMENT_PRIZE",
      description: `1ST PLACE: ${circuitData.title}`,
      amount: winnerShare,
      status: "COMPLETED",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
   });

   // 2.1 Update the FINAL match document for History & Notifications
   const matchesSnap = await adminDb.collection("matches")
      .where("circuitId", "==", circuitRef.id)
      .where("round", "==", "FINAL")
      .limit(1)
      .get();
   
   if (!matchesSnap.empty) {
      transaction.update(matchesSnap.docs[0].ref, {
         championUid: finalWinnerUid,
         rewardAmount: winnerShare,
         status: 'CLOSED', // Ensure it's marked as finished for history
         resolvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
   }

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

   // 3b. Handle Partner Commission & Platform Finances
   const isPartnerTournament = !!(circuitData as any).isPartnerTournament;
   const creatorId = (circuitData as any).creatorId;
   let partnerCommission = 0;

   if (isPartnerTournament && creatorId) {
      const partnerRef = adminDb.collection("users").doc(creatorId);
      // Use pre-fetched snap if available, otherwise we risk a read-after-write error
      const pSnap = partnerSnap || await transaction.get(partnerRef);
      
      if (pSnap.exists) {
         const partnerData = pSnap.data()!;
         const expiryDate = partnerData.partnerExpiresAt?.seconds ? new Date(partnerData.partnerExpiresAt.seconds * 1000) : null;
         
         // 🔒 [CONTRACT CHECK] Only pay if Partner Contract is active
         if (partnerData.role === 'PARTNER' && expiryDate && expiryDate > new Date()) {
            partnerCommission = Math.floor(platformFee * 0.5);
            if (partnerCommission > 0) {
               transaction.update(partnerRef, {
                  balanceCoins: admin.firestore.FieldValue.increment(partnerCommission)
               });
      
               const partLogRef = adminDb.collection("transactions").doc();
               transaction.set(partLogRef, {
                  uid: creatorId,
                  type: "CREDIT",
                  category: "PARTNER_COMMISSION",
                  description: `Partner Revenue Share: ${circuitData.title} (#${circuitRef.id.slice(-6)})`,
                  amount: partnerCommission,
                  status: "COMPLETED",
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
               });
            }
         } else {
            console.log(`[TournamentCommission] Creator ${creatorId} contract expired. Rake reverts to platform.`);
         }
      }
   }

   const statsRef = adminDb.collection("stats").doc("platform_finances");
   transaction.set(statsRef, {
      totalPayouts: admin.firestore.FieldValue.increment(winnerShare + runnerUpShare + partnerCommission),
      totalPlatformCut: admin.firestore.FieldValue.increment(platformFee - partnerCommission),
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
