/**
 * Webhook Security Library
 * 
 * 4.2 FIX: Constant-time signature verification to prevent timing attacks
 */

import crypto from "crypto";

/**
 * Verify webhook signature using constant-time comparison.
 * 
 * SECURITY FIX 4.2: Prevents timing attacks on signature verification.
 * 
 * Timing attacks work by measuring response times:
 * - String comparison fails on first byte mismatch (fast)
 * - Attacker sends variations and measures response times
 * - Can leak information about signature byte-by-byte
 * 
 * Solution: Use crypto.timingSafeEqual() which always takes same time
 * regardless of where mismatch occurs.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string,
  secret: string,
  algorithm: "sha512" | "sha256" = "sha512"
): boolean {
  try {
    // Generate HMAC hash
    const hash = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest("hex");

    // Convert both to buffers for constant-time comparison
    const hashBuffer = Buffer.from(hash);
    const signatureBuffer = Buffer.from(signature);

    if (hashBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
  } catch (error) {
    console.error("[WebhookSecurity] Signature verification error:", error);
    return false;
  }
}

/**
 * Verify NowPayments-style sorted JSON signature
 */
export function verifyNowPaymentsSignature(
  payload: Record<string, any>,
  signature: string,
  secret: string
): boolean {
  try {
    // NowPayments requires sorted keys for signature
    const sortedPayloadStr = JSON.stringify(payload, Object.keys(payload).sort());
    const hash = crypto
      .createHmac("sha512", secret)
      .update(sortedPayloadStr)
      .digest("hex");

    const hashBuffer = Buffer.from(hash);
    const signatureBuffer = Buffer.from(signature);

    if (hashBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
  } catch (error) {
    console.error("[WebhookSecurity] NowPayments signature verification error:", error);
    return false;
  }
}
