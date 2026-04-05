import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { internalFulfillDeposit } from '@/app/actions/paystack-actions';

const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

/**
 * Paystack Webhook Handler
 * Endpoint: /api/webhooks/paystack
 * 
 * Securely listens for 'charge.success' events from Paystack and 
 * automatically fulfills coin deposits for users.
 */
export async function POST(req: Request) {
  try {
    if (!PAYSTACK_SECRET_KEY) {
      console.error("[PaystackWebhook] Missing PAYSTACK_SECRET_KEY.");
      return new Response('Configuration Error', { status: 500 });
    }

    // 1. RAW BODY for Signature Verification
    const body = await req.text();
    
    // 2. SIGNATURE VERIFICATION (HMAC SHA512)
    const signature = req.headers.get('x-paystack-signature');
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(body).digest('hex');

    if (hash !== signature) {
      console.warn("[PaystackWebhook] Invalid Signature detected.");
      return new Response('Unauthorized Request', { status: 401 });
    }

    // 3. PARSE PAYLOAD
    const event = JSON.parse(body);

    // 4. ACTION SELECTION
    // We only care about successful charges for now
    if (event.event === 'charge.success') {
      const { reference, amount } = event.data;
      
      console.log(`[PaystackWebhook] Processing success event for ${reference}...`);

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
