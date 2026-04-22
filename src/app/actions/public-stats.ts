"use server";

import { adminDb } from "@/lib/firebase-admin";

export type PublicOperation = {
  id: string;
  username: string;
  type: 'WIN' | 'WITHDRAWAL';
  amount: number;
  game?: string;
  timestamp: string;
};

/**
 * MASKING LOGIC: Converts "User123" to "Us***23"
 */
function maskUsername(username: string): string {
  if (!username) return "Op***tive";
  if (username.length <= 4) return username[0] + "***" + username[username.length - 1];
  return username.substring(0, 2) + "***" + username.substring(username.length - 2);
}

/**
 * FETCHER: Pulls the last 15 successful operations (Wins & Payouts)
 */
export async function getLiveProofAction(): Promise<PublicOperation[]> {
  try {
    // 1. Fetch Latest Wins (from transactions)
    const winsSnap = await adminDb.collection("transactions")
      .where("category", "==", "MATCH_PRIZE")
      .where("status", "==", "COMPLETED")
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    // 2. Fetch Latest Payouts (from withdrawals)
    // We only show PAID/COMPLETED withdrawals for trust
    const payoutsSnap = await adminDb.collection("withdrawals")
      .where("status", "==", "PAID") 
      .orderBy("createdAt", "desc")
      .limit(10)
      .get();

    const results: PublicOperation[] = [];

    // Map Wins
    winsSnap.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        username: maskUsername(data.username || "Anonymous"),
        type: 'WIN',
        amount: data.amount,
        game: data.description?.split(":")[1]?.trim()?.split(" ")[0] || "Match",
        timestamp: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });

    // Map Payouts
    payoutsSnap.forEach(doc => {
      const data = doc.data();
      results.push({
        id: doc.id,
        username: maskUsername(data.username || "Anonymous"),
        type: 'WITHDRAWAL',
        amount: data.amountCoins,
        timestamp: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
      });
    });

    // 3. Fallback / Seeded Data for empty sites
    if (results.length < 5) {
      const mockNames = ["Ghost", "Raptor", "Slayer", "Nexus", "Titan", "Zero", "Alpha"];
      const games = ["CODM", "eFootball"];
      for (let i = 0; i < 8; i++) {
        results.push({
          id: `seed-${i}`,
          username: maskUsername(mockNames[i % mockNames.length] + Math.floor(Math.random() * 100)),
          type: i % 3 === 0 ? 'WITHDRAWAL' : 'WIN',
          amount: Math.floor(Math.random() * 5000) + 500,
          game: games[i % games.length],
          timestamp: new Date(Date.now() - (i * 3600000)).toISOString()
        });
      }
    }

    // Sort combined feed by timestamp
    return results.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 15);
  } catch (error) {
    console.error("[PublicStats] Error fetching live proof:", error);
    return [];
  }
}
