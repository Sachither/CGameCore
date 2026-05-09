"use server";

import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export async function getWeeklyEarnersAction() {
  try {
    const now = new Date();
    const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Convert to Firestore Timestamp
    const lastWeekTimestamp = admin.firestore.Timestamp.fromDate(lastWeek);

    const transactionsSnap = await adminDb.collection("transactions")
      .where("type", "==", "CREDIT")
      .where("category", "==", "MATCH_PRIZE")
      .where("createdAt", ">=", lastWeekTimestamp)
      .get();

    const earningsMap: Record<string, number> = {};

    transactionsSnap.docs.forEach(doc => {
      const data = doc.data();
      const uid = data.uid;
      const amount = data.amount || 0;
      earningsMap[uid] = (earningsMap[uid] || 0) + amount;
    });

    // Convert to array and sort
    const sortedEarners = Object.entries(earningsMap)
      .map(([uid, amount]) => ({ uid, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // Fetch user details for these top earners
    const results = await Promise.all(sortedEarners.map(async (earner, index) => {
      const userSnap = await adminDb.collection("users").doc(earner.uid).get();
      const userData = userSnap.data() || {};
      return {
        id: earner.uid,
        username: userData.username || "Unknown Operative",
        avatarId: userData.avatarId || 0,
        amount: earner.amount,
        rank: index + 1,
        totalWins: userData.totalWins || 0,
        totalMatches: userData.totalMatches || 0,
        isWeeklyEarner: true
      };
    }));

    return { success: true, earners: results };
  } catch (error: any) {
    console.error("[LeaderboardAction] getWeeklyEarners error:", error);
    return { success: false, error: error.message };
  }
}
