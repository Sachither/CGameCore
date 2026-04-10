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

async function deleteCollection(collectionName) {
  console.log(`Deleting all documents in: ${collectionName}`);
  const snap = await db.collection(collectionName).get();
  for (const doc of snap.docs) {
    try {
      await doc.ref.delete();
      console.log(`Deleted ${doc.id}`);
    } catch (e) {
      console.error(`Failed to delete ${doc.id}:`, e.message);
    }
  }
}

async function start() {
  try {
    await deleteCollection("matches");
    await deleteCollection("circuits");
    console.log("Purge complete.");
  } catch (e) {
    console.error("Master purge failed:", e);
  }
}

start();
