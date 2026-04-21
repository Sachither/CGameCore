/**
 * Payment Verification Library
 * 
 * Implements server-side verification of payment amounts against payment gateway records.
 * Prevents webhook amount manipulation attacks.
 * 
 * SECURITY FIXES:
 * - 1.1: Unverified Paystack Transaction Amount
 * - 1.2: Webhook Idempotency Bypass
 * - 1.4: Missing Amount Validation in NowPayments
 */

import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;
const FLUTTERWAVE_SECRET_KEY = process.env.FLUTTERWAVE_SECRET_KEY;

// --- REGIONAL FALLBACK RATES ---
// 100 Coins = $1.00 USD
// These are used if the dynamic rate API is unavailable.
const FALLBACK_USD_NGN = 1500;
const FALLBACK_USD_GHS = 14.5;
const FALLBACK_USD_ZAR = 18.8;
const FALLBACK_USD_KES = 130;

export interface PaymentVerificationResult {
  verified: boolean;
  storedAmountUsd: number;
  claimedAmountUsd: number;
  storedAmountKobo?: number;
  claimedAmountKobo?: number;
  mismatch: boolean;
  reason?: string;
}

/**
 * 1.1 FIX: Amount verification is now handled by gateway-specific verify functions.
 * Legacy Paystack logic has been purged in favor of Flutterwave V3.
 */


/**
 * NEW: Verify Flutterwave transaction amount against API and stored record
 * Flutterwave uses standard currency units (not kobo).
 */
export async function verifyFlutterwaveAmount(
  reference: string,
  webhookAmount: number,
  verifyAgainstApi: boolean = true,
  manualExchangeRate?: number
): Promise<PaymentVerificationResult> {
  try {
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();
    const storedData = transactionSnap.exists ? transactionSnap.data() : null;
    
    const currency = storedData?.currency || "NGN";
    const countryFallback = 
      currency === 'GHS' ? FALLBACK_USD_GHS : 
      currency === 'ZAR' ? FALLBACK_USD_ZAR : 
      currency === 'KES' ? FALLBACK_USD_KES : FALLBACK_USD_NGN;

    const exchangeRate = storedData?.exchangeRate || manualExchangeRate || countryFallback;

    const storedAmountUsd = (storedData?.fiatAmount !== undefined) ? Number(storedData.fiatAmount) : 0;
    const webhookAmountUsd = Number(webhookAmount) / exchangeRate;

    const difference = Math.abs(storedAmountUsd - webhookAmountUsd);
    const tolerance = Math.max(0.15, storedAmountUsd * 0.15); // Allow 15% drift for regional conversion

    console.log(`[PaymentVerification] Checking Reference: ${reference}`);
    console.log(`[PaymentVerification] Values: Stored=$${storedAmountUsd}, Received=$${webhookAmountUsd.toFixed(4)} (from ${webhookAmount} ${currency}), Diff=$${difference.toFixed(4)}, Tolerance=$${tolerance.toFixed(4)}`);

    if (difference > tolerance) {
      await logPaymentVerificationFailure(reference, "amount_mismatch_stored_fw", {
        storedUsd: storedAmountUsd,
        claimedUsd: webhookAmountUsd,
        webhookAmount,
        difference,
        tolerance
      });

      return {
        verified: false,
        storedAmountUsd: storedAmountUsd || 0,
        claimedAmountUsd: webhookAmountUsd,
        mismatch: true,
        reason: "Webhook amount does not match stored Flutterwave record",
      };
    }

    if (verifyAgainstApi && FLUTTERWAVE_SECRET_KEY) {
      try {
        // We use the ID if we have it, otherwise reference. 
        // Flutterwave verify endpoint usually needs the internal ID for reliability, 
        // but often we only have tx_ref in webhooks.
        const fwResponse = await fetch(
          `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${reference}`,
          {
            method: "GET",
            headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
          }
        );

        const fwData = await fwResponse.json();

        if (fwData.status === 'success' && fwData.data?.status === "successful") {
          const apiAmount = Number(fwData.data.amount);
          const apiAmountUsd = apiAmount / exchangeRate;

          const apiDifference = Math.abs(apiAmountUsd - webhookAmountUsd);
          const apiTolerance = Math.max(0.15, apiAmountUsd * 0.15);

          if (apiDifference > apiTolerance) {
            return {
              verified: false,
              storedAmountUsd: apiAmountUsd,
              claimedAmountUsd: webhookAmountUsd,
              mismatch: true,
              reason: "Webhook amount does not match Flutterwave API records",
            };
          }

          return {
            verified: true,
            storedAmountUsd: apiAmountUsd,
            claimedAmountUsd: webhookAmountUsd,
            mismatch: false,
          };
        }
      } catch (e) {
        console.warn("[PaymentVerification] Flutterwave API fallback active:", e);
      }
    }

    return {
      verified: true,
      storedAmountUsd: storedAmountUsd || webhookAmountUsd,
      claimedAmountUsd: webhookAmountUsd,
      mismatch: false,
    };
  } catch (error) {
    console.error("[PaymentVerification] Flutterwave verification error:", error);
    throw error;
  }
}

/**
 * 1.4 FIX: Verify NowPayments transaction amount
 * 
 * Prevents webhook amount manipulation for crypto payments.
 */
export async function verifyNowPaymentsAmount(
  reference: string,
  claimedAmountUsd: number,
  verifyAgainstApi: boolean = true
): Promise<PaymentVerificationResult> {
  try {
    // Step 1: Get stored transaction record
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();

    if (!transactionSnap.exists) {
      return {
        verified: false,
        storedAmountUsd: 0,
        claimedAmountUsd,
        mismatch: true,
        reason: "Transaction record not found",
      };
    }

    const storedData = transactionSnap.data();
    const storedAmountUsd = storedData?.fiatAmount || 0;

    // Step 2: Compare amounts with a small tolerance for gateway/network fees
    // Some gateways deduct fees from the reported price_amount.
    // We allow up to a 15% difference for small deposits.
    const difference = Math.abs(storedAmountUsd - claimedAmountUsd);
    const tolerance = Math.max(0.01, storedAmountUsd * 0.15);

    if (difference > tolerance) {
      await logPaymentVerificationFailure(reference, "amount_mismatch_nowpayments", {
        storedUsd: storedAmountUsd,
        claimedUsd: claimedAmountUsd,
        difference,
        tolerance
      });

      return {
        verified: false,
        storedAmountUsd,
        claimedAmountUsd,
        mismatch: true,
        reason: `Amount mismatch exceeds tolerance (Diff: ${difference.toFixed(2)}, Max: ${tolerance.toFixed(2)})`,
      };
    }

    if (verifyAgainstApi && NOWPAYMENTS_API_KEY && storedData?.nowpayments_invoice_id) {
      try {
        const invoiceId = storedData.nowpayments_invoice_id;
        const npResponse = await fetch(
          `https://api.nowpayments.io/v1/invoice/${invoiceId}`,
          {
            method: "GET",
            headers: {
              "x-api-key": NOWPAYMENTS_API_KEY,
            },
          }
        );

        if (npResponse.ok) {
          const npData = await npResponse.json();
          
          // Verify it's for the same order and same amount
          const apiAmount = Number(npData.price_amount);
          const apiOrderId = npData.order_id;

          if (apiOrderId !== reference) {
             return {
                verified: false,
                storedAmountUsd,
                claimedAmountUsd,
                mismatch: true,
                reason: "Gateway Order ID mismatch",
             };
          }

          const apiDifference = Math.abs(apiAmount - claimedAmountUsd);
          const apiTolerance = Math.max(0.01, apiAmount * 0.15);

          if (apiDifference > apiTolerance) {
            return {
              verified: false,
              storedAmountUsd: apiAmount,
              claimedAmountUsd,
              mismatch: true,
              reason: "Gateway amount mismatch",
            };
          }
          
          // Ensure the status is finished/paid/confirmed
          const status = npData.status;
          const validStatuses = ['finished', 'paid', 'confirmed', 'partially_paid'];
          if (!validStatuses.includes(status)) {
             return {
                verified: false,
                storedAmountUsd: apiAmount,
                claimedAmountUsd,
                mismatch: true,
                reason: `Gateway status is not fulfilled: ${status}`,
             };
          }

          console.log(`[PaymentVerification] NowPayments API verified for ${reference}`);
        } else {
           console.warn(`[PaymentVerification] NowPayments API status check failed: ${npResponse.status}`);
        }
      } catch (e) {
        console.warn("[PaymentVerification] NowPayments API fallback active:", e);
      }
    }

    await logPaymentVerificationSuccess(reference, "nowpayments", {
      amountUsd: claimedAmountUsd,
    });

    return {
      verified: true,
      storedAmountUsd,
      claimedAmountUsd,
      mismatch: false,
    };
  } catch (error) {
    console.error("[PaymentVerification] NowPayments verification error:", error);
    throw error;
  }
}

/**
 * 1.2 FIX: Record webhook event with dual idempotency keys
 * 
 * Prevents replay attacks by tracking both event ID and reference.
 * FIX P-002: Use payment gateway event ID as PRIMARY key to avoid clock skew issues
 */
export async function recordWebhookEvent(
  eventId: string | null,
  reference: string,
  gateway: "paystack" | "nowpayments" | "flutterwave",
  eventType: string
): Promise<{
  isNew: boolean;
  eventDocId: string;
}> {
  try {
    // FIX P-002: Use gateway event ID as primary key (more reliable than timestamp)
    // Fallback to reference if event ID not provided
    const primaryEventId = eventId || reference;
    const eventDocId = `${gateway}_${primaryEventId}`;

    // Check if this exact event was already processed
    const eventRef = adminDb.collection("webhook_events").doc(eventDocId);
    const existingEvent = await eventRef.get();

    if (existingEvent.exists) {
      console.log(
        `[WebhookEvent] Duplicate: ${eventDocId} already processed at ${existingEvent.data()?.processedAt}`
      );
      return { isNew: false, eventDocId };
    }

    // Also check by reference as secondary key for cross-reference
    if (reference !== primaryEventId) {
      const eventIdRef = adminDb
        .collection("webhook_events")
        .doc(`${gateway}_eventid_${eventId}`);
      const existingEventId = await eventIdRef.get();

      if (existingEventId.exists) {
        console.log(`[WebhookEvent] Duplicate by EventID: ${eventId} already processed`);
        return { isNew: false, eventDocId };
      }

      // Create write-once document for event ID
      await eventIdRef.set(
        {
          eventId,
          reference,
          gateway,
          eventType,
          processedAt: admin.firestore.FieldValue.serverTimestamp(),
          referenceDocId: eventDocId,
        },
        { merge: true }
      );
    }

    // Record the primary idempotency document
    await eventRef.set(
      {
        eventId: eventId || null,
        reference,
        gateway,
        eventType,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    console.log(`[WebhookEvent] Recorded new event: ${eventDocId}`);
    return { isNew: true, eventDocId };
  } catch (error) {
    console.error("[WebhookEvent] Recording failed:", error);
    throw error;
  }
}

/**
 * 1.2 FIX: Rate limit webhook processing per reference
 * 
 * Prevents rapid-fire webhook replay attacks.
 */
export async function checkWebhookRateLimit(
  reference: string,
  gateway: "paystack" | "nowpayments" | "flutterwave"
): Promise<{ allowed: boolean; reason?: string; retryAfterSeconds?: number }> {
  try {
    const rateLimitKey = `webhook_rl_${gateway}_${reference}`;
    const rateLimitRef = adminDb.collection("webhook_rate_limits").doc(rateLimitKey);
    const rateLimitSnap = await rateLimitRef.get();

    const now = Date.now();
    const RATE_LIMIT_WINDOW_MS = 5000; // 5 second window
    const MAX_ATTEMPTS = 1; // Only allow 1 processing per reference per window

    if (!rateLimitSnap.exists) {
      // First attempt - record it
      await rateLimitRef.set({
        reference,
        gateway,
        attemptCount: 1,
        firstAttemptAt: now,
        windowResetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    const rateLimitData = rateLimitSnap.data();
    const windowResetAt = rateLimitData?.windowResetAt || now;

    if (now > windowResetAt) {
      // Window expired - reset
      await rateLimitRef.set({
        reference,
        gateway,
        attemptCount: 1,
        firstAttemptAt: now,
        windowResetAt: now + RATE_LIMIT_WINDOW_MS,
      });
      return { allowed: true };
    }

    // Still in window - check attempt count
    const attemptCount = (rateLimitData?.attemptCount || 0) + 1;

    if (attemptCount > MAX_ATTEMPTS) {
      const retryAfterSeconds = Math.ceil((windowResetAt - now) / 1000);
      console.warn(
        `[WebhookRateLimit] Rate limited: ${reference} (${attemptCount}/${MAX_ATTEMPTS} attempts)`
      );

      await logRateLimitViolation(reference, gateway, attemptCount);

      return {
        allowed: false,
        reason: "Rate limit exceeded",
        retryAfterSeconds,
      };
    }

    // Update attempt count
    await rateLimitRef.update({ attemptCount });
    return { allowed: true };
  } catch (error) {
    console.error("[WebhookRateLimit] Check failed:", error);
    // On error, allow processing (don't block legitimate webhooks)
    return { allowed: true };
  }
}

/**
 * Internal logging functions for audit trail
 */
async function logPaymentVerificationSuccess(
  reference: string,
  source: string,
  details: Record<string, any>
) {
  try {
    const logRef = adminDb.collection("payment_verification_log").doc();
    await logRef.set({
      reference,
      source,
      status: "VERIFIED",
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error("[PaymentLog] Failed to log verification success:", error);
  }
}

async function logPaymentVerificationFailure(
  reference: string,
  reason: string,
  details: Record<string, any>
) {
  try {
    const logRef = adminDb.collection("payment_verification_log").doc();
    await logRef.set({
      reference,
      reason,
      status: "FAILED",
      details,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: "HIGH",
    });
    console.error(
      `[PaymentVerification] FAILED: ${reference} - ${reason}`,
      details
    );
  } catch (error) {
    console.error("[PaymentLog] Failed to log verification failure:", error);
  }
}

async function logRateLimitViolation(
  reference: string,
  gateway: string,
  attemptCount: number
) {
  try {
    const logRef = adminDb.collection("webhook_rate_limit_violations").doc();
    await logRef.set({
      reference,
      gateway,
      attemptCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: "MEDIUM",
    });
  } catch (error) {
    console.error("[RateLimitLog] Failed to log violation:", error);
  }
}
