"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

/**
 * Gets the verified UID from the ID Token. (Same as match-actions but keeping modular)
 */
async function getVerifiedUid(idToken?: string) {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

/**
 * SERVER ACTION: Request Withdrawal
 * Deducts the user's coins instantly and creates a PENDING ticket for manual admin review.
 */
export async function requestWithdrawalAction(
  idToken: string,
  amountCoins: number,
  bankName: string,
  bankCode: string,
  accountNumber: string,
  legalName: string
) {
  const uid = await getVerifiedUid(idToken);
  
  if (amountCoins < 100) return { success: false, error: "Minimum withdrawal is 100 Coins." };
  if (!bankName || !bankCode || accountNumber.length < 10 || !legalName) {
    return { success: false, error: "Incomplete bank details provided." };
  }

  const userRef = adminDb.collection("users").doc(uid);
  const withdrawalRef = adminDb.collection("withdrawals").doc();

  // Exactly 15 Naira per 1 Coin multiplier
  const fiatAmount = amountCoins * 15;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User profile missing.");

      const userData = userSnap.data()!;

      // 0. Security Check: Restricted?
      const now = Date.now();
      const suspensionEnd = userData.suspendedUntil ? (userData.suspendedUntil.toDate ? userData.suspendedUntil.toDate().getTime() : new Date(userData.suspendedUntil).getTime()) : 0;
      const isRestricted = userData.isBanned || (suspensionEnd > now);
      
      if (isRestricted) {
         throw new Error("SECURITY RESTRICTION: Your financial vault is locked during investigation.");
      }

      // 1. Anti-Money-Laundering Gate: 1 Match Minimum
      const totalMatches = userData.totalMatches || 0;
      if (totalMatches < 1) {
        throw new Error("WITHDRAWAL BLOCKED: You must participate in at least 1 match before withdrawing. This is required to prevent financial abuse on the platform.");
      }

      // 2. Net Deposit Rollover (The Math)
      const lifetimeDeposits = userData.lifetimeDeposits || 0;
      const lifetimeWagered = userData.lifetimeWagered || 0;
      const currentBalance = userData.balanceCoins || 0;
      
      const unWageredDeposits = Math.max(0, lifetimeDeposits - lifetimeWagered);
      const maxWithdrawable = Math.max(0, currentBalance - unWageredDeposits);

      if (amountCoins > maxWithdrawable) {
        throw new Error(`AML LIMIT: You can only withdraw up to ${maxWithdrawable} CR. You must play matches to rollover your un-wagered deposited funds.`);
      }

      if (currentBalance < amountCoins) {
        throw new Error("Insufficient coin balance for this payout.");
      }

      // 1. Deduct coins instantly so they can't double-spend while it sits in queue
      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(-amountCoins)
      });

      // 2. Create the ticket — including bankCode for Paystack Transfer API
      transaction.set(withdrawalRef, {
        uid,
        username: userData.username || "Unknown",
        amountCoins,
        fiatAmount,
        bankName,
        bankCode,
        accountNumber,
        legalName,
        status: "PENDING",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true, ticketId: withdrawalRef.id };
  } catch (error: any) {
    console.error("[WalletAction] Withdrawal error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Get User Transaction Ledger
 */
export async function getWalletTransactionsAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  
  try {
     const [matchesSnap, withdrawalsSnap, genericTransactionsSnap] = await Promise.all([
       adminDb.collection("matches").where("playerIds", "array-contains", uid).get(),
       adminDb.collection("withdrawals").where("uid", "==", uid).get(),
       adminDb.collection("transactions").where("uid", "==", uid).get(),
     ]);

     const transactions: any[] = [];

     // Process Match Entries & Winnings
     matchesSnap.forEach(doc => {
        const m = doc.data();
        const isWinner = m.championUid === uid;
        const netPool = m.rewardAmount || 0;
        
        // 1. Show the Entry Fee as a deduction
        if (m.createdAt) {
           transactions.push({
              id: `${doc.id}-entry`, // Unique React Key
              displayId: doc.id.substring(0, 8).toUpperCase(), // UI Display
              timestamp: m.createdAt.toDate ? m.createdAt.toDate() : new Date(),
              type: "Match Entry",
              match: `${m.game} ${m.format}`,
              amount: `-${m.challengeFee}`,
              status: "Completed"
           });
        }

        // 2. If won, show the winnings as a gain
        if (isWinner && m.status === 'CLOSED') {
           transactions.push({
              id: `${doc.id}-win`, // Unique React Key
              displayId: "WIN-" + doc.id.substring(0, 5).toUpperCase(), // UI Display
              timestamp: m.resolvedAt?.toDate ? m.resolvedAt.toDate() : new Date(),
              type: "Prize Won",
              match: `${m.game} Victory`,
              amount: `+${netPool}`,
              status: "Completed"
           });
        }
     });

     // Process Deployments, Deposits and Admin Adjs (Transactions Collection)
     genericTransactionsSnap.forEach(doc => {
        const t = doc.data();
        // Use the full doc.id for uniqueness, but keep the display format
        const displayId = doc.id.startsWith('CGC-') ? doc.id.replace('CGC-DEP-', 'DEP-') : doc.id.substring(0, 8).toUpperCase();
        
        transactions.push({
           id: doc.id, // Full ID for React key
           displayId: displayId, // Clean ID for UI
           timestamp: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(),
           type: t.type === 'DEPOSIT' ? "Deposit" : 
                 t.type === 'IDENTITY_FINE' ? "Identity Fine" : "Wallet Adj",
           match: t.gateway === 'PAYSTACK' ? "Paystack Gateway" : "System Audit",
           amount: t.amount > 0 ? `+${t.amount}` : `${t.amount}`,
           status: t.status === 'COMPLETED' || t.status === 'SUCCESS' ? "Completed" : 
                   t.status === 'ABANDONED' ? "Abandoned" : "Pending"
        });
     });

     // Process Withdrawals
     withdrawalsSnap.forEach(doc => {
        const w = doc.data();
        transactions.push({
           id: doc.id, // Full ID for React key
           displayId: "WD-" + doc.id.substring(0, 6).toUpperCase(), // UI Display
           timestamp: w.createdAt?.toDate ? w.createdAt.toDate() : new Date(),
           type: "Withdrawal",
           match: "Bank Transfer",
           amount: `-${w.amountCoins}`,
           status: w.status === 'PENDING' ? "Pending" : 
                   w.status === 'REJECTED' ? "Rejected" : "Completed"
        });
     });

     // Sort by most recent
     transactions.sort((a, b) => b.timestamp - a.timestamp);

     const sanitized = transactions.map(t => ({
        ...t,
        date: t.timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        time: t.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        timestamp: null // strip the Date object for Serialized Action response
     }));

     return { success: true, transactions: sanitized };
  } catch (error: any) {
     console.error("[WalletAction] Error fetching ledger:", error);
     return { success: false, error: error.message, transactions: [] };
  }
}
