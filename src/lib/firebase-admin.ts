import admin from "firebase-admin";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { Storage } from "firebase-admin/storage";

/**
 * Firebase Admin SDK - Server Side ONLY
 * Hardened initialization with defensive exports.
 */

function getOrInitializeApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  
  // CRITICAL FIX: Sanitize private key.
  // 1. Remove surrounding quotes that often get included by Next.js/Windows .env parsing
  // 2. Convert escaped literal \n strings to actual newline characters
  // 3. Remove Windows carriage returns (\r)
  let privateKey = process.env.FIREBASE_PRIVATE_KEY?.trim();
  
  if (privateKey) {
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    privateKey = privateKey.replace(/\\n/g, "\n").replace(/\r/g, "");
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "[FirebaseAdmin] MISSING ENV VARS. Check: FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, NEXT_PUBLIC_FIREBASE_PROJECT_ID\n",
      { hasProjectId: !!projectId, hasClientEmail: !!clientEmail, hasPrivateKey: !!privateKey }
    );
    throw new Error("Firebase Admin SDK is not configured. Missing environment variables.");
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    databaseURL: `https://${projectId}.firebaseio.com`,
  });
}

// Initialize the app eagerly and catch errors clearly
let app: admin.app.App;
try {
  app = getOrInitializeApp();
} catch (error) {
  console.error("[FirebaseAdmin] CRITICAL: Could not initialize Firebase Admin SDK.", error);
  // Re-throw so Next.js surfaces the real error, not a confusing "app does not exist" message
  throw error;
}

export const adminAuth: Auth = app.auth();
export const adminDb: Firestore = app.firestore();
export const adminStorage: Storage = app.storage();
export default admin;
