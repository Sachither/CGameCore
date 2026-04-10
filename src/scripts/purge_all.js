const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

if (!admin.apps.length) {
  const privateKey = process.env.FIREBASE_PRIVATE_KEY 
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n') 
    : undefined;

  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: privateKey,
    })
  });
}

const db = admin.firestore();

async function purgeAll() {
  console.log("--- PURGE ALL INITIATED ---");

  // Delete all circuits
  const circuitsSnap = await db.collection("circuits").get();
  for (const doc of circuitsSnap.docs) {
    console.log(`Deleting circuit: ${doc.id}`);
    await doc.ref.delete();
  }

  // Delete all matches
  const matchesSnap = await db.collection("matches").get();
  for (const doc of matchesSnap.docs) {
    console.log(`Deleting match: ${doc.id}`);
    await doc.ref.delete();
  }

  console.log("--- PURGE COMPLETE ---");
}

purgeAll().catch(console.error);
