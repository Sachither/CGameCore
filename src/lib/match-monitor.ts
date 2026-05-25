import admin from 'firebase-admin';
import { adminDb } from './firebase-admin';

/**
 * Sweep expired matches and apply extraction rules.
 * Intended to run from a scheduled worker (Cloud Function / cron).
 */
export async function sweepExpiredMatches(limit = 100) {
  const now = admin.firestore.Timestamp.fromDate(new Date());
  try {
    const snaps = await adminDb
      .collection('matches')
      .where('expiresAt', '<=', now)
      .where('status', 'in', ['WAITING', 'WAITING_FOR_OPPONENT', 'RESOLVING'])
      .limit(limit)
      .get();

    if (snaps.empty) return { success: true, processed: 0 };

    let processed = 0;
    for (const doc of snaps.docs) {
      const matchId = doc.id;
      try {
        await adminDb.runTransaction(async (transaction) => {
          const matchRef = adminDb.collection('matches').doc(matchId);
          const matchSnap = await transaction.get(matchRef);
          if (!matchSnap.exists) return;
          const matchData = matchSnap.data() as any;
          if (matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') return;

          const playersList = Object.values(matchData.players || {});
          const readyCount = playersList.filter((p: any) => p.ready).length;
          const claimCount = playersList.filter((p: any) => p.claim).length;

          if (matchData.status === 'WAITING') {
            // Refund creators for pure WAITING lobbies
            for (const pid of matchData.playerIds || []) {
              transaction.update(adminDb.collection('users').doc(pid), {
                balanceCoins: admin.firestore.FieldValue.increment(matchData.challengeFee || 0),
              });
              const logRef = adminDb.collection('transactions').doc();
              transaction.set(logRef, {
                uid: pid,
                type: 'CREDIT',
                category: 'MATCH_REFUND',
                description: 'Matchmaking expired before opponent joined. Refund processed.',
                amount: matchData.challengeFee || 0,
                status: 'COMPLETED',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
              });
            }
            transaction.update(matchRef, {
              status: 'CLOSED',
              disputeReason: 'MATCHMAKING_EXPIRED_REFUNDED',
              resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            return;
          }

          if (readyCount === 0 || (readyCount === playersList.length && claimCount === 0)) {
            const { resolveDoubleNoShow } = await import('@/lib/match-engine/validation');
            await resolveDoubleNoShow(transaction, matchRef, matchData as any);
          } else if (claimCount === 1) {
            const claimantUid = Object.keys(matchData.players).find((pid) => !!(matchData.players[pid] as any).claim);
            if (claimantUid) {
              const claim = (matchData.players[claimantUid] as any).claim;
              let winnerUid = claimantUid;
              if (claim === 'LOSS') {
                winnerUid = Object.keys(matchData.players).find((pid) => pid !== claimantUid) || claimantUid;
              }
              const { resolveTechnicalWin } = await import('@/lib/match-engine/validation');
              await resolveTechnicalWin(transaction, matchRef, matchData as any, winnerUid);
            }
          } else {
            // leave for manual resolution or tribunal
            return;
          }
        });
        // Post-process notifications
        const { dispatchMatchResolutionNotifications } = await import('@/lib/match-engine/progression');
        await dispatchMatchResolutionNotifications(matchId, 'RESOLVED');
        processed++;
      } catch (err) {
        console.error(`[MatchMonitor] Failed to process ${matchId}:`, err);
        continue;
      }
    }

    return { success: true, processed };
  } catch (error) {
    console.error('[MatchMonitor] Sweep error:', error);
    return { success: false, error };
  }
}

export default sweepExpiredMatches;
