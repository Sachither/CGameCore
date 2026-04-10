"use server";

import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

/**
 * SERVER ACTION: Submit a contact form message.
 * This bypasses client-side Firestore rules, allowing both authenticated and unauthenticated operativers to send messages.
 */
export async function submitContactMessageAction(
  subject: string,
  message: string,
  userUid?: string,
  userName?: string
) {
  if (!message || message.trim().length === 0) {
    return { success: false, error: "Empty transmission." };
  }

  try {
    const messageRef = adminDb.collection("contact_messages").doc();
    await messageRef.set({
      subject,
      message,
      status: 'UNREAD',
      senderUid: userUid || 'GUEST',
      senderName: userName || 'Unknown Operative',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[ContactAction] Error submitting message:", error);
    return { success: false, error: error.message || "Failed to establish a link to the Command Center." };
  }
}
