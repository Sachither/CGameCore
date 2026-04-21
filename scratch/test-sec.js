const crypto = require("crypto");

// Minimal mock of the logic in src/lib/webhook-security.ts
function verifyWebhookSignature(payload, signature, secret, algorithm = "sha512") {
  try {
    const hash = crypto
      .createHmac(algorithm, secret)
      .update(payload)
      .digest("hex");

    const hashBuffer = Buffer.from(hash);
    const signatureBuffer = Buffer.from(signature);

    // FIXED LOGIC
    if (hashBuffer.length !== signatureBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(hashBuffer, signatureBuffer);
  } catch (error) {
    console.error("[WebhookSecurity] Signature verification error:", error);
    return false;
  }
}

const payload = JSON.stringify({ event: "test", data: { id: 123 } });
const secret = "super-secret-key";
const validHash = crypto.createHmac("sha512", secret).update(payload).digest("hex");

console.log("--- SEC TEST START ---");
console.log("Valid Hash Length:", validHash.length);

// 1. Valid Signature
const test1 = verifyWebhookSignature(payload, validHash, secret);
console.log("Test 1 (Valid):", test1 === true ? "PASS" : "FAIL");

// 2. Invalid Signature (Same Length) - THIS WAS THE BYPASS
const invalidSameLen = "a".repeat(validHash.length);
const test2 = verifyWebhookSignature(payload, invalidSameLen, secret);
console.log("Test 2 (Invalid Same Len):", test2 === false ? "PASS" : "FAIL");

// 3. Invalid Signature (Diff Length)
const invalidDiffLen = "abc";
const test3 = verifyWebhookSignature(payload, invalidDiffLen, secret);
console.log("Test 3 (Invalid Diff Len):", test3 === false ? "PASS" : "FAIL");

console.log("--- SEC TEST END ---");
