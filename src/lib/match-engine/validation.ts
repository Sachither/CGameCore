import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineMatch, EngineCircuit } from "./types";
import { handleKnockoutAdvancement } from "./progression";

/**
 * VALIDATION: Enforce Absolute Victory (No Draws)
 */
export function validateAbsoluteVictory(scoreFor: number, scoreAgainst: number, format: string, leg?: number | string) {
   if (format === 'tournament' || format === '16_TOURNAMENT') {
      // Autorize draws ONLY for Leg 1 and Leg 2 in aggregate series
      const isSeriesLeg = leg === 1 || leg === 2 || leg === '1' || leg === '2';
      
      if (scoreFor === scoreAgainst && !isSeriesLeg) {
         throw new Error("TACTICAL-ERROR: Absolute Victory required. No draws permitted in knockout combat (Single Leg or Tie-Breaker).");
      }
   }
}

/**
 * RESOLUTION: Handle Technical Win (Single No-Show)
 */
export async function resolveTechnicalWin(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch,
   winnerUid: string
) {
   const opponentId = matchData.playerIds.find(pid => pid !== winnerUid);
   if (!opponentId) throw new Error("No opponent to penalize.");

   // 1. Close Match
   transaction.update(matchRef, {
      status: 'CLOSED',
      championUid: winnerUid,
      technicalWin: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      disputeReason: 'OPPONENT_NO_SHOW',
      [`players.${winnerUid}.scoreFor`]: 2,
      [`players.${opponentId}.scoreFor`]: 0
   });

   // 2. Advance Circuit
   if (matchData.circuitId) {
      const circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
      const circuitSnap = await transaction.get(circuitRef);
      if (circuitSnap.exists) {
         const circuit = circuitSnap.data() as EngineCircuit;

         const updates: any = {
            matchesCompleted: admin.firestore.FieldValue.increment(1)
         };

         const g = matchData.group;
         if (g && circuit.groups?.[g]) {
            updates[`groups.${g}.standings.${winnerUid}.played`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${winnerUid}.wins`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${winnerUid}.pts`] = admin.firestore.FieldValue.increment(3);
            updates[`groups.${g}.standings.${winnerUid}.gf`] = admin.firestore.FieldValue.increment(2);
            updates[`groups.${g}.standings.${opponentId}.played`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${opponentId}.losses`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${opponentId}.ga`] = admin.firestore.FieldValue.increment(2);
         }

         transaction.update(circuitRef, updates);

         const round = matchData.round;
         if (round === 'QF' || round === 'SF' || round === 'QR1') {
            if (round === 'QF' || round === 'SF') {
                const ties = circuit.bracket?.[round === 'QF' ? 'quarters' : 'semis'];
                const tieIdx = (ties || []).findIndex((t: any) => t.p1 === winnerUid || t.p2 === winnerUid);
                 if (tieIdx !== -1) {
                    const tie = (ties || [])[tieIdx];
                    const p1Goals = tie.p1 === winnerUid ? 2 : 0;
                    const p2Goals = tie.p2 === winnerUid ? 2 : 0;
                    await handleKnockoutAdvancement(transaction, circuitRef, circuit, round, tieIdx, '', matchRef.id, winnerUid, matchData.game, p1Goals, p2Goals);
                 }
            }
         }
      }
   }
}

/**
 * RESOLUTION: Handle Double No-Show (Expiry extraction)
 */
export async function resolveDoubleNoShow(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch
) {
   // Mark BOTH as losers, no victory
   transaction.update(matchRef, {
      status: 'CLOSED',
      championUid: null,
      technicalWin: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      disputeReason: 'DOUBLE_NO_SHOW_EXTRACTION',
      [`players.${matchData.playerIds[0]}.scoreFor`]: 0,
      [`players.${matchData.playerIds[1]}.scoreFor`]: 0
   });

   if (matchData.circuitId) {
      const circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
      const circuitSnap = await transaction.get(circuitRef);
      if (circuitSnap.exists) {
         const circuit = circuitSnap.data() as EngineCircuit;

         const updates: any = {
            matchesCompleted: admin.firestore.FieldValue.increment(1)
         };

         const g = matchData.group;
         if (g && circuit.groups?.[g]) {
            updates[`groups.${g}.standings.${matchData.playerIds[0]}.played`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${matchData.playerIds[0]}.losses`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${matchData.playerIds[1]}.played`] = admin.firestore.FieldValue.increment(1);
            updates[`groups.${g}.standings.${matchData.playerIds[1]}.losses`] = admin.firestore.FieldValue.increment(1);
         }

         transaction.update(circuitRef, updates);

         const round = matchData.round;
         if (round === 'QF' || round === 'SF') {
            const ties = circuit.bracket?.[round === 'QF' ? 'quarters' : 'semis'];
            const tieIdx = (ties || []).findIndex((t: any) => t.p1 === matchData.playerIds[0] || t.p2 === matchData.playerIds[0]);
             if (tieIdx !== -1) {
                // ADVANCE WITH NULL WINNER (Double Forfeit)
                await handleKnockoutAdvancement(transaction, circuitRef, circuit, round, tieIdx, '', matchRef.id, 'system', matchData.game, 0, 0);
             }
         }
      }
   }
}
