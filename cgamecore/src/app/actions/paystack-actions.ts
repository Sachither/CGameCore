"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * SERVER ACTION: Create a Pending Deposit Record
 * Generates a unique reference and saves it with PENDING status.
 */
export async function createPendingDepositAction(
  idToken: string,
  amountNaira: number
) {
  if (!idToken || amountNaira < 1500) {
    return { success: false, error: "Invalid amount or authentication." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userSnap = await adminDb.collection("users").doc(uid).get();
    
    if (!userSnap.exists) return { success: false, error: "Profile not found." };

    // Generate a unique tactical reference
    const reference = `CGC-DEP-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    const transactionRef = adminDb.collection("transactions").doc(reference);

    await transactionRef.set({
      uid,
      username: userSnap.data()?.username || "Unknown",
      type: "DEPOSIT",
      amount: Math.floor(amountNaira / 15),
      fiatAmount: amountNaira,
      gateway: "PAYSTACK",
      reference,
      status: "PENDING",
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, reference };
  } catch (error: any) {
    console.error("[PaystackAction] Pre-Auth Error:", error);
    return { success: false, error: "Failed to initialize payment handshake." };
  }
}

/**
 * SERVER ACTION: Verify Paystack Transaction & Credit Wallet
 * Verifies the reference from the client against Paystack's API.
 */
export async function verifyPaystackPaymentAction(
  idToken: string,
  reference: string
) {
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
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();

    if (transactionSnap.exists && transactionSnap.data()?.status === 'COMPLETED') {
        return { success: true, message: "Transaction already fulfilled." };
    }

    // 3. Verify with Paystack API
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!data.status || data.data.status !== 'success') {
      // TACTICAL SANITIZATION:
      // If Paystack doesn't know about this reference, it might be a "phantom" attempt from a refresh.
      const isNotFound = data.message?.toLowerCase().includes("transaction reference not found");
      
      if (isNotFound && transactionSnap.exists) {
        const t = transactionSnap.data()!;
        const createdAt = t.createdAt?.toDate ? t.createdAt.toDate().getTime() : 0;
        const now = Date.now();
        const ageMinutes = (now - createdAt) / 60000;

        // If it's more than 10 minutes old and still PENDING, mark it as abandoned
        if (ageMinutes > 10 && t.status === "PENDING") {
           await transactionRef.update({
             status: "ABANDONED",
             abandonedAt: admin.firestore.FieldValue.serverTimestamp(),
             abandonReason: "Paystack Reference Not Found (Timeout)"
           });
           console.log(`[PaystackAction] Marked phantom transaction ${reference} as ABANDONED.`);
           return { success: false, error: "Transaction Abandoned: Reference not found on gateway.", isAbandoned: true };
        }
      }

      return { success: false, error: data.message || "Payment verification failed." };
    }

    // Paystack returns amount in KOBO (Smallest unit)
    const amountNaira = Number(data.data.amount) / 100;
    const coinsToCredit = Math.floor(amountNaira / 15);

    if (coinsToCredit <= 0) {
      return { success: false, error: "Insufficient transaction amount." };
    }

    const userRef = adminDb.collection("users").doc(uid);
    const statsRef = adminDb.collection("stats").doc("platform_finances");

    // 4. SECURE TRANSACTION: Deduct Naira (Paystack handled) -> Credit Coins
    const result = await internalFulfillDeposit(reference, data.data.amount);
    
    if (result.success) {
      console.log(`[PaystackAction] Successfully verified and fulfilled ₦${amountNaira} deposit for ${uid} (+${result.coinsAdded} CR)`);
      return { success: true, coinsAdded: result.coinsAdded };
    } else {
      return { success: false, error: result.error || "Fulfillment Failed." };
    }

  } catch (error: any) {
    console.error("[PaystackAction] Integration Error:", error);
    return { success: false, error: error.message || "Paystack link severed." };
  }
}

/**
 * INTERNAL UTILITY: Fulfill a Deposit Order
 * This is the shared logic used by both the Manual Verification (Server Action) 
 * and the Automated Webhook (API Route).
 */
export async function internalFulfillDeposit(reference: string, amountKobo: number) {
  try {
     const transactionRef = adminDb.collection("transactions").doc(reference);
     const transactionSnap = await transactionRef.get();

     if (!transactionSnap.exists) {
        return { success: false, error: "Transaction record missing in ledger." };
     }

     const t = transactionSnap.data()!;
     if (t.status === 'COMPLETED') {
        return { success: true, message: "Already fulfilled.", coinsAdded: t.amount };
     }

     const uid = t.uid;
     const amountNaira = Number(amountKobo) / 100;
     const coinsToCredit = Math.floor(amountNaira / 15);

     if (coinsToCredit <= 0) {
        return { success: false, error: "Insufficient transaction amount." };
     }

     const userRef = adminDb.collection("users").doc(uid);
     const statsRef = adminDb.collection("stats").doc("platform_finances");

     await adminDb.runTransaction(async (transaction) => {
       const userSnap = await transaction.get(userRef);
       if (!userSnap.exists) throw new Error("Operative profile not found.");

       const userData = userSnap.data() || {};
       
       // Re-verify status inside atomic transaction
       const localTransSnap = await transaction.get(transactionRef);
       if (localTransSnap.exists && localTransSnap.data()?.status === 'COMPLETED') {
          return; // Already processed
       }

       // Credit Coins and increment lifetime deposits for AML rollover
       transaction.update(userRef, {
         balanceCoins: admin.firestore.FieldValue.increment(coinsToCredit),
         lifetimeDeposits: admin.firestore.FieldValue.increment(coinsToCredit)
       });

       // Log Transaction (Update existing PENDING doc)
       transaction.set(transactionRef, {
         amount: coinsToCredit,
         fiatAmount: amountNaira,
         status: "COMPLETED",
         processedAt: admin.firestore.FieldValue.serverTimestamp()
       }, { merge: true });

       // Update Platform Stats
       transaction.set(statsRef, {
         totalDeposits: admin.firestore.FieldValue.increment(coinsToCredit),
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
       }, { merge: true });
     });

     return { success: true, coinsAdded: coinsToCredit };
  } catch (err: any) {
     console.error("[InternalFulfill] Error:", err);
     return { success: false, error: err.message };
  }
}
