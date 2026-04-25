import { adminDb } from "./firebase-admin";

/**
 * Generates a unique referral code for a new operative.
 * Format: Prefix (first 4 chars of username) + 4 random alphanumeric characters.
 */
export function generateReferralCode(username: string): string {
  const prefix = username.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${prefix}${randomPart}`;
}

/**
 * Validates a referral code and returns the UID of the referrer if found.
 */
export async function getReferrerByCode(code: string): Promise<string | null> {
  if (!code) return null;
  
  const normalizedCode = code.trim().toUpperCase();
  
  try {
    const userQuery = await adminDb.collection("users")
      .where("myReferralCode", "==", normalizedCode)
      .limit(1)
      .get();
    
    if (userQuery.empty) return null;
    return userQuery.docs[0].id;
  } catch (error) {
    console.error("[ReferralUtils] Error fetching referrer:", error);
    return null;
  }
}

/**
 * Utility to check if a user is a Partner
 */
export async function isUserPartner(uid: string): Promise<boolean> {
  try {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) return false;
    return userDoc.data()?.role === "PARTNER";
  } catch (error) {
    console.error("[ReferralUtils] Error checking partner status:", error);
    return false;
  }
}
