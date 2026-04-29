import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineCircuit, EngineMatch, EnginePlayer } from "./types";
import { pushMatchNotification, pushGlobalCommand } from "./progression";
import { getSystemConfig } from "@/lib/system-config-server";

/**
 * INITIALIZATION: Create a new Circuit (Master or Elite) from a lobby
 */
export async function initializeCircuit(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch,
   playersList: EnginePlayer[],
   uid: string
) {
   const config = await getSystemConfig();
   const circuitRef = adminDb.collection("circuits").doc();
   const circuitId = circuitRef.id;
   
   const allPlayers = playersList;
   if (matchData.circuitId || matchData.status === 'CLOSED' || matchData.status === 'RESOLVING') {
      console.warn("[Engine] Attempted re-initialization of an active or resolved combat sector. Aborting.");
      return matchData.circuitId || null;
   }
   
   const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
   const fee = matchData.challengeFee || 0;
   // Deduplicate players by UID
   const uniquePlayers = allPlayers.filter((player, index, arr) => arr.findIndex(p => p.uid === player.uid) === index);
   const pCount = uniquePlayers.length;

   // Build fresh players map from the unique list to avoid stale snapshot data
   const playersMap: Record<string, any> = {};
   uniquePlayers.forEach(p => {
      playersMap[p.uid] = { ...p, ready: true };
   });

   // Validate power of 2 (2, 4, 8, 16)
   const allowedCounts = [2, 4, 8, 16];
   if (!allowedCounts.includes(pCount)) {
      throw new Error(`Tournament scaling error: Supported counts are 2, 4, 8, or 16 players. Got ${pCount}.`);
   }

   const format = `${pCount}_TOURNAMENT`;
   const totalPool = Math.floor(fee * pCount * (1 - config.matchFeePercentage));

   // HQ BROADCAST: Tournament Start
   pushGlobalCommand(transaction, circuitId, `INITIALIZING SECTOR OPS: ${format.toUpperCase()} DEPLOYMENT CONFIRMED. Prize pool locked: ${totalPool} CR.`);

   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3h standard window
   let initialRound = 'QR1';
   let pairsCount = 8;

   if (pCount === 2) { initialRound = 'FINAL'; pairsCount = 1; }
   else if (pCount === 4) { initialRound = 'SF'; pairsCount = 2; }
   else if (pCount === 8) { initialRound = 'QF'; pairsCount = 4; }

   // SEEDING
   for (let i = 0; i < pairsCount; i++) {
      const p1 = shuffled[i * 2];
      const p2 = shuffled[i * 2 + 1];
      const mRef = adminDb.collection("matches").doc();
      transaction.set(mRef, {
         game: matchData.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
         circuitId, round: initialRound, leg: 'NONE', playerIds: [p1.uid, p2.uid], gatheringRoomId: matchRef.id,
         expiresAt,
         players: {
            [p1.uid]: { ...p1, ready: false, team: 'alpha' },
            [p2.uid]: { ...p2, ready: false, team: 'bravo' }
         },
         creatorId: matchData.creatorId || uid, 
         isPartnerTournament: !!matchData.isPartnerTournament,
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      [p1, p2].forEach(p => {
         const opp = p.uid === p1.uid ? p2 : p1;
         pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, initialRound, "3 Hours");
      });
   }

   transaction.set(circuitRef, {
      title: `${matchData.game} ELITE SERIES #${circuitId.slice(0, 4)}`,
      game: matchData.game, format, challengeFee: fee, 
      status: pCount === 2 ? 'KNOCKOUT_F' : (pCount === 4 ? 'KNOCKOUT_S' : (pCount === 8 ? 'KNOCKOUT_Q' : 'KNOCKOUT_Q')),
      playerIds: uniquePlayers.map(p => p.uid),
      players: playersMap, 
      totalPool,
      creatorId: matchData.creatorId || uid,
      isPartnerTournament: !!matchData.isPartnerTournament,
      partnerName: matchData.partnerName || 'Partner',
      quota: pCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      matchesCompleted: 0
   });

   return circuitId;
}
