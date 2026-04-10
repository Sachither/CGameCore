"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { getVerifiedUid } from "@/lib/server-utils";

/**
 * SERVER ACTION: Send Competition Chat Message
 * Handles rate limiting and validation for competition chat messages
 */
export async function sendCompetitionChatMessageAction(
  idToken: string,
  competitionId: string,
  message: string
) {
  const uid = await getVerifiedUid(idToken);

  if (!message || message.trim().length === 0) {
    return { success: false, error: "Message cannot be empty" };
  }

  if (message.length > 500) {
    return { success: false, error: "Message too long (max 500 characters)" };
  }

  try {
    // Get user profile for role and ban status
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return { success: false, error: "User profile not found" };
    }

    const userData = userSnap.data()!;
    const isBanned = userData.isBanned === true;
    const suspendedUntil = userData.suspendedUntil;

    if (isBanned) {
      return { success: false, error: "Account is banned" };
    }

    if (suspendedUntil && suspendedUntil.toDate && suspendedUntil.toDate().getTime() > Date.now()) {
      return { success: false, error: "Account is suspended" };
    }

    // Check rate limit (5 messages per day per user)
    const rateLimitKey = `${uid}_created_chats`;
    const rateLimitRef = adminDb.collection("rate_limits").doc(rateLimitKey);
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000; // 86400 seconds
    const windowResetAt = now + dayInMs;

    const rateLimitSnap = await rateLimitRef.get();
    let currentCount = 0;

    if (rateLimitSnap.exists) {
      const data = rateLimitSnap.data()!;
      const resetAt = data.resetAt || 0;

      if (now > resetAt) {
        // Window expired, reset
        currentCount = 0;
      } else {
        currentCount = data.count || 0;
      }
    }

    if (currentCount >= 5) {
      return {
        success: false,
        error: "Rate limited: Maximum 5 messages per day allowed"
      };
    }

    // Sanitize message (basic HTML stripping)
    const sanitizedMessage = message
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trim();

    // Create message
    const messageRef = adminDb
      .collection("competition_chats")
      .doc(competitionId)
      .collection("messages")
      .doc();

    const messageData = {
      text: sanitizedMessage,
      senderUid: uid,
      senderName: userData.username || 'Anonymous',
      role: userData.role || 'USER',
      isMod: ['ADMIN', 'MODERATOR'].includes(userData.role) || userData.isAdmin === true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Use transaction to ensure atomicity
    await adminDb.runTransaction(async (transaction) => {
      // Update rate limit counter
      transaction.set(rateLimitRef, {
        count: currentCount + 1,
        resetAt: windowResetAt,
        lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });

      // Create message
      transaction.set(messageRef, messageData);
    });

    return { success: true };

  } catch (error: any) {
    console.error("[CompetitionChat] Error sending message:", error);
    return { success: false, error: error.message || "Failed to send message" };
  }
}