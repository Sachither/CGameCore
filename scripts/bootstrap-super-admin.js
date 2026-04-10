/**
 * ONE-TIME BOOTSTRAP SCRIPT: Initialize First SUPER_ADMIN
 *
 * This script should be run ONCE to create the first SUPER_ADMIN account.
 * After running, DELETE this file immediately for security.
 *
 * Usage: node scripts/bootstrap-super-admin.js <uid>
 * Example: node scripts/bootstrap-super-admin.js abc123def456
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin
const serviceAccount = require('../firebase-service-account.json'); // You'll need to create this
initializeApp({
  credential: cert(serviceAccount),
  projectId: process.env.FIREBASE_PROJECT_ID || 'cgame-dev'
});

const auth = getAuth();
const db = getFirestore();

async function bootstrapSuperAdmin(uid) {
  if (!uid) {
    console.error('❌ Error: UID is required');
    console.log('Usage: node scripts/bootstrap-super-admin.js <uid>');
    process.exit(1);
  }

  try {
    console.log(`🔄 Setting up SUPER_ADMIN for UID: ${uid}`);

    // 1. Set custom claims for SUPER_ADMIN
    await auth.setCustomUserClaims(uid, {
      role: 'SUPER_ADMIN',
      isAdmin: true,
      isSuperAdmin: true
    });

    // 2. Update Firestore user document
    await db.collection('users').doc(uid).update({
      role: 'SUPER_ADMIN',
      isAdmin: true,
      updatedAt: new Date(),
      bootstrappedAt: new Date()
    });

    // 3. Create audit log entry
    await db.collection('admin_audit_log').add({
      action: 'super_admin_bootstrap',
      adminUid: uid,
      targetUid: uid,
      details: {
        reason: 'Initial SUPER_ADMIN bootstrap',
        method: 'bootstrap_script'
      },
      timestamp: new Date(),
      severity: 'CRITICAL'
    });

    console.log('✅ SUCCESS: SUPER_ADMIN role assigned!');
    console.log(`👤 User ${uid} is now SUPER_ADMIN`);
    console.log('');
    console.log('⚠️  SECURITY WARNING: Delete this script immediately!');
    console.log('🔒 Run: rm scripts/bootstrap-super-admin.js');

  } catch (error) {
    console.error('❌ Error bootstrapping SUPER_ADMIN:', error);
    process.exit(1);
  }
}

// Get UID from command line arguments
const uid = process.argv[2];
bootstrapSuperAdmin(uid);