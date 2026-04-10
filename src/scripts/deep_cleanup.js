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

async function deepCleanup() {
  console.log("--- EMERGENCY DEEP CLEANUP INITIATED ---");

  // 1. Force Close Specifically Named Circuits (WuHo)
  const circuitsSnap = await db.collection("circuits").get();
  for (const doc of circuitsSnap.docs) {
    const data = doc.data();
    if (data.title && data.title.includes("#WuHo") && data.status !== 'COMPLETED') {
      console.log(`Force closing circuit: ${data.title} (${doc.id})`);
      await doc.ref.update({ status: 'COMPLETED', adminNote: "Deep Cleanup: User requested closure" });
      
      // Also close all associated matches for this circuit
      const associatedMatches = await db.collection("matches").where("circuitId", "==", doc.id).get();
      for (const mDoc of associatedMatches.docs) {
        if (mDoc.data().status !== 'CLOSED' && mDoc.data().status !== 'COMPLETED') {
          await mDoc.ref.update({ status: 'CLOSED', adminNote: "Deep Cleanup: Parent circuit closed" });
        }
      }
    }
  }

  // 2. Force Close Specific Gathering Rooms
  const matchesSnap = await db.collection("matches")
    .where("format", "in", ["league", "tournament"])
    .get();

  for (const doc of matchesSnap.docs) {
    const data = doc.data();
    // Close anything that is a gathering room and currently in WAITING/READY state if it's "rubbish"
    // User mentioned: "EFOOTBALL MASTER CIRCUIT (GATHERING)" with 2/12 PLYRs
    if (data.status === 'WAITING' || data.status === 'READY') {
       console.log(`Force closing gathering lobby: ${doc.id} (Players: ${data.playerIds?.length || 0})`);
       
       // Refund players if they have stakes
       const players = Object.keys(data.players || {});
       const fee = data.challengeFee || 0;

       await db.runTransaction(async (transaction) => {
         if (fee > 0) {
           for (const uid of players) {
             transaction.update(db.collection("users").doc(uid), {
               balanceCoins: admin.firestore.FieldValue.increment(fee),
               lifetimeWagered: admin.firestore.FieldValue.increment(-fee)
             });
           }
         }
         transaction.update(doc.ref, { status: 'CLOSED', adminNote: "Deep Cleanup: User requested closure of gathering lobby" });
       });
    }
  }

  console.log("--- DEEP CLEANUP COMPLETE ---");
}

deepCleanup().catch(console.error);
