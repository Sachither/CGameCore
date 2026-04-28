"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import {
  verifyFlutterwaveAmount,
  recordWebhookEvent,
  checkWebhookRateLimit,
} from "@/lib/payment-verification";
import {
  verifyFlutterwaveTransaction,
} from "@/lib/flutterwave-api";

import { getPlatformRate } from "@/app/actions/rate-actions";

const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

/**
 * SERVER ACTION: Create a Pending Flutterwave Deposit Record
 */
export async function createPendingFlutterwaveDepositAction(
  idToken: string,
  amountUsd: number
) {
  if (!idToken || amountUsd < 1) {
    return { success: false, error: "Invalid amount or authentication. Minimum $1.00 required." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userSnap = await adminDb.collection("users").doc(uid).get();

    if (!userSnap.exists) return { success: false, error: "Profile not found." };
    const userData = userSnap.data();
    const currency = userData?.currency || "NGN";

    const rate = await getPlatformRate(currency, 'DEPOSIT');
    const localAmount = Math.ceil(amountUsd * rate);

    const reference = `CGC-FW-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const transactionRef = adminDb.collection("transactions").doc(reference);

    await transactionRef.set({
      uid,
      username: userData?.username || "Unknown",
      type: "DEPOSIT",
      amount: Math.floor(amountUsd * 100), // 100 Coins per $1 USD
      fiatAmount: amountUsd,
      localAmount,
      currency,
      exchangeRate: rate,
      gateway: "FLUTTERWAVE",
      reference,
      status: "PENDING",
      version: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { uid }
    });

    return { success: true, reference, localAmount, currency };
  } catch (error: any) {
    console.error("[FlutterwaveAction] Pre-Auth Error:", error);
    return { success: false, error: "Failed to initialize payment handshake." };
  }
}

/**
 * SERVER ACTION: Verify Flutterwave Transaction & Credit Wallet
 */
export async function verifyFlutterwavePaymentAction(
  idToken: string,
  txRef: string,
  transactionId?: string // Optional for recovery
): Promise<{ success: boolean; coinsAdded?: number; fiatAmount?: number; error?: string; isPending?: boolean; isAbandoned?: boolean }> {
  if (!idToken || !txRef) {
    return { success: false, error: "Missing authentication or transaction details." };
  }

  try {
    let uid: string;
    
    // 🛡️ SECURITY: Handle Administrative/System Bypass for background monitors
    if (idToken === process.env.SYSTEM_AUTOPILOT_TOKEN && process.env.SYSTEM_AUTOPILOT_TOKEN) {
       // This is called from payment-monitor.ts or recovery heartbeat
       // We must fetch the UID from the transaction record itself
       const previewSnap = await adminDb.collection("transactions").doc(txRef).get();
       if (!previewSnap.exists) return { success: false, error: "Transaction not found." };
       uid = previewSnap.data()?.uid;
       if (!uid) return { success: false, error: "Mapping failed." };
    } else {
       // Standard user-initiated verification
       const decodedToken = await adminAuth.verifyIdToken(idToken);
       uid = decodedToken.uid;
    }

    if (!FLUTTERWAVE_SECRET_KEY) {
      console.error("[FlutterwaveAction] Missing FLUTTERWAVE_SECRET_KEY");
      return { success: false, error: "Platform Error: Gateway misconfigured." };
    }

    // 1. Check Ledger
    const transactionRef = adminDb.collection("transactions").doc(txRef);
    const transactionSnap = await transactionRef.get();
    const t = transactionSnap.data();

    if (transactionSnap.exists && t?.status === 'COMPLETED') {
      return { success: true, coinsAdded: t.amount, fiatAmount: t.fiatAmount };
    }

    // 2. Verify with API
    let verificationResult;
    
    if (transactionId) {
      verificationResult = await verifyFlutterwaveTransaction(transactionId, FLUTTERWAVE_SECRET_KEY);
    } else {
      // Recovery Mode: Use tx_ref
      try {
        const fwResponse = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${txRef}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
          }
        );
        const fwData = await fwResponse.json();
        verificationResult = {
          verified: fwData.status === 'success' && fwData.data?.status === "successful",
          data: fwData.data,
          error: fwData.message
        };
      } catch (e: any) {
        verificationResult = { verified: false, error: e.message, networkFailed: true };
      }
    }

    if (verificationResult.networkFailed) {
      return { success: false, error: "Network confirmation pending.", isPending: true };
    }

    if (!verificationResult.verified || !verificationResult.data) {
      // Abandonment Logic: If transaction was created > 30 mins ago and not found
      if (transactionSnap.exists) {
        const createdAt = t?.createdAt?.toDate ? t.createdAt.toDate().getTime() : 0;
        const ageMinutes = (Date.now() - createdAt) / 60000;
        if (ageMinutes > 30 && t?.status === "PENDING") {
           await transactionRef.update({ status: "ABANDONED", abandonReason: "Payment not completed on gateway" });
           return { success: false, error: "Transaction Abandoned.", isAbandoned: true };
        }
      }
      return { success: false, error: "Payment verification failed or was unsuccessful." };
    }

    const data = verificationResult.data;
    const amountPaid = Number(data.amount);

    // 3. Amount Verification
    const verification = await verifyFlutterwaveAmount(txRef, amountPaid, false);
    if (!verification.verified) {
      return { success: false, error: "Security Alert: Transaction amount mismatch." };
    }

    const verifiedFiatAmount = verification.claimedAmountUsd;
    const coinsToCredit = Math.floor(verifiedFiatAmount * 100);

    // 4. Fulfillment
    const result = await internalFulfillFlutterwaveDeposit(txRef, amountPaid, uid);

    if (result.success) {
      return { 
        success: true, 
        coinsAdded: result.coinsAdded,
        fiatAmount: t?.fiatAmount || verifiedFiatAmount
      };
    } else {
      return { success: false, error: result.error || "Fulfillment Failed." };
    }

  } catch (error: any) {
    console.error("[FlutterwaveAction] Critical Error:", error);
    return { success: false, error: error.message || "Operation failed." };
  }
}

export async function internalFulfillFlutterwaveDeposit(
  reference: string,
  amount: number,
  requestingUid?: string
) {
  try {
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();

    const t = transactionSnap.data();
    if (transactionSnap.exists && t?.status === 'COMPLETED') {
      return { success: true, coinsAdded: t.amount };
    }

    const currency = t?.currency || "NGN";
    const handshakeRate = t?.exchangeRate || 1500;
    const amountUsd = amount / handshakeRate;
    const coinsToCredit = t?.amount || Math.floor(amountUsd * 100);

    const uid = t?.uid;
    if (requestingUid && uid && requestingUid !== uid) {
      return { success: false, error: "UID mismatch" };
    }

    if (!uid) return { success: false, error: "User identity mapping failed." };

    const userRef = adminDb.collection("users").doc(uid);
    const expectedVersion = t?.version || 0;

    await adminDb.runTransaction(async (transaction) => {
      const uSnap = await transaction.get(userRef);
      if (!uSnap.exists) throw new Error("Operative not found.");

      const tSnap = await transaction.get(transactionRef);
      const tt = tSnap.data();
      if (tt?.status === 'COMPLETED') return;

      if ((tt?.version || 0) !== expectedVersion) throw new Error("Version conflict");

      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(coinsToCredit),
        lifetimeDeposits: admin.firestore.FieldValue.increment(coinsToCredit)
      });

      transaction.set(transactionRef, {
        status: "COMPLETED",
        version: expectedVersion + 1,
        processedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      const statsRef = adminDb.collection("stats").doc("platform_finances");
      transaction.set(statsRef, {
        totalDeposits: admin.firestore.FieldValue.increment(coinsToCredit),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    return { success: true, coinsAdded: coinsToCredit };
  } catch (err: any) {
    console.error("[InternalFulfillFW] Error:", err);
    return { success: false, error: err.message };
  }
}
