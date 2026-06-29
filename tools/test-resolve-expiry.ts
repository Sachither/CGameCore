import admin from 'firebase-admin';
import { adminDb } from '../src/lib/firebase-admin';
import { adminResolveExpiredMatchAction, adminRunExpiredMatchSweepAction } from '../src/app/actions/admin-actions';

async function run() {
  try {
    // This script assumes local emulator or service account credentials are available.
    // Provide path to service account via GOOGLE_APPLICATION_CREDENTIALS or run the Firebase emulator.

    console.log('Starting expiry resolution test');

    // 1) List expired matches (admin action)
    const dummyToken = 'EMULATOR_ADMIN_TOKEN';
    try {
      const res = await (adminRunExpiredMatchSweepAction as any)(dummyToken, 10);
      console.log('Sweep result:', res);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('Sweep failed (expected if running without emulator/admin token):', msg);
    }

    // Note: adminResolveExpiredMatchAction requires a real token and a matchId. Manual testing is recommended
    // by copying an expired matchId from the DB and invoking adminResolveExpiredMatchAction with proper credentials.

    console.log('Completed (partial) automated test.');
  } catch (err) {
    console.error('Test harness error:', err);
    process.exit(1);
  }
}

run();
