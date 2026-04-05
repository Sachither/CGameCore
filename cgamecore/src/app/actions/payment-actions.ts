"use server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { createNotificationInternal } from "./admin-actions";

async function getVerifiedUid(idToken: string) {
  if (!idToken) throw new Error("Unauthorized");
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

export async function verifyPaymentAction(idToken: string, reference: string) {
  const uid = await getVerifiedUid(idToken);
  const secretKey = process.env.PAYSTACK_SECRET_KEY;

  if (!secretKey) {
    throw new Error("Paystack configuration error: Secret key missing.");
  }

  try {
    // 1. Verify with Paystack API
    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const data = await response.json();

    if (!data.status || data.data.status !== "success") {
      return { success: false, error: "Payment verification failed or was not successful." };
    }

    const { amount, customer, metadata } = data.data;
    // Paystack amount is in kobo (NGN * 100)
    const amountNgn = amount / 100;
    
    // CONVERSION RATE: 15 NGN = 1 CR
    const coinsToAdd = Math.floor(amountNgn / 15);
    
    if (coinsToAdd <= 0) {
      return { success: false, error: "Amount too low for coin conversion." };
    }

    // 2. Update Firestore within a transaction
    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(uid);
      const transRef = adminDb.collection("transactions").doc(reference);

      const transSnap = await transaction.get(transRef);
      if (transSnap.exists) {
        throw new Error("Transaction already processed.");
      }

      // Update User Balance
      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(coinsToAdd),
      });

      // Log Transaction
      transaction.set(transRef, {
        uid,
        reference,
        amountNgn,
        coinsAwarded: coinsToAdd,
        email: customer.email,
        status: "SUCCESS",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        type: "DEPOSIT",
        metadata: metadata || {}
      });

      // Update Global Stats
      const statsRef = adminDb.collection("stats").doc("platform_finances");
      transaction.set(statsRef, {
        totalDeposits: admin.firestore.FieldValue.increment(amountNgn),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    });

    // 3. Send Notification
    await createNotificationInternal(
      uid,
      "Credits Deposited",
      `Your tactical vault has been funded with ${coinsToAdd} CR. Transaction: ${reference}`,
      "SYSTEM"
    );

    return { success: true, coinsAwarded: coinsToAdd };
  } catch (error: any) {
    console.error("[PaymentAction] verifyPayment error:", error);
    return { success: false, error: error.message };
  }
}
