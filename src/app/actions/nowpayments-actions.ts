"use server";

import { adminDb, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import {
  verifyNowPaymentsAmount,
  recordWebhookEvent,
} from "@/lib/payment-verification";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const API_TIMEOUT_MS = 15000; // 15 second timeout

/**
 * Helper: Robust NowPayments API call with timeout and error handling
 */
async function callNowPaymentsAPI(
  endpoint: string,
  method: string = "POST",
  body?: any,
  retryCount = 0
): Promise<{ success: boolean; data?: any; error?: string }> {
  const maxRetries = 2;
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    const response = await fetch(endpoint, {
      method,
      headers: {
        "x-api-key": NOWPAYMENTS_API_KEY!,
        "Content-Type": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || `HTTP ${response.status}`);
    }

    return { success: true, data };

  } catch (error: any) {
    const isNetworkError = error?.name === 'AbortError' || 
                          error?.message?.includes('fetch') ||
                          error?.message?.includes('ECONNREFUSED');

    if (isNetworkError && retryCount < maxRetries) {
      console.warn(`[NowPayments] Network error, retrying... (${retryCount + 1}/${maxRetries})`);
      await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
      return callNowPaymentsAPI(endpoint, method, body, retryCount + 1);
    }

    console.error(`[NowPayments] API Error:`, error?.message);
    return { 
      success: false, 
      error: error?.message || 'API request failed',
    };
  }
}

// Fixed peg: 100 Coins = $1.00 USD
export async function createNowPaymentInvoiceAction(idToken: string, amountUsd: number) {
  if (!idToken || amountUsd < 1) {
    return { success: false, error: "Invalid amount or authentication. Minimum crypto deposit is $1.00 USD." };
  }

  if (!NOWPAYMENTS_API_KEY) {
     console.error("[NowPayments] API Key missing in environment.");
     return { success: false, error: "Gateway Offline." };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;
    const userSnap = await adminDb.collection("users").doc(uid).get();

    if (!userSnap.exists) return { success: false, error: "Profile not found." };

    // 1. Generate unique reference for our database
    const reference = `CG-CRYPTO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // 2. Call NowPayments to create an invoice (with retry logic)
    const invoicePayload = {
      price_amount: amountUsd,
      price_currency: "usd",
      order_id: reference,
      order_description: `Deposit $${amountUsd} USD equivalent for CGameCore Coins`,
      success_url: `https://cgamecore.com/dashboard/wallet?success=true`,
      cancel_url: `https://cgamecore.com/dashboard/wallet?cancel=true`
    };

    const apiResult = await callNowPaymentsAPI("https://api.nowpayments.io/v1/invoice", "POST", invoicePayload);

    if (!apiResult.success) {
      console.error("[NowPayments] Failed to create invoice:", apiResult.error);
      return { 
        success: false, 
        error: apiResult.error || "Failed to initialize crypto invoice. Please try again.",
        isNetworkError: true,
      };
    }

    const data = apiResult.data;
    
    if (!data.invoice_url) {
      return { success: false, error: "Invalid invoice response from gateway." };
    }

    // 3. Save to Firestore
    const transactionRef = adminDb.collection("transactions").doc(reference);
    
    await transactionRef.set({
      uid,
      username: userSnap.data()?.username || "Unknown",
      type: "DEPOSIT",
      amount: Math.floor(amountUsd * 100), // 100 Coins = $1.00 USD
      fiatAmount: amountUsd,
      gateway: "NOWPAYMENTS",
      reference,
      nowpayments_invoice_id: data.id,
      status: "PENDING",
      version: 1,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      metadata: { uid }
    });

    return { success: true, invoice_url: data.invoice_url, reference };

  } catch (error: any) {
    console.error("[NowPayments] Error:", error);
    return { 
      success: false, 
      error: error?.message || "Crypto gateway error. Please try again." 
    };
    return { success: false, error: "System failure initializing Gateway." };
  }
}

export async function internalFulfillCryptoDeposit(reference: string, amountUsd: number) {
  try {
     const transactionRef = adminDb.collection("transactions").doc(reference);
     const transactionSnap = await transactionRef.get();

     const t = transactionSnap.data();
     if (transactionSnap.exists && t?.status === 'COMPLETED') {
        return { success: true, message: "Already fulfilled." };
     }

     const uid = t?.uid;
     if (!uid) {
        return { success: false, error: "Critical: Reference mapping to User Identity failed." };
     }

     // 1.4 FIX: Verify amount to prevent webhook manipulation
     const verification = await verifyNowPaymentsAmount(reference, amountUsd);
     
     if (!verification.verified) {
       console.error(
         `[NowPaymentsDeposit] SECURITY: Amount verification failed for ${reference}`,
         verification.reason
       );
       return {
         success: false,
         error: "Payment verification failed: amount mismatch detected.",
       };
     }

     // Calculate strictly based on the USD peg (100 Coins = $1.00 USD)
     const coinsToCredit = Math.floor(amountUsd * 100);

     const userRef = adminDb.collection("users").doc(uid);
     const statsRef = adminDb.collection("stats").doc("platform_finances");

     // 1.4 FIX: Use optimistic locking with version field
     const currentVersion = t?.version || 0;
     const expectedVersion = currentVersion;

     await adminDb.runTransaction(async (transaction) => {
       const userSnap = await transaction.get(userRef);
       if (!userSnap.exists) throw new Error("Operative profile not found.");

       const localTransSnap = await transaction.get(transactionRef);
       
       if (localTransSnap.exists) {
         const localT = localTransSnap.data();
         if (localT?.status === 'COMPLETED') {
            return; // Already completed by another concurrent request
         }

         // Version mismatch means transaction already executed
         const localVersion = localT?.version || 0;
         if (localVersion !== expectedVersion) {
            if (localT?.status === 'COMPLETED') {
               return; // Already completed successfully
            }
            throw new Error("Transaction version conflict - retry aborted");
         }
       }

       transaction.update(userRef, {
         balanceCoins: admin.firestore.FieldValue.increment(coinsToCredit),
         lifetimeDeposits: admin.firestore.FieldValue.increment(coinsToCredit)
       });

       // Increment version and mark as COMPLETED
       transaction.set(transactionRef, {
         amount: coinsToCredit,
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
     if (err.message?.includes("version conflict")) {
        console.warn("[NowPayments Fulfillment] Version conflict (safe - will retry):", err.message);
     }
     console.error("[NowPayments Fulfillment] Atomic Error:", err);
     return { success: false, error: err.message };
  }
}

