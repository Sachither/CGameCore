import { adminDb } from "../src/lib/firebase-admin";

async function checkQueries() {
  const uid = "SOME_DUMMY_UID_OR_REAL_ONE"; // I'll use a placeholder or just try to trigger the index check
  
  console.log("Checking Matches Query...");
  try {
    await adminDb.collection("matches")
      .where("playerIds", "array-contains", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Matches Query: OK");
  } catch (e: any) {
    console.error("Matches Query: FAILED");
    console.error(e.message);
  }

  console.log("\nChecking Withdrawals Query...");
  try {
    await adminDb.collection("withdrawals")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Withdrawals Query: OK");
  } catch (e: any) {
    console.error("Withdrawals Query: FAILED");
    console.error(e.message);
  }

  console.log("\nChecking Transactions Query...");
  try {
    await adminDb.collection("transactions")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();
    console.log("Transactions Query: OK");
  } catch (e: any) {
    console.error("Transactions Query: FAILED");
    console.error(e.message);
  }
}

checkQueries();
