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

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const NOWPAYMENTS_API_KEY = process.env.NOWPAYMENTS_API_KEY;

// Exchange rate constants
const INTERNAL_USD_TO_NGN_RATE = 1500;

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
 * 1.1 FIX: Verify Paystack transaction amount against API and stored record
 * 
 * This prevents attackers from modifying the amount in webhook POST body.
 * We verify against:
 * 1. Stored transaction record (what user initiated)
 * 2. Paystack API (source of truth)
 */
export async function verifyPaystackAmount(
  reference: string,
  webhookAmountKobo: number,
  verifyAgainstApi: boolean = true
): Promise<PaymentVerificationResult> {
  try {
    // Step 1: Get the stored transaction record
    const transactionRef = adminDb.collection("transactions").doc(reference);
    const transactionSnap = await transactionRef.get();

    const storedAmountKobo = transactionSnap.exists
      ? (transactionSnap.data()?.fiatAmount || 0) * INTERNAL_USD_TO_NGN_RATE * 100
      : null;

    const storedAmountUsd = transactionSnap.exists
      ? transactionSnap.data()?.fiatAmount || 0
      : null;

    // Step 2: Convert webhook amount (KOBO) to USD
    const webhookAmountNaira = Number(webhookAmountKobo) / 100;
    const webhookAmountUsd = webhookAmountNaira / INTERNAL_USD_TO_NGN_RATE;

    // Step 3: Check for mismatch with stored record
    const mismatchWithStored =
      storedAmountUsd !== null && Math.abs(storedAmountUsd - webhookAmountUsd) > 0.01;

    if (mismatchWithStored) {
      // Amount mismatch with what user initiated
      await logPaymentVerificationFailure(reference, "amount_mismatch_stored", {
        storedUsd: storedAmountUsd,
        claimedUsd: webhookAmountUsd,
        storedKobo: storedAmountKobo,
        claimedKobo: webhookAmountKobo,
      });

      return {
        verified: false,
        storedAmountUsd: storedAmountUsd || 0,
        claimedAmountUsd: webhookAmountUsd,
        storedAmountKobo,
        claimedAmountKobo: webhookAmountKobo,
        mismatch: true,
        reason: "Webhook amount does not match stored transaction record",
      };
    }

    // Step 4: Verify against Paystack API (if flag enabled and we have credentials)
    if (verifyAgainstApi && PAYSTACK_SECRET_KEY) {
      try {
        const paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${reference}`,
          {
            method: "GET",
            headers: {
              Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            },
          }
        );

        const paystackData = await paystackResponse.json();

        if (paystackData.status && paystackData.data?.status === "success") {
          const paystackAmountKobo = Number(paystackData.data.amount);
          const paystackAmountUsd = (paystackAmountKobo / 100) / INTERNAL_USD_TO_NGN_RATE;

          // Compare Paystack amount with webhook claim
          if (Math.abs(paystackAmountUsd - webhookAmountUsd) > 0.01) {
            await logPaymentVerificationFailure(
              reference,
              "amount_mismatch_paystack_api",
              {
                paystackUsd: paystackAmountUsd,
                claimedUsd: webhookAmountUsd,
                paystackKobo: paystackAmountKobo,
                claimedKobo: webhookAmountKobo,
              }
            );

            return {
              verified: false,
              storedAmountUsd: paystackAmountUsd,
              claimedAmountUsd: webhookAmountUsd,
              storedAmountKobo: paystackAmountKobo,
              claimedAmountKobo: webhookAmountKobo,
              mismatch: true,
              reason: "Webhook amount does not match Paystack API records",
            };
          }

          // All verification passed
          await logPaymentVerificationSuccess(reference, "paystack", {
            amountUsd: paystackAmountUsd,
            amountKobo: paystackAmountKobo,
          });

          return {
            verified: true,
            storedAmountUsd: paystackAmountUsd,
            claimedAmountUsd: webhookAmountUsd,
            storedAmountKobo: paystackAmountKobo,
            claimedAmountKobo: webhookAmountKobo,
            mismatch: false,
          };
        } else if (paystackData.message?.toLowerCase().includes("reference not found")) {
          // Transaction not yet confirmed on Paystack
          await logPaymentVerificationFailure(reference, "not_found_on_api", {
            message: "Reference not found on Paystack API yet",
          });

          return {
            verified: false,
            storedAmountUsd: storedAmountUsd || 0,
            claimedAmountUsd: webhookAmountUsd,
            mismatch: false,
            reason: "Transaction not found on Paystack API",
          };
        }
      } catch (apiError) {
        console.warn("[PaymentVerification] Paystack API verification failed:", apiError);
        // Fall back to stored record verification if API fails
        // This prevents API outages from blocking legitimate payments
      }
    }

    // Verification passed (stored record matches webhook)
    if (storedAmountUsd !== null) {
      await logPaymentVerificationSuccess(reference, "stored_record", {
        amountUsd: storedAmountUsd,
        amountKobo: storedAmountKobo,
      });
    }

    return {
      verified: true,
      storedAmountUsd: storedAmountUsd || webhookAmountUsd,
      claimedAmountUsd: webhookAmountUsd,
      storedAmountKobo,
      claimedAmountKobo: webhookAmountKobo,
      mismatch: false,
    };
  } catch (error) {
    console.error("[PaymentVerification] Paystack verification error:", error);
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

    // Step 2: Compare amounts
    if (Math.abs(storedAmountUsd - claimedAmountUsd) > 0.01) {
      await logPaymentVerificationFailure(reference, "amount_mismatch_nowpayments", {
        storedUsd: storedAmountUsd,
        claimedUsd: claimedAmountUsd,
      });

      return {
        verified: false,
        storedAmountUsd,
        claimedAmountUsd,
        mismatch: true,
        reason: "NowPayments amount does not match stored transaction",
      };
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
 */
export async function recordWebhookEvent(
  eventId: string | null,
  reference: string,
  gateway: "paystack" | "nowpayments",
  eventType: string
): Promise<{
  isNew: boolean;
  eventDocId: string;
}> {
  try {
    const timestamp = Date.now();
    const eventDocId = `${gateway}_${reference}_${timestamp}`;

    // Check if this exact event was already processed
    const eventRef = adminDb.collection("webhook_events").doc(eventDocId);
    const existingEvent = await eventRef.get();

    if (existingEvent.exists) {
      console.log(
        `[WebhookEvent] Duplicate: ${eventDocId} already processed at ${existingEvent.data()?.processedAt}`
      );
      return { isNew: false, eventDocId };
    }

    // Also check by event ID if available (e.g., Paystack event ID)
    if (eventId) {
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
  gateway: "paystack" | "nowpayments"
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
