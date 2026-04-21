import { NextResponse } from "next/server";
import { internalFulfillCryptoDeposit } from "@/app/actions/nowpayments-actions";
import {
  recordWebhookEvent,
  checkWebhookRateLimit,
  verifyNowPaymentsAmount,
} from "@/lib/payment-verification";
import { verifyNowPaymentsSignature } from "@/lib/webhook-security";

const NOWPAYMENTS_IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET;

/**
 * SECURITY FIXES:
 * 1.2: Record webhook event for idempotency
 * 1.2: Rate limit processing per reference
 * 1.4: Verify amount before fulfilling
 * 4.2: Constant-time signature verification
 */
export async function POST(req: Request) {
  try {
    if (!NOWPAYMENTS_IPN_SECRET) {
      console.error("[NowPayments Webhook] CRITICAL: NOWPAYMENTS_IPN_SECRET is missing from environment variables.");
      return NextResponse.json({ error: "Configuration Error" }, { status: 500 });
    }

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const signature = req.headers.get("x-nowpayments-sig") || "";

    // DEEP DIAGNOSTIC: Log headers and payload structure
    console.log("[NowPayments Webhook] DEBUG: Incoming IPN", {
      headers: {
        "x-nowpayments-sig": signature ? "EXISTS" : "MISSING",
        "content-type": req.headers.get("content-type"),
      },
      order_id: payload.order_id,
      payment_status: payload.payment_status,
      payment_id: payload.payment_id,
      all_keys: Object.keys(payload).sort().join(",")
    });

    // 4.2 FIX: Use constant-time signature verification with multi-method fallback
    const isValid = verifyNowPaymentsSignature(payload, signature, NOWPAYMENTS_IPN_SECRET, rawBody);

    if (!isValid) {
       console.error("[NowPayments Webhook] SECURITY: Invalid Signature detected. Check IPN Secret match.");
       // Additional debug: first 20 chars of sorted payload string
       return NextResponse.json({ error: "Invalid Signature" }, { status: 401 });
    }
    
    console.log(`[NowPayments Webhook] INFO: Signature Verified. Processing Order: ${payload.order_id}`);

    // Extract payment details
    const { payment_status, order_id, price_amount } = payload;

    if (!order_id || !price_amount) {
      console.warn("[NowPayments Webhook] Missing order_id or price_amount.");
      return NextResponse.json({ status: "acknowledged" }, { status: 200 });
    }



    // Status can be: 'waiting', 'confirming', 'confirmed', 'sending', 'partially_paid', 'finished', 'failed', 'refunded', 'expired'
    if (payment_status === "finished" || payment_status === "confirmed" || payment_status === "paid") {
       // 1.2 FIX: Record webhook event for idempotency checking (Only lock on successful states)
       const eventRecord = await recordWebhookEvent(
         payload.payment_id || null,
         order_id,
         "nowpayments",
         payment_status
       );

       if (!eventRecord.isNew) {
         console.log(`[NowPayments Webhook] IDEMPOTENCY: Event already processed.`);
         return NextResponse.json({ status: "acknowledged", duplicated: true }, { status: 200 });
       }

       // 1.2 FIX: Rate limit processing per reference
       const rateLimitCheck = await checkWebhookRateLimit(order_id, "nowpayments");
       if (!rateLimitCheck.allowed) {
         return NextResponse.json(
           { error: "Rate limited", retryAfter: rateLimitCheck.retryAfterSeconds },
           { status: 429 }
         );
       }

       const amountUsd = Number(price_amount);

       if (amountUsd > 0) {
          // 1.4 FIX: Verify amount before fulfilling to prevent manipulation
          const verification = await verifyNowPaymentsAmount(order_id, amountUsd);

          if (!verification.verified) {
            console.error(
              `[NowPayments Webhook] SECURITY: Amount verification failed for ${order_id}`,
              {
                reason: verification.reason,
                claimed: verification.claimedAmountUsd,
                stored: verification.storedAmountUsd,
              }
            );
            // Don't fulfill - potential attack
            return NextResponse.json({ status: "acknowledged" }, { status: 200 });
          }

          const result = await internalFulfillCryptoDeposit(order_id, amountUsd);
          if (result.success) {
            console.log(`[NowPayments Webhook] Fulfilled order ${order_id} for $${amountUsd} USD.`);
            return NextResponse.json({ status: "success", processing: "fulfilled" });
          } else {
            console.error(`[NowPayments Webhook] Fulfillment failed for ${order_id}:`, result.error);
            return NextResponse.json({ error: result.error }, { status: 400 });
          }
       }
    }

    return NextResponse.json({ status: "acknowledged", payment_status });
  } catch (error: any) {
    console.error("[NowPayments Webhook] Error processing IPN:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
