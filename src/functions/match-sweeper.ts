import { onSchedule } from 'firebase-functions/v2/scheduler';
import sweepExpiredMatches from '@/lib/match-monitor';

// Scheduled Cloud Function: run every 1 hour (configurable)
export const matchSweeper = onSchedule({ schedule: 'every 60 minutes' }, async (event: any) => {
  console.log('[MatchSweeper] Triggered scheduled sweep');
  try {
    const res = await sweepExpiredMatches(200);
    console.log('[MatchSweeper] Sweep result:', res);
  } catch (err) {
    console.error('[MatchSweeper] Error during sweep:', err);
  }
});
