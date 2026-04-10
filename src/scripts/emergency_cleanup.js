const admin = require("firebase-admin");
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

// Load Environment Variables from .env.local
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

async function cleanup() {
  console.log("--- TACTICAL CLEANUP INITIATED ---");

  // 1. Find all gathering rooms (matches with format league/tournament)
  const matchesSnap = await db.collection("matches")
    .where("format", "in", ["league", "tournament"])
    .get();

  const gatheringRooms = matchesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  const closedGatheringIds = gatheringRooms.filter(m => m.status === 'CLOSED').map(m => m.id);

  console.log(`Found ${gatheringRooms.length} gathering rooms, ${closedGatheringIds.length} are CLOSED.`);

  // 2. Find and close orphaned matches (matches belonging to a closed/stale circuit or closed gathering room)
  const allMatchesSnap = await db.collection("matches").get();
  let orphanedCount = 0;

  for (const doc of allMatchesSnap.docs) {
    const data = doc.data();
    // If it's a sub-match (has circuitId or gatheringRoomId) but not a gathering room itself
    if ((data.circuitId || data.gatheringRoomId) && !['league', 'tournament'].includes(data.format)) {
      
      const shouldClose = closedGatheringIds.includes(data.gatheringRoomId) || 
                          (data.status === 'WAITING' && data.createdAt?.toDate() < new Date(Date.now() - 24 * 60 * 60 * 1000));

      if (shouldClose && data.status !== 'CLOSED' && data.status !== 'COMPLETED') {
        console.log(`Closing orphaned match ${doc.id} (Circuit: ${data.circuitId})`);
        await doc.ref.update({ status: 'CLOSED', adminNote: "Cleanup: Orphaned sub-match" });
        orphanedCount++;
      }
    }
  }

  // 3. ENFORCE SINGLETON: Close duplicate WAITING gathering rooms
  const waitingLeagues = gatheringRooms.filter(m => m.status === 'WAITING');
  const tiers = {}; // key: game_format_fee

  for (const m of waitingLeagues) {
    const key = `${m.game}_${m.format}_${m.challengeFee}`;
    if (!tiers[key]) {
      tiers[key] = m; // Keep the first one found (the "legitimate" one)
    } else {
      // Duplicate!
      console.log(`Closing duplicate waiting room ${m.id} for tier ${key}`);
      const players = Object.keys(m.players || {});
      const fee = m.challengeFee || 0;

      await db.runTransaction(async (transaction) => {
        if (fee > 0) {
          for (const uid of players) {
            transaction.update(db.collection("users").doc(uid), {
              balanceCoins: admin.firestore.FieldValue.increment(fee),
              lifetimeWagered: admin.firestore.FieldValue.increment(-fee)
            });
          }
        }
        transaction.update(db.collection("matches").doc(m.id), { 
          status: 'CLOSED', 
          adminNote: "Cleanup: Duplicate tier room" 
        });
      });
    }
  }

  console.log(`--- CLEANUP COMPLETE: ${orphanedCount} orphaned matches closed. ---`);
}

cleanup().catch(console.error);
