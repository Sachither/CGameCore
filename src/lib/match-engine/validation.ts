import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineMatch, EngineCircuit } from "./types";
import { handleKnockoutAdvancement, handleLeagueAdvancement } from "./progression";

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
   // Draws are explicitly allowed for format === 'league'
}

/**
 * RESOLUTION: Handle Technical Win (Single No-Show)
 */
export async function resolveTechnicalWin(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch,
   winnerUid: string,
   partnerSnap?: admin.firestore.DocumentSnapshot
) {
   // Find opponent — may be a ghost/system placeholder in finals
   const opponentId = matchData.playerIds.find(pid => pid !== winnerUid) || null;
   const isGhostOpponent = !opponentId || opponentId === 'system' || matchData.players[opponentId]?.username === 'GHOST';

   // READ FIRST
   let circuitSnap: admin.firestore.DocumentSnapshot | null = null;
   let circuitRef: admin.firestore.DocumentReference | null = null;
   if (matchData.circuitId) {
      circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
      circuitSnap = await transaction.get(circuitRef);
      if (circuitSnap.exists) {
         const cData = circuitSnap.data() as EngineCircuit;
         if (cData.isPartnerTournament && cData.creatorId && !partnerSnap) {
            partnerSnap = await transaction.get(adminDb.collection("users").doc(cData.creatorId));
         }
      }
   }

   // 1. Close Match — track ghost opponent score safely
   const matchUpdate: any = {
      status: 'CLOSED',
      championUid: winnerUid,
      technicalWin: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      disputeReason: isGhostOpponent ? 'GHOST_OPPONENT_AUTO_WIN' : 'OPPONENT_NO_SHOW',
      [`players.${winnerUid}.scoreFor`]: 2,
      rewardAmount: matchData.prizeUSD || 0,
      isPromo: !!matchData.isPromo,
   };
   if (opponentId && !isGhostOpponent) {
      matchUpdate[`players.${opponentId}.scoreFor`] = 0;
   }
   transaction.update(matchRef, matchUpdate);

   // NOTE: Promo prize distribution is handled EXCLUSIVELY by the circuit engine
   // (handlePromoAdvancement → distributePromoPrizes). Do NOT award here to prevent
   // double-crediting the winner. The promo advancement below will handle it.

   // 2. Advance Circuit
   if (circuitSnap && circuitSnap.exists && circuitRef) {
      const circuit = circuitSnap.data() as EngineCircuit;

      const updates: any = {
         matchesCompleted: admin.firestore.FieldValue.increment(1)
      };

      const g = matchData.group;
      const isLeague = circuit.format?.includes('LEAGUE');

      if (isLeague && opponentId && !isGhostOpponent) {
         // LEAGUE STANDINGS (Round Robin)
         updates[`standings.${winnerUid}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${winnerUid}.wins`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${winnerUid}.pts`] = admin.firestore.FieldValue.increment(3);
         updates[`standings.${winnerUid}.gf`] = admin.firestore.FieldValue.increment(2);
         updates[`standings.${opponentId}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${opponentId}.losses`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${opponentId}.ga`] = admin.firestore.FieldValue.increment(2);
      } else if (g && circuit.groups?.[g] && opponentId && !isGhostOpponent) {
         // TOURNAMENT GROUP STANDINGS
         updates[`groups.${g}.standings.${winnerUid}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${winnerUid}.wins`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${winnerUid}.pts`] = admin.firestore.FieldValue.increment(3);
         updates[`groups.${g}.standings.${winnerUid}.gf`] = admin.firestore.FieldValue.increment(2);
         updates[`groups.${g}.standings.${opponentId}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${opponentId}.losses`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${opponentId}.ga`] = admin.firestore.FieldValue.increment(2);
      }

      if (!circuit.isPromo) {
         transaction.update(circuitRef, updates);
      }

      if (circuit.isPromo) {
         // Promo: circuit engine handles all prize distribution (single source of truth)
         const { handlePromoAdvancement } = await import("./promo-engine");
         await handlePromoAdvancement(transaction, circuitRef, circuit, matchData.round || '', winnerUid, matchRef.id, 'SYSTEM_PROMO', matchData.game);
      } else if (isLeague) {
         // LEAGUE ADVANCEMENT
         await handleLeagueAdvancement(transaction, circuitRef, circuit, matchData, winnerUid, 2, 0, partnerSnap || undefined);
      } else if (matchData.round === 'FINAL') {
         // Standard final: the winner IS the tournament champion — distribute prizes directly
         const runnerUpUid = opponentId && !isGhostOpponent ? opponentId : null;
         await handleKnockoutAdvancement(transaction, circuitRef, circuit, 'FINAL', -1, winnerUid, matchRef.id, winnerUid, matchData.game);
      } else {
         const round = matchData.round;
         if (round === 'QF' || round === 'SF' || round === 'QR1') {
            if (round === 'QF' || round === 'SF') {
                const ties = circuit.bracket?.[round === 'QF' ? 'quarters' : 'semis'];
                const tieIdx = (ties || []).findIndex((t: any) => t.p1 === winnerUid || t.p2 === winnerUid);
                 if (tieIdx !== -1) {
                    const tie = (ties || [])[tieIdx];
                    const p1Goals = tie.p1 === winnerUid ? 2 : 0;
                    const p2Goals = tie.p2 === winnerUid ? 2 : 0;
                    await handleKnockoutAdvancement(transaction, circuitRef, circuit, round, tieIdx, winnerUid, matchRef.id, winnerUid, matchData.game, p1Goals, p2Goals);
                 }
            } else if (round === 'QR1') {
               await handleKnockoutAdvancement(transaction, circuitRef, circuit, 'QR1', -1, winnerUid, matchRef.id, winnerUid, matchData.game);
            }
         }
      }
   }
}

/**
 * RESOLUTION: Handle Double No-Show (Expiry extraction)
 * Both players lose their coins (no refund). Builder keeps the pool.
 */
export async function resolveDoubleNoShow(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch
) {
   // READ FIRST
   let circuitSnap: admin.firestore.DocumentSnapshot | null = null;
   let circuitRef: admin.firestore.DocumentReference | null = null;
   if (matchData.circuitId) {
      circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
      circuitSnap = await transaction.get(circuitRef);
   }

   const updatesForPlayers: any = {};
   if (matchData.playerIds[0]) updatesForPlayers[`players.${matchData.playerIds[0]}.scoreFor`] = 0;
   if (matchData.playerIds[1]) updatesForPlayers[`players.${matchData.playerIds[1]}.scoreFor`] = 0;

   // Mark BOTH as losers, no victory, NO COINS RETURNED
   transaction.update(matchRef, {
      status: 'CLOSED',
      championUid: null,
      technicalWin: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      disputeReason: 'DOUBLE_NO_SHOW_EXTRACTION',
      ...updatesForPlayers
   });

   // Log the loss for both players (coins already deducted at match creation)
   for (const uid of matchData.playerIds) {
      const logRef = adminDb.collection("transactions").doc();
      transaction.set(logRef, {
         uid,
         type: "DEBIT",
         category: "FORFEIT_LOSS",
         description: "Double No-Show: Coins forfeited. No refund.",
         amount: matchData.challengeFee || 0,
         status: "COMPLETED",
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
   }

   if (circuitSnap && circuitSnap.exists && circuitRef) {
      const circuit = circuitSnap.data() as EngineCircuit;

      const updates: any = {
         matchesCompleted: admin.firestore.FieldValue.increment(1)
      };

      const g = matchData.group;
      const isLeague = circuit.format?.includes('LEAGUE');

      if (isLeague) {
         updates[`standings.${matchData.playerIds[0]}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${matchData.playerIds[0]}.losses`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${matchData.playerIds[1]}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`standings.${matchData.playerIds[1]}.losses`] = admin.firestore.FieldValue.increment(1);
      } else if (g && circuit.groups?.[g]) {
         updates[`groups.${g}.standings.${matchData.playerIds[0]}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${matchData.playerIds[0]}.losses`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${matchData.playerIds[1]}.played`] = admin.firestore.FieldValue.increment(1);
         updates[`groups.${g}.standings.${matchData.playerIds[1]}.losses`] = admin.firestore.FieldValue.increment(1);
      }

      transaction.update(circuitRef, updates);

      if (circuit.isPromo) {
         const { handlePromoAdvancement } = await import("./promo-engine");
         await handlePromoAdvancement(transaction, circuitRef, circuit, matchData.round || '', 'system', matchRef.id, 'SYSTEM_PROMO', matchData.game);
      } else if (isLeague) {
         await handleLeagueAdvancement(transaction, circuitRef, circuit, matchData, null, 0, 0);
      } else {
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
