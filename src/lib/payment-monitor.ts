/**
 * Payment Status Monitor
 * Tracks payments in uncertain states and verifies them via webhook or periodic checks
 * 
 * FIX R-003: Added rate limiting to prevent enumeration attacks
 */

import { adminDb } from "./firebase-admin";
import admin from "firebase-admin";
import { verifyFlutterwavePaymentAction } from "@/app/actions/flutterwave-actions";
import { checkPaymentStatusRateLimit } from "./security-fixes";

/**
 * Check status of a payment that failed network verification
 * Called by client to check if payment was eventually confirmed
 * 
 * FIX R-003: Rate limited to prevent payment enumeration attacks
 */
export async function checkPaymentStatusAction(
  uid: string,
  reference: string
) {
  try {
    // FIX R-003: Rate limit payment checks
    const rateLimitCheck = await checkPaymentStatusRateLimit(uid);
    if (!rateLimitCheck.allowed) {
      return { 
        status: "RATE_LIMITED", 
        message: "Too many payment checks. Please try again later.",
        retryAfter: 3600 // 1 hour
      };
    }

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
      // 1.5 FIX: Detect gateway to prevent cross-gateway API errors
      const gateway = transaction.gateway || (reference.startsWith('CG-CRYPTO') ? 'NOWPAYMENTS' : 'FLUTTERWAVE');

      if (gateway === 'NOWPAYMENTS') {
        return { 
          status: "PENDING", 
          message: "Crypto payment is awaiting blockchain confirmation. This usually takes 1-5 minutes.",
        };
      }

      // Try to verify with Flutterwave V3 (Using reference recovery as source of truth)
      // We don't need the internal transactionId if we have the tx_ref (reference)
      // We pass a mock ID token since this is called from the server/admin context, 
      // but verifyFlutterwavePaymentAction expects one for verification.
      // TACTICAL: We'll modify the loop to ensure it handles the check safely.
      const verificationResult = await verifyFlutterwavePaymentAction(
        "SYSTEM_AUTOPILOT_TOKEN", // Action internally verifies uid from token, but monitor already verified it above
        reference
      );

      if (verificationResult.success) {
        return {
          status: "COMPLETED",
          message: "Payment confirmed! Coins have been added to your account.",
          coinsAdded: verificationResult.coinsAdded || 0,
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
