import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';

// Load env vars from .env.local
dotenv.config({ path: '.env.local' });

const project_id = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const client_email = process.env.FIREBASE_CLIENT_EMAIL;
const private_key = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!project_id || !client_email || !private_key) {
  console.error("Missing Firebase Admin credentials in .env.local");
  process.exit(1);
}

if (!getApps().length) {
  initializeApp({
    credential: cert({
      projectId: project_id,
      clientEmail: client_email,
      privateKey: private_key
    })
  });
}

const db = getFirestore();

async function purgeCollection(collectionName) {
  console.log(`[Cleanup] Scanning ${collectionName}...`);
  const snap = await db.collection(collectionName).get();
  console.log(`[Cleanup] Found ${snap.size} documents in ${collectionName}.`);
  
  if (snap.empty) return;

  const batchSize = 500;
  let count = 0;
  
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += batchSize) {
    const batch = db.batch();
    const chunk = docs.slice(i, i + batchSize);
    chunk.forEach(doc => {
      batch.delete(doc.ref);
      count++;
    });
    await batch.commit();
    console.log(`[Cleanup] Committed deletion for ${count}/${snap.size} docs in ${collectionName}...`);
  }
}

async function runCleanup() {
  console.log("--- TACTICAL CLEANUP PROTOCOL INITIATED ---");
  try {
    // 1. Purge Promo Events
    await purgeCollection('promo_events');
    
    // 2. Purge Circuits (Tournaments)
    await purgeCollection('circuits');
    
    // 3. Purge Match Lobbies
    await purgeCollection('matches');
    
    console.log("--- CLEAN SLATE ACHIEVED ---");
    process.exit(0);
  } catch (err) {
    console.error("CRITICAL FAILURE DURING CLEANUP:", err);
    process.exit(1);
  }
}

runCleanup();
