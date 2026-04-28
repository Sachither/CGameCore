import { adminDb } from "./firebase-admin";
import crypto from "crypto";
import admin from "firebase-admin";

/**
 * [FORTRESS] Admin Security Terminal
 * Handles hashing, verification, and rate-limiting for administrative PINs.
 */

const PIN_COLLECTION = "admin_secrets";
const LOCKOUT_COLLECTION = "admin_lockouts";
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 60 * 1000; // 1 Hour

/**
 * Hashes a PIN with a salt.
 */
export function hashPin(pin: string, salt: string): string {
  return crypto
    .createHmac("sha256", salt)
    .update(pin)
    .digest("hex");
}

/**
 * Verifies an admin's security PIN.
 * This should be called from sensitive Server Actions.
 */
export async function verifyAdminSecurityPin(uid: string, pin: string): Promise<{ success: boolean; error?: string }> {
  if (!pin || pin.length !== 6) {
    return { success: false, error: "Invalid PIN format. 6 digits required." };
  }

  // 1. Check for active lockout
  const lockoutRef = adminDb.collection(LOCKOUT_COLLECTION).doc(uid);
  const lockoutSnap = await lockoutRef.get();
  
  if (lockoutSnap.exists) {
    const data = lockoutSnap.data()!;
    if (data.attempts >= MAX_ATTEMPTS) {
      const now = Date.now();
      const expiresAt = data.lastAttemptAt.toDate().getTime() + LOCKOUT_DURATION_MS;
      if (now < expiresAt) {
        const remaining = Math.ceil((expiresAt - now) / 60000);
        return { success: false, error: `TERMINAL LOCKED: Too many failed attempts. Try again in ${remaining} minutes.` };
      } else {
        // Reset lockout after duration passes
        await lockoutRef.delete();
      }
    }
  }

  // 2. Fetch the secret
  const secretRef = adminDb.collection(PIN_COLLECTION).doc(uid);
  const secretSnap = await secretRef.get();

  if (!secretSnap.exists) {
    return { success: false, error: "SECURITY_UNCONFIGURED: No security PIN has been set for this account. Please set up your PIN in the Admin Profile." };
  }

  const { hashedPin, salt } = secretSnap.data()!;
  const incomingHash = hashPin(pin, salt);

  if (incomingHash !== hashedPin) {
    // 3. Record failed attempt
    await lockoutRef.set({
      attempts: admin.firestore.FieldValue.increment(1),
      lastAttemptAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    const attemptsRemaining = MAX_ATTEMPTS - ((lockoutSnap.data()?.attempts || 0) + 1);
    return { 
      success: false, 
      error: `INVALID PIN: Identity not verified. ${attemptsRemaining > 0 ? `${attemptsRemaining} attempts remaining.` : "Access terminal locked."}` 
    };
  }

  // 4. Success - Reset attempts on success
  await lockoutRef.delete();
  return { success: true };
}

/**
 * Sets or updates an admin's security PIN.
 * Required: Verification of the old PIN if it exists.
 */
export async function setAdminSecurityPin(uid: string, newPin: string): Promise<{ success: boolean; error?: string }> {
  if (!newPin || newPin.length !== 6 || !/^\d+$/.test(newPin)) {
    return { success: false, error: "PIN must be exactly 6 numeric digits." };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const hashedPin = hashPin(newPin, salt);

  try {
    await adminDb.collection(PIN_COLLECTION).doc(uid).set({
      uid,
      hashedPin,
      salt,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
