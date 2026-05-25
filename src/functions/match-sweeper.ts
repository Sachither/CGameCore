import * as functions from 'firebase-functions';
import sweepExpiredMatches from '@/lib/match-monitor';

// Scheduled Cloud Function: run every 1 hour (configurable)
export const matchSweeper = functions.pubsub.schedule('every 60 minutes').onRun(async (context) => {
  console.log('[MatchSweeper] Triggered scheduled sweep');
  try {
    const res = await sweepExpiredMatches(200);
    console.log('[MatchSweeper] Sweep result:', res);
    return { success: true, result: res };
  } catch (err) {
    console.error('[MatchSweeper] Error during sweep:', err);
    return { success: false, error: String(err) };
  }
});
