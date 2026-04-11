/**
 * Payment Status Monitor
 * Tracks payments in uncertain states and verifies them via webhook or periodic checks
 */

import { adminDb } from "./firebase-admin";
import admin from "firebase-admin";
import { verifyPaystackTransactionWithSSLRecovery } from "./paystack-api";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Check status of a payment that failed network verification
 * Called by client to check if payment was eventually confirmed
 */
export async function checkPaymentStatusAction(
  uid: string,
  reference: string
) {
  try {
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return { status: "NOT_FOUND", message: "Payment record not found" };
    }

    const transaction = transactionSnap.data();

    // Check if belongs to this user
    if (!transaction || transaction.uid !== uid) {
      return { status: "UNAUTHORIZED", message: "This payment doesn't belong to you" };
    }

    // If completed, return success
    if (transaction.status === 'COMPLETED') {
      return { 
        status: "COMPLETED", 
        message: "Payment confirmed and coin balance updated",
        coinsAdded: transaction.amount,
      };
    }

    // If in PENDING_VERIFICATION, try to verify again
    if (transaction.status === 'PENDING_VERIFICATION' || transaction.status === 'PENDING') {
      if (!PAYSTACK_SECRET_KEY) {
        return { 
          status: "PENDING", 
          message: "Payment pending. Verification in progress. Check again shortly.",
        };
      }

      // Try to verify with Paystack again
      const verificationResult = await verifyPaystackTransactionWithSSLRecovery(
        reference, 
        PAYSTACK_SECRET_KEY
      );

      if (verificationResult.verified) {
        // Payment confirmed! Credit it now
        const amountKobo = verificationResult.data?.amount || 0;
        const amountNaira = amountKobo / 100;
        const amountUsd = amountNaira / 800; // Rough conversion
        const coinsToCredit = Math.floor(amountUsd * 100);

        await transactionRef.update({
          status: 'COMPLETED',
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          amount: coinsToCredit,
        });

        // Credit the user
        const userRef = adminDb.collection("users").doc(uid);
        await userRef.update({
          wallet: admin.firestore.FieldValue.increment(coinsToCredit),
          totalDeposited: admin.firestore.FieldValue.increment(amountUsd),
        });

        return {
          status: "COMPLETED",
          message: "Payment confirmed! Coins have been added to your account.",
          coinsAdded: coinsToCredit,
        };
      }

      // Still pending or network failed
      return {
        status: "PENDING",
        message: "Payment status not yet confirmed. Please try again in a few moments.",
      };
    }

    // Other statuses
    return {
      status: transaction.status,
      message: `Payment status: ${transaction.status}`,
    };

  } catch (error: any) {
    console.error("[PaymentMonitor] Error checking status:", error);
    return {
      status: "ERROR",
      message: "Unable to check payment status. Please try again shortly.",
    };
  }
}

/**
 * Cleanup: Mark old PENDING transactions as abandoned after 24 hours
 * (This should run on a scheduled Cloud Function)
 */
export async function cleanupAbandonedPayments() {
  try {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    const oldPendingSnapshot = await adminDb
      .collection("transactions")
      .where("status", "==", "PENDING")
      .where("createdAt", "<", new admin.firestore.Timestamp(oneDayAgo / 1000, 0))
      .limit(100)
      .get();

    let updateCount = 0;
    const batch = adminDb.batch();

    oldPendingSnapshot.forEach(doc => {
      batch.update(doc.ref, {
        status: 'ABANDONED',
        abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
        abandonReason: 'Automatic cleanup: pending for 24+ hours',
      });
      updateCount++;
    });

    if (updateCount > 0) {
      await batch.commit();
      console.log(`[PaymentMonitor] Cleaned up ${updateCount} abandoned transactions`);
    }

    return { success: true, cleanedUp: updateCount };
  } catch (error) {
    console.error("[PaymentMonitor] Cleanup error:", error);
    return { success: false, error };
  }
}
