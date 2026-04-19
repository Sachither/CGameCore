"use server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

async function getVerifiedUid(idToken: string) {
  if (!idToken) throw new Error("Unauthorized");
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

/**
 * Dismisses the active tactical ping from the user's profile.
 */
export async function dismissTacticalPingAction(idToken: string) {
  try {
    const uid = await getVerifiedUid(idToken);
    
    await adminDb.collection("users").doc(uid).update({
      "ping.active": false,
      "ping.dismissedAt": admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error("[PingAction] dismissTacticalPing error:", error);
    return { success: false, error: error.message };
  }
}
