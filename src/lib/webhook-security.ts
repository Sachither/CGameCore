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
  secret: string,
  rawBody?: string
): boolean {
  try {
    const cleanSignature = signature.trim().toLowerCase();
    const signatureBuffer = Buffer.from(cleanSignature);

    // Prepare sorted payload
    const sortedPayloadStr = JSON.stringify(payload, Object.keys(payload).sort());
    
    // Define the candidate strings and secrets
    const candidateStrings = [sortedPayloadStr];
    if (rawBody) candidateStrings.push(rawBody);

    const candidateSecrets = [
      { key: secret, label: "UTF8_STRING" },
    ];
    
    // Try Base64 secret as well if it looks like one
    if (secret.includes('/') || secret.includes('+')) {
      try {
        candidateSecrets.push({ 
          key: Buffer.from(secret, 'base64').toString('binary'), 
          label: "BASE64_DECODED" 
        });
      } catch (e) {}
    }

    // Brute-force verification
    for (const candString of candidateStrings) {
      for (const candSec of candidateSecrets) {
        const hash = crypto
          .createHmac("sha512", candSec.key)
          .update(candString)
          .digest("hex");

        const hashBuffer = Buffer.from(hash);

        if (hashBuffer.length === signatureBuffer.length) {
          if (crypto.timingSafeEqual(hashBuffer, signatureBuffer)) {
            console.log(`[WebhookSecurity] NowPayments verification SUCCESS using ${candSec.label} and ${candString === rawBody ? "RAW_BODY" : "SORTED_JSON"}`);
            return true;
          }
        }
      }
    }

    // If none matched, log detailed mismatch for the primary expected method (Sorted JSON + UTF8 Secret)
    const primaryHash = crypto.createHmac("sha512", secret).update(sortedPayloadStr).digest("hex");
    
    console.warn("[WebhookSecurity] NowPayments multi-method signature mismatch detailed check:", {
      payloadKeys: Object.keys(payload).sort().join(","),
      hashPreview: `${primaryHash.substring(0, 4)}...${primaryHash.substring(primaryHash.length - 4)}`,
      sigPreview: `${cleanSignature.substring(0, 4)}...${cleanSignature.substring(cleanSignature.length - 4)}`
    });

    return false;
  } catch (error) {
    console.error("[WebhookSecurity] NowPayments signature verification error:", error);
    return false;
  }
}
