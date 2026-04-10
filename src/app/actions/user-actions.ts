"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

/**
 * Gets the verified UID from the ID Token.
 */
async function getVerifiedUid(idToken?: string) {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

/**
 * SERVER ACTION: Update Game Username (Long-range handle)
 * Applies a 20 Coin fine for identity verification.
 */
export async function updateGameTagAction(
  idToken: string,
  gameType: 'cod' | 'efootball',
  newTag: string
) {
  const uid = await getVerifiedUid(idToken);
  
  if (!newTag || newTag.length < 3) {
    return { success: false, error: "Invalid tag: Minimum 3 characters." };
  }

  const userRef = adminDb.collection("users").doc(uid);
  const transactionRef = adminDb.collection("transactions").doc();
  const notificationRef = userRef.collection("notifications").doc();

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User profile missing.");

      const userData = userSnap.data()!;
      const currentBalance = userData.balanceCoins || 0;

      if (currentBalance < 20) {
        throw new Error("Insufficient Coins for identity realignment (20 Required).");
      }

      const fieldToUpdate = gameType === 'cod' ? 'codTag' : 'efootballTag';
      const label = gameType === 'cod' ? 'CODM ID' : 'eFootball ID';

      // 1. Deduct the fine
      transaction.update(userRef, {
        balanceCoins: admin.firestore.FieldValue.increment(-20),
        [fieldToUpdate]: newTag
      });

      // 2. Log the transaction fee
      transaction.set(transactionRef, {
        uid,
        type: "FEE",
        category: "IDENTITY_FINE",
        description: `Renamed ${label} to ${newTag}`,
        amount: -20,
        status: "COMPLETED",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Dispatch tactical notification
      transaction.set(notificationRef, {
        title: "Identity Realignment",
        message: `Your ${label} has been updated to ${newTag}. 20 Coins deducted for identity verification.`,
        type: "SYSTEM",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("[UserAction] updateGameTag error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Set User Region
 * Persists the user's country and currency for regional expansion.
 */
export async function updateUserRegionAction(
  idToken: string,
  country: string,
  currency: string
) {
  const uid = await getVerifiedUid(idToken);

  const allowedRegions = [
    { country: 'NG', currency: 'NGN' },
    { country: 'GH', currency: 'GHS' },
    { country: 'ZA', currency: 'ZAR' },
    { country: 'KE', currency: 'KES' },
    { country: 'OTH', currency: 'USD' }
  ];

  const isValid = allowedRegions.some(r => r.country === country && r.currency === currency);
  if (!isValid) return { success: false, error: "Invalid region selection." };

  try {
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.update({
      country,
      currency,
      regionVerifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error("[UserAction] updateRegion error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Mark Notification as Read
 * Tactical dismissal of system/finance notifications.
 */
export async function markNotificationReadAction(idToken: string, notificationId: string) {
  const uid = await getVerifiedUid(idToken);
  try {
    const notificationRef = adminDb
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc(notificationId);
    
    await notificationRef.update({
      read: true,
      dismissedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error: any) {
    console.error("[UserAction] markNotificationRead error:", error);
    return { success: false, error: error.message };
  }
}
