"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import {
  verifyPaystackAmount,
  recordWebhookEvent,
  checkWebhookRateLimit,
} from "@/lib/payment-verification";
import {
  verifyPaystackTransactionWithSSLRecovery,
} from "@/lib/paystack-api";

import { getPlatformRate } from "@/app/actions/rate-actions";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * SERVER ACTION: Create a Pending Deposit Record
 * Generates a unique reference and saves it with PENDING status.
 */
export async function createPendingDepositAction(
  idToken: string,
  amountUsd: number
) {
  if (!idToken || amountUsd < 1) { // Minimum $1.00 USD
    return { success: false, error: "Invalid amount or authentication. Minimum $1.00 required." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userSnap = await adminDb.collection("users").doc(uid).get();

    if (!userSnap.exists) return { success: false, error: "Profile not found." };
    const userData = userSnap.data();
    const currency = userData?.currency || "NGN";

    // Fetch dynamic rate for this specific user's region
    const rate = await getPlatformRate(currency, 'DEPOSIT');
    const localAmount = Math.ceil(amountUsd * rate);

    // Generate a unique tactical reference
    const reference = `CGC-DEP-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const transactionRef = adminDb.collection("transactions").doc(reference);

    await transactionRef.set({
      uid,
      username: userData?.username || "Unknown",
      type: "DEPOSIT",
      amount: Math.floor(amountUsd * 100), // 100 Coins per $1 USD
      fiatAmount: amountUsd, // Pegasus/Internal Peg
      localAmount, // Amount in local currency (e.g. Naira/Cedis/Rand)
      currency, // e.g. 'NGN', 'GHS'
      exchangeRate: rate, // Store the rate used at handshake for audit/verification
      gateway: "PAYSTACK",
      reference,
      status: "PENDING",
      version: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { uid }
    });

    return { success: true, reference, localAmount, currency };
  } catch (error: any) {
    console.error("[PaystackAction] Pre-Auth Error:", error);
    return { success: false, error: "Failed to initialize payment handshake." };
  }
}

/**
 * SERVER ACTION: Verify Paystack Transaction & Credit Wallet
 * Handles SSL/Network errors gracefully with retry logic and webhook fallback
 */
export async function verifyPaystackPaymentAction(
  idToken: string,
  reference: string,
  originalReference?: string
): Promise<{ success: boolean; message?: string; error?: string; isAbandoned?: boolean; isPending?: boolean; retryAfterSeconds?: number; coinsAdded?: number }> {
  if (!idToken || !reference) {
    return { success: false, error: "Missing authentication or transaction reference." };
  }

  try {
    // 1. Verify User
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    if (!PAYSTACK_SECRET_KEY) {
      console.error("[PaystackAction] Missing PAYSTACK_SECRET_KEY in environment.");
      return { success: false, error: "Platform Error: Payment gateway misconfigured." };
    }

    // 2. Check Local Ledger for Idempotency
    // We prioritize looking up the original record if provided
    const lookupRef = originalReference || reference;
    const transactionRef = adminDb.collection("transactions").doc(lookupRef);
    const transactionSnap = await transactionRef.get();
    let t = transactionSnap.data();

    // If Paystack returned a different ID (e.g. #T...) but our #DEP- record exists
    // we bridge them here to avoid creating a double entry.
    if (!transactionSnap.exists && originalReference && originalReference !== reference) {
      console.log(`[PaystackAction] Ref mismatch: Got ${reference}, binding to original ${originalReference}`);
    }

    if (transactionSnap.exists && t?.status === 'COMPLETED') {
      return { success: true, message: "Transaction already fulfilled." };
    }

    // 3. Verify with Paystack API (with SSL error recovery)
    const verificationResult = await verifyPaystackTransactionWithSSLRecovery(reference, PAYSTACK_SECRET_KEY);

    if (verificationResult.networkFailed) {
      // Critical: Network failed but payment might have gone through
      console.error(`[PaystackAction] CRITICAL: Network failure verifying ${reference}. Payment status unknown.`);

      // Update transaction to PENDING_VERIFICATION (waiting for webhook)
      if (transactionSnap.exists) {
        await transactionRef.update({
          status: "PENDING_VERIFICATION",
          verificationAttemptedAt: admin.firestore.FieldValue.serverTimestamp(),
          verificationNote: "Network error during verification. Awaiting webhook confirmation.",
          version: admin.firestore.FieldValue.increment(1),
        });
      }

      // Tell user their payment is being verified
      return {
        success: false,
        error: "Network issue - your payment is being verified. You will receive a confirmation shortly.",
        isPending: true,
        retryAfterSeconds: 30,
      };
    }

    if (!verificationResult.verified) {
      const isNotFound = verificationResult.error?.toLowerCase().includes("not found");

      if (isNotFound && transactionSnap.exists) {
        const createdAt = t?.createdAt?.toDate ? t.createdAt.toDate().getTime() : 0;
        const now = Date.now();
        const ageMinutes = (now - createdAt) / 60000;

        if (ageMinutes > 10 && t?.status === "PENDING") {
          await transactionRef.update({
            status: "ABANDONED",
            abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
            abandonReason: "Paystack Reference Not Found (Timeout)"
          });
          console.log(`[PaystackAction] Marked phantom transaction ${reference} as ABANDONED.`);
          return { success: false, error: "Transaction Abandoned: Reference not found on gateway.", isAbandoned: true };
        }
      }

      return { success: false, error: verificationResult.error || "Payment verification failed." };
    }

    // Payment verified successfully
    const data = verificationResult.data;

    // 3.1 FIX: Verify amount against stored record AND Paystack API before fulfilling
    const amountKobo = Number(data.amount);
    
    // Ensure we have a valid rate if the record is missing (Auto-creation scenario)
    let manualRate: number | undefined = undefined;
    let userSnap: any = null;

    if (!transactionSnap.exists) {
      userSnap = await adminDb.collection("users").doc(uid).get();
      const currency = userSnap.data()?.currency || "NGN";
      const rateResponse = await getPlatformRate(currency, 'DEPOSIT');
      manualRate = rateResponse;
    }

    const verification = await verifyPaystackAmount(reference, amountKobo, true, manualRate);

    if (!verification.verified) {
      console.error(
        `[PaystackAction] SECURITY: Amount verification failed for ${reference}`,
        verification.reason
      );
      // Log this as a potential attack but don't fulfill
      return {
        success: false,
        error: "Payment verification failed: amount mismatch detected.",
      };
    }

    // Verified amount - use it for crediting coins
    const amountUsd = verification.claimedAmountUsd;
    const coinsToCredit = Math.floor(amountUsd * 100);

    if (coinsToCredit <= 0) {
      return { success: false, error: "Insufficient transaction amount." };
    }

    if (!transactionSnap.exists) {
      console.warn(`[PaystackAction] ⚠️ Pre-auth ledger record missing for ${lookupRef}. Paystack confirmed payment.`);
      
      // We already fetched userSnap and rateResponse earlier for verification!
      if (!userSnap || !userSnap.exists) {
        return { success: false, error: "Operative profile not found." };
      }

      await transactionRef.set({
        uid,
        username: userSnap.data()?.username || "Unknown",
        type: "DEPOSIT",
        amount: coinsToCredit,
        fiatAmount: amountUsd,
        currency: userSnap.data()?.currency || "NGN",
        exchangeRate: manualRate || 1500, // Reverted fallback to 1500
        gateway: "PAYSTACK",
        reference: lookupRef, 
        gatewayInternalRef: reference !== lookupRef ? reference : null,
        status: "PENDING",
        version: 1,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        note: `Auto-created during verification: ${reference !== lookupRef ? 'linked to ' + reference : 'ledger record missing'}`
      });

      // RE-READ: Necessary to avoid the "status changed from undefined to PENDING" error
      const refreshedSnap = await transactionRef.get();
      const rt = refreshedSnap.data();
      t = rt; // Update local 't' for the snapshot below
    } else if (originalReference && originalReference !== reference) {
      // Record already exists but we have a new internal reference from Paystack
      await transactionRef.update({ gatewayInternalRef: reference });
    }

    const transactionUid = transactionSnap.exists ? t?.uid : uid;
    if (transactionUid && transactionUid !== uid) {
      // FIX P-001: CRITICAL - Throw error immediately, don't credit any coins
      console.error(`🚨 UID MISMATCH ATTACK DETECTED: Transaction ${reference} belongs to ${transactionUid}, but verified user is ${uid}. REJECTING PAYMENT.`);

      // Log this attack to audit log for admin review
      await adminDb.collection("security_incidents").add({
        type: "payment_uid_mismatch",
        reference,
        storedUid: transactionUid,
        requestingUid: uid,
        gateway: "PAYSTACK",
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        severity: "CRITICAL"
      });

      throw new Error(`SECURITY: Payment transaction belongs to different user. This incident has been logged.`);
    }

    // FIX P-003: Take snapshot of transaction state BEFORE attempting fulfillment
    const preVerificationSnapshot = {
      status: t?.status,
      uid: t?.uid,
      fiatAmount: t?.fiatAmount,
      version: t?.version
    };

    // 5. SECURE TRANSACTION: Credit Coins
    const result = await internalFulfillDeposit(lookupRef, data.amount, uid, preVerificationSnapshot);

    if (result.success) {
      console.log(`[PaystackAction] Successfully verified and fulfilled $${amountUsd} deposit for ${uid} (+${result.coinsAdded} CR)`);
      return { success: true, coinsAdded: result.coinsAdded };
    } else {
      return { success: false, error: result.error || "Fulfillment Failed." };
    }

  } catch (error: any) {
    console.error("[PaystackAction] Integration Error:", error);

    // Generic error - payment status unknown
    if (error?.message?.includes('SSL') || error?.message?.includes('ERR_')) {
      return {
        success: false,
        error: "Network connectivity issue. Your payment is being verified. Check your account shortly.",
        isPending: true,
      };
    }

    return { success: false, error: error.message || "Paystack link severed." };
  }
}

export async function internalFulfillDeposit(
  reference: string,
  amountKobo: number,
  requestingUid?: string,
  snapshotBefore?: { status?: string; uid?: string; fiatAmount?: number; version?: number }
) {
  try {
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const source = snapshotBefore ? "CLIENT_ACTION" : "WEBHOOK_EVENT";
    console.log(`[InternalFulfill] Resolving ${reference} via ${source}...`);
    const transactionSnap = await transactionRef.get();

    const t = transactionSnap.data();
    if (transactionSnap.exists && t?.status === 'COMPLETED') {
      return { success: true, message: "Already fulfilled.", coinsAdded: t.amount };
    }

    // FIX P-003: Verify transaction hasn't changed since pre-verification snapshot
    if (snapshotBefore) {
      if (t?.status !== snapshotBefore.status) {
        const errorMsg = `Transaction status changed during verification: was ${snapshotBefore.status}, now ${t?.status}`;
        console.warn(`[P-003] ${errorMsg}`);
        throw new Error(errorMsg);
      }
      if (t?.uid !== snapshotBefore.uid) {
        throw new Error("Transaction UID changed during verification");
      }
      if (Math.abs((t?.fiatAmount || 0) - (snapshotBefore.fiatAmount || 0)) > 0.01) {
        throw new Error("Transaction amount changed during verification");
      }
    }

    const amountLocal = Number(amountKobo) / 100;

    // 🚀 MULTI-COUNTRY UPGRADE: Calculate amount based on stored handshake rate
    // This protects both user and platform from intraday volatility between handshake and fulfillment.
    const currency = t?.currency || "NGN";
    const handshakeRate = t?.exchangeRate || 1500;
    const amountUsd = amountLocal / handshakeRate;
    
    // PRIMARY SOURCE OF TRUTH: Use the coins stored in the record during the "Pending" step
    // FALLBACK: If record was missing (auto-created), calculate from local currency math
    const coinsToCredit = t?.amount || Math.floor(amountUsd * 100);

    if (t?.amount) {
       console.log(`[P-COIN] Trusting ledger amount: ${t.amount} CR (Paid $${amountUsd.toFixed(4)})`);
    } else {
       console.log(`[P-COIN] Auto-calculating from payout: ${coinsToCredit} CR ($${amountUsd.toFixed(4)})`);
    }

    const uid = t?.uid;

    if (requestingUid && uid && requestingUid !== uid) {
      console.error(`🚨 FULFILL UID MISMATCH: ${requestingUid} trying to fulfill ${uid}'s transaction`);
      return { success: false, error: "UID mismatch on transaction fulfillment" };
    }

    if (!uid) {
      return { success: false, error: "Critical: Reference mapping to User Identity failed." };
    }

    const userRef = adminDb.collection("users").doc(uid);
    const statsRef = adminDb.collection("stats").doc("platform_finances");

    // 1.4 FIX: Use optimistic locking with version field to prevent concurrent execution
    // Only increment coins if transaction is still PENDING and version matches
    const currentVersion = t?.version || 0;
    const expectedVersion = currentVersion;

    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("Operative profile not found.");

      const localTransSnap = await transaction.get(transactionRef);
      if (!localTransSnap.exists) {
        const localT = localTransSnap.data();
        if (localT?.status === 'COMPLETED') {
          return; // Already completed by another concurrent request
        }
      }

      const localT = localTransSnap.data();
      const localVersion = localT?.version || 0;

      // Version mismatch means this already executed (due to transaction retry)
      // Return successfully (idempotent operation)
      if (localVersion !== expectedVersion) {
        if (localT?.status === 'COMPLETED') {
          return; // Already completed, just return success
        }
        // Otherwise, this is a stale/conflicting attempt - abort
        throw new Error("Transaction version conflict - retry aborted");
      }

      if (localT?.status === 'COMPLETED') {
        return; // Already completed by another attempt
      }

      if (!localTransSnap.exists) {
        transaction.set(transactionRef, {
          uid,
          username: userSnap.data()?.username || "Unknown",
          type: "DEPOSIT",
          amount: coinsToCredit,
          fiatAmount: amountUsd,
          gateway: "PAYSTACK",
          reference,
          status: "PENDING",
          version: 1,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          note: "Atomic Auto-Creation: Ledger record missing during handshake"
        });
      }

      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(coinsToCredit),
        lifetimeDeposits: admin.firestore.FieldValue.increment(coinsToCredit)
      });

      // Increment version and mark as COMPLETED
      transaction.set(transactionRef, {
        amount: coinsToCredit,
        fiatAmount: amountUsd,
        status: "COMPLETED",
        version: expectedVersion + 1, // Increment version to prevent re-execution
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      transaction.set(statsRef, {
        totalDeposits: admin.firestore.FieldValue.increment(coinsToCredit),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return { success: true, coinsAdded: coinsToCredit };
  } catch (err: any) {
    // Distinguish between version conflict (safe retry) and real error
    if (err.message?.includes("version conflict")) {
      console.warn("[InternalFulfill] Version conflict (safe - will retry):", err.message);
    }
    console.error("[InternalFulfill] Pulse Error:", err);
    return { success: false, error: err.message };
  }
}
