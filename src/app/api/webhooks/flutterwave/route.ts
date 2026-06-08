import { NextResponse } from 'next/server';
import { internalFulfillFlutterwaveDeposit } from '@/app/actions/flutterwave-actions';
import { 
  verifyFlutterwaveAmount, 
  recordWebhookEvent, 
  checkWebhookRateLimit 
} from '@/lib/payment-verification';

const FLUTTERWAVE_WEBHOOK_HASH = process.env.FLUTTERWAVE_WEBHOOK_HASH;

/**
 * Flutterwave V3 Webhook Handler
 * Endpoint: /api/webhooks/flutterwave
 * 
 * SETUP INSTRUCTIONS:
 * 1. Log into your Flutterwave Dashboard (https://dashboard.flutterwave.com)
 * 2. Go to Settings → Webhooks
 * 3. Set Webhook URL to: https://yourdomain.com/api/webhooks/flutterwave
 * 4. Copy the webhook hash and set as FLUTTERWAVE_WEBHOOK_HASH env var
 * 5. Make sure your domain is accessible from the internet (not localhost)
 * 6. Test with Flutterwave's webhook test feature
 */
export async function POST(req: Request) {
  try {
    // Log request for debugging
    const requestUrl = new URL(req.url);
    const body = await req.json();
    const signature = req.headers.get('verif-hash');

    console.log(`[FlutterwaveWebhook] Received webhook from ${req.headers.get('origin') || 'unknown'}`);
    console.log(`[FlutterwaveWebhook] Event: ${body.event}, Status: ${body.data?.status}`);

    // 1. Signature Verification
    if (!FLUTTERWAVE_WEBHOOK_HASH) {
      console.error("[FlutterwaveWebhook] ❌ FLUTTERWAVE_WEBHOOK_HASH is not configured in environment");
      return new NextResponse(
        JSON.stringify({ 
          error: "Webhook not configured",
          details: "FLUTTERWAVE_WEBHOOK_HASH missing from environment variables"
        }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!signature) {
      console.warn("[FlutterwaveWebhook] ❌ Missing verif-hash header from Flutterwave");
      return new NextResponse("Missing signature header", { status: 401 });
    }

    if (signature !== FLUTTERWAVE_WEBHOOK_HASH) {
      console.warn("[FlutterwaveWebhook] ❌ Invalid signature. Expected != Received");
      console.warn(`[FlutterwaveWebhook] Received: ${signature?.substring(0, 20)}...`);
      console.warn(`[FlutterwaveWebhook] Expected: ${FLUTTERWAVE_WEBHOOK_HASH.substring(0, 20)}...`);
      return new NextResponse("Unauthorized: Invalid signature", { status: 401 });
    }

    const event = body.event;
    const data = body.data;
    const reference = data?.tx_ref;
    const fwId = data?.id;

    if (event !== 'charge.completed' || data?.status !== 'successful') {
      console.log(`[FlutterwaveWebhook] ℹ️ Ignoring non-completion event: ${event} (status: ${data?.status})`);
      return NextResponse.json({ received: true });
    }

    if (!reference || !fwId) {
      console.error("[FlutterwaveWebhook] ❌ Missing reference/id in payload.", { reference, fwId });
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // 2. Idempotency Check
    const eventId = `fw_${fwId}`;
    const eventRecord = await recordWebhookEvent(fwId.toString(), reference, "flutterwave", event);
    if (!eventRecord.isNew) {
      console.log(`[FlutterwaveWebhook] ℹ️ Duplicate event detected for ${reference}, skipping`);
      return NextResponse.json({ duplicate: true });
    }

    // 3. Rate Limiting
    const rateLimit = await checkWebhookRateLimit(reference, "flutterwave");
    if (!rateLimit.allowed) {
      console.warn(`[FlutterwaveWebhook] ⚠️ Rate limit exceeded for ${reference}`);
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    console.log(`[FlutterwaveWebhook] Processing charge.completed for ${reference} (FW ID: ${fwId})...`);

    // 4. Amount Verification (Against API)
    const verification = await verifyFlutterwaveAmount(reference, data.amount, true);
    if (!verification.verified) {
      console.error(`[FlutterwaveWebhook] ❌ SECURITY ALERT: Amount mismatch for ${reference}`);
      console.error(`[FlutterwaveWebhook] Expected: $${verification.storedAmountUsd}, Received: $${verification.claimedAmountUsd}`);
      return NextResponse.json({ error: "Amount verification failed" }, { status: 400 });
    }

    // 5. Fulfillment
    const result = await internalFulfillFlutterwaveDeposit(reference, data.amount);

    if (result.success) {
      console.log(`[FlutterwaveWebhook] ✅ Fulfillment success for ${reference}, ${result.coinsAdded} coins credited`);
      return NextResponse.json({ success: true });
    } else {
      console.warn(`[FlutterwaveWebhook] ⚠️ Fulfillment error for ${reference}: ${result.error}`);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

  } catch (error) {
    console.error("[FlutterwaveWebhook] 🔥 Critical Error:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
