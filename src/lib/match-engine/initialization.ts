import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineCircuit, EngineMatch, EnginePlayer } from "./types";
import { pushMatchNotification, pushGlobalCommand } from "./progression";

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
   const circuitRef = adminDb.collection("circuits").doc();
   const circuitId = circuitRef.id;
   
   const allPlayers = playersList;
   // 🔒 [SECURITY] M-001 FIX: Prevent double initialization race condition
   // Check for existing circuitId or if status indicates already initializing/resolving
   if (matchData.circuitId || matchData.status === 'CLOSED' || matchData.status === 'RESOLVING') {
      console.warn("[Engine] Attempted re-initialization of an active or resolved combat sector. Aborting.");
      return matchData.circuitId || null;
   }
   
   const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
   const format = '16_TOURNAMENT';
   const fee = matchData.challengeFee || 0;
   const playersMap = matchData.players;

   // Deduplicate players by UID to prevent duplicates
   const uniquePlayers = allPlayers.filter((player, index, arr) => arr.findIndex(p => p.uid === player.uid) === index);

   // Validate exactly 16 players for tournament
   if (uniquePlayers.length !== 16) {
      console.error(`[Engine] Invalid player count for tournament: ${uniquePlayers.length} (expected 16)`);
      throw new Error(`Tournament requires exactly 16 players, got ${uniquePlayers.length}`);
   }

   // HQ BROADCAST: Tournament Start
   pushGlobalCommand(transaction, circuitId, `INITIALIZING SECTOR OPS: ${format.toUpperCase()} DEPLOYMENT CONFIRMED. Prize pool locked: ${Math.floor(fee * uniquePlayers.length * 0.8)} CR.`);

   // --- ELITE TOURNAMENT (16P): Direct Knockout ---
   const expiresAt = new Date(Date.now() + 3 * 3600 * 1000); // 3h Round 1
   for (let i = 0; i < 8; i++) {
         const p1 = shuffled[i * 2];
         const p2 = shuffled[i * 2 + 1];
         const mRef = adminDb.collection("matches").doc();
         transaction.set(mRef, {
            game: matchData.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
            circuitId, round: 'QR1', leg: 'NONE', playerIds: [p1.uid, p2.uid], gatheringRoomId: matchRef.id,
            expiresAt,
            players: {
               [p1.uid]: { ...p1, ready: false, team: 'alpha' },
               [p2.uid]: { ...p2, ready: false, team: 'bravo' }
            },
            creatorId: uid, createdAt: admin.firestore.FieldValue.serverTimestamp()
         });

         [p1, p2].forEach(p => {
            const opp = p.uid === p1.uid ? p2 : p1;
            pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, 'TOURNAMENT R16', "3 Hours");
         });
      }

   transaction.set(circuitRef, {
      title: `${matchData.game} ELITE KNOCKOUT #${circuitId.slice(0, 4)}`,
      game: matchData.game, format: '16_TOURNAMENT', challengeFee: fee, status: 'KNOCKOUT_Q',
      playerIds: uniquePlayers.map(p => p.uid),
      players: playersMap, 
      totalPool: Math.floor(fee * 16 * 0.8),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      matchesCompleted: 0
   });

   return circuitId;
}
