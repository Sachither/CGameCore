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
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const signature = req.headers.get('verif-hash');

    // 1. Signature Verification
    if (!FLUTTERWAVE_WEBHOOK_HASH || signature !== FLUTTERWAVE_WEBHOOK_HASH) {
      console.warn("[FlutterwaveWebhook] Invalid Signature or Hash missing.");
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const event = body.event;
    const data = body.data;
    const reference = data?.tx_ref;
    const fwId = data?.id;

    if (event !== 'charge.completed' || data?.status !== 'successful') {
      console.log(`[FlutterwaveWebhook] Ignoring non-completion event: ${event}`);
      return NextResponse.json({ received: true });
    }

    if (!reference || !fwId) {
      console.error("[FlutterwaveWebhook] Missing reference/id in payload.");
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // 2. Idempotency Check
    const eventId = `fw_${fwId}`;
    const eventRecord = await recordWebhookEvent(fwId.toString(), reference, "flutterwave", event);
    if (!eventRecord.isNew) {
      return NextResponse.json({ duplicate: true });
    }

    // 3. Rate Limiting
    const rateLimit = await checkWebhookRateLimit(reference, "flutterwave");
    if (!rateLimit.allowed) {
      return new NextResponse("Too Many Requests", { status: 429 });
    }

    console.log(`[FlutterwaveWebhook] Processing success for ${reference} (${fwId})...`);

    // 4. Amount Verification (Against API)
    const verification = await verifyFlutterwaveAmount(reference, data.amount, true);
    if (!verification.verified) {
      console.error(`[FlutterwaveWebhook] SECURITY mismatch for ${reference}`);
      return NextResponse.json({ error: "Amount verification failed" }, { status: 400 });
    }

    // 5. Fulfillment
    const result = await internalFulfillFlutterwaveDeposit(reference, data.amount);

    if (result.success) {
      console.log(`[FlutterwaveWebhook] ✅ Fulfillment success for ${reference}`);
      return NextResponse.json({ success: true });
    } else {
      console.warn(`[FlutterwaveWebhook] ⚠️ Fulfillment error for ${reference}:`, result.error);
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

  } catch (error) {
    console.error("[FlutterwaveWebhook] Critical Error:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
