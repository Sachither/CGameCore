import { adminDb } from "./firebase-admin";
import admin from "firebase-admin";

/**
 * INTERNAL UTILITY: Safe Server-Side Notification Dispatch.
 * This is NOT a server action and cannot be called by the client (L-06).
 * Sends BOTH Firestore notification AND FCM push for cross-device delivery.
 */
export async function createNotificationInternal(
  uid: string,
  title: string,
  message: string,
  type: 'SYSTEM' | 'MATCH' | 'FINANCE' | 'ALERT' | 'DISPUTE' | 'WALKTHROUGH' = 'SYSTEM'
) {
  try {
    // 1. Store notification in Firestore (primary source)
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .add({
        title,
        message,
        type,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // 2. Send FCM push notification for cross-device delivery
    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      const fcmTokens = userDoc.data()?.fcmTokens || [];
      
      if (fcmTokens && fcmTokens.length > 0) {
        const payload = {
          notification: {
            title,
            body: message
          },
          data: {
            type,
            notificationType: type,
            timestamp: new Date().toISOString()
          },
          webpush: {
            fcmOptions: {
              link: '/dashboard'
            },
            notification: {
              title,
              body: message,
              icon: '/logo.png',
              badge: '/badge.png',
              tag: type,
              requireInteraction: type === 'DISPUTE'
            }
          }
        };

        await admin.messaging().sendMulticast({
          tokens: fcmTokens,
          ...payload
        });
        console.log(`[FCM] Sent ${type} notification to ${uid}`);
      }
    } catch (fcmError) {
      console.warn(`[FCM] Push notification failed for ${uid}:`, fcmError);
    }

    return true;
  } catch (error) {
    console.error("[InternalNotification] Failed to dispatch:", error);
    return false;
  }
}
