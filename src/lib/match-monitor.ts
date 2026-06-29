import admin from 'firebase-admin';
import { adminDb } from './firebase-admin';

/**
 * Sweep expired matches and apply extraction rules.
 * Intended to run from a scheduled worker (Cloud Function / cron).
 */
export async function sweepExpiredMatches(limit = 100) {
  const now = admin.firestore.Timestamp.fromDate(new Date());
  try {
    const expirySnaps = await adminDb
      .collection('matches')
      .where('expiresAt', '<=', now)
      .where('status', 'in', ['WAITING', 'READY', 'WAITING_FOR_OPPONENT', 'RESOLVING'])
      .limit(limit)
      .get();

    const resolutionSnaps = await adminDb
      .collection('matches')
      .where('resolutionEndTime', '<=', now)
      .where('status', 'in', ['WAITING_FOR_OPPONENT', 'RESOLVING'])
      .limit(limit)
      .get();

    const deadlineSnaps = await adminDb
      .collection('matches')
      .where('status', 'in', ['WAITING', 'READY'])
      .limit(limit)
      .get();

    const snapMap = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
    for (const doc of expirySnaps.docs) snapMap.set(doc.id, doc);
    for (const doc of resolutionSnaps.docs) snapMap.set(doc.id, doc);
    for (const doc of deadlineSnaps.docs) {
      const data = doc.data() as any;
      const deadline = data.readyDeadline;
      if (!deadline) continue;
      const deadlineDate = typeof deadline.toDate === 'function'
        ? deadline.toDate()
        : deadline.seconds
          ? new Date(deadline.seconds * 1000)
          : new Date(deadline);
      if (deadlineDate.getTime() <= Date.now()) {
         snapMap.set(doc.id, doc);
      }
    }
    const snaps = Array.from(snapMap.values());
    if (snaps.length === 0) return { success: true, processed: 0 };

    let processed = 0;
    for (const doc of snaps) {
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

          const lobbyPlayers = matchData.playerIds?.length || 0;
          const requiredPlayers = matchData.maxPlayers || 2;
          if (matchData.status === 'WAITING' && lobbyPlayers < requiredPlayers) {
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
          } else if (readyCount === 1 && claimCount === 0) {
            const readyPlayerUid = (playersList.find((p: any) => p.ready) as any)?.uid;
            if (readyPlayerUid) {
              const { resolveTechnicalWin } = await import('@/lib/match-engine/validation');
              await resolveTechnicalWin(transaction, matchRef, matchData as any, readyPlayerUid);
            }
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
        const { dispatchMatchResolutionNotifications } = await import('@/app/actions/match-actions');
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
