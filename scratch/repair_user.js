import { adminDb } from '../src/lib/firebase-admin';

async function repairUser(uid: string) {
  console.log(`[Repair] Targeting Operative: ${uid}`);
  
  const userRef = adminDb.collection('users').doc(uid);
  const snap = await userRef.get();
  
  if (!snap.exists) {
    console.error(`[Error] User document not found for ${uid}`);
    return;
  }
  
  const data = snap.data()!;
  
  // Clean up any "tampered" fields that might block security rules
  const updates: any = {
    isBanned: false,
    suspendedUntil: null,
    role: data.role || 'PLAYER',
    isAdmin: data.isAdmin || false
  };
  
  await userRef.update(updates);
  console.log(`[Success] User permissions normalized for ${uid}`);
}

// Check for command line argument
const targetUid = process.argv[2];
if (!targetUid) {
  console.log("Usage: node repair_user.js <UID>");
} else {
  repairUser(targetUid).catch(console.error);
}
