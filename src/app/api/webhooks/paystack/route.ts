import { NextResponse } from 'next/server';
import { internalFulfillDeposit } from '@/app/actions/paystack-actions';
import { adminDb } from '@/lib/firebase-admin';
import admin from 'firebase-admin';
import {
  verifyPaystackAmount,
  recordWebhookEvent,
  checkWebhookRateLimit,
} from "@/lib/payment-verification";
import { verifyWebhookSignature } from "@/lib/webhook-security";

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Paystack Webhook Handler
 * Endpoint: /api/webhooks/paystack
 * 
 * SECURITY FIXES:
 * 1.1: Verify amount against stored record before fulfilling
 * 1.2: Dual idempotency (event ID + reference + timestamp)
 * 1.2: Rate limit processing per reference
 * 4.2: Constant-time signature verification
 */
export async function POST(req: Request) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[PaystackWebhook] Missing PAYSTACK_SECRET_KEY.");
      return new Response('Configuration Error', { status: 500 });
    }

    // 1. RAW BODY for Signature Verification
    const body = await req.text();
    
    // 4.2 FIX: Use constant-time signature verification
    const signature = req.headers.get('x-paystack-signature');
    const isValid = verifyWebhookSignature(body, signature || '', PAYSTACK_SECRET_KEY);

    if (!isValid) {
      console.warn("[PaystackWebhook] Invalid Signature detected.");
      return new Response('Unauthorized Request', { status: 401 });
    }

    // 2. PARSE PAYLOAD
    const event = JSON.parse(body);
    const eventId = event.data?.id || event.id; // Paystack event ID
    const reference = event.data?.reference;

    if (!reference) {
      console.warn("[PaystackWebhook] No reference in payload.");
      return NextResponse.json({ received: true }, { status: 200 });
    }

    // 1.2 FIX: Record webhook event with dual idempotency
    const eventRecord = await recordWebhookEvent(eventId, reference, "paystack", event.event);
    
    if (!eventRecord.isNew) {
      console.log(`[PaystackWebhook] IDEMPOTENCY: Event already processed.`);
      return NextResponse.json({ received: true, duplicated: true }, { status: 200 });
    }

    // 1.2 FIX: Check rate limit to prevent replay attacks
    const rateLimitCheck = await checkWebhookRateLimit(reference, "paystack");
    if (!rateLimitCheck.allowed) {
      console.warn(
        `[PaystackWebhook] Rate limited: ${reference}. Retry after ${rateLimitCheck.retryAfterSeconds}s`
      );
      return NextResponse.json(
        { error: "Rate limited", retryAfter: rateLimitCheck.retryAfterSeconds },
        { status: 429 }
      );
    }

    // 3. ACTION SELECTION
    if (event.event === 'charge.success') {
      const amount = event.data?.amount;
      
      if (!amount) {
        console.warn(`[PaystackWebhook] No amount in payload for ${reference}`);
        return NextResponse.json({ received: true }, { status: 200 });
      }

      console.log(`[PaystackWebhook] Processing success event for ${reference}...`);

      // 1.1 FIX: Verify amount before fulfilling
      const verification = await verifyPaystackAmount(reference, amount, true);

      if (!verification.verified) {
        console.error(
          `[PaystackWebhook] SECURITY: Amount verification failed for ${reference}`,
          {
            reason: verification.reason,
            claimed: verification.claimedAmountUsd,
            stored: verification.storedAmountUsd,
          }
        );
        // Don't fulfill - potential attack
        return NextResponse.json({ received: true }, { status: 200 });
      }

      const result = await internalFulfillDeposit(reference, amount);

      if (result.success) {
        console.log(`[PaystackWebhook] ✅ Successfully fulfilled deposit ${reference}.`);
      } else {
        console.warn(`[PaystackWebhook] ⚠️ Fulfillment failed or already processed for ${reference}:`, result.error);
      }
    }

    // Always respond with 200 to acknowledge receipt of webhook
    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("[PaystackWebhook] Critical Failure:", error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

// Ensure the body isn't parsed prematurely (Standard Next.js Route Config)
export const dynamic = 'force-dynamic';
