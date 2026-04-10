import { adminDb } from "@/lib/firebase-admin";
import { purgeMatchDataInternal } from "@/lib/match-cleanup";

async function manualPurge() {
  console.log("--- MANUAL PURGE INITIATED ---");
  
  // 1. Delete all tournaments/leagues gathering rooms
  const matchesSnap = await adminDb.collection("matches")
    .where("format", "in", ["league", "tournament"])
    .get();
  
  for (const doc of matchesSnap.docs) {
    if (doc.data().status !== 'CLOSED' && doc.data().status !== 'COMPLETED') {
      console.log(`Eradicating gathering match: ${doc.id}`);
      await purgeMatchDataInternal(doc.id);
    }
  }
  
  // 2. Delete all circuits
  const circuitsSnap = await adminDb.collection("circuits").get();
  for (const doc of circuitsSnap.docs) {
    if (doc.data().status !== 'COMPLETED') {
      console.log(`Closing circuit: ${doc.id}`);
      await doc.ref.update({ status: 'COMPLETED', adminNote: "Final Manual Purge" });
    }
  }

  // 3. Delete all sub-matches
  const subMatchesSnap = await adminDb.collection("matches")
    .where("circuitId", "!=", null)
    .get();
  
  for (const doc of subMatchesSnap.docs) {
    if (doc.data().status !== 'CLOSED' && doc.data().status !== 'COMPLETED') {
      console.log(`Eradicating sub-match: ${doc.id}`);
      await purgeMatchDataInternal(doc.id);
    }
  }
}

manualPurge().catch(console.error);
