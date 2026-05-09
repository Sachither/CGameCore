"use server";

import { adminDb } from "@/lib/firebase-admin";
import { getVerifiedIdentity } from "@/lib/server-utils";

export async function markNotificationReadAction(idToken: string, notificationId: string) {
  try {
    const { uid } = await getVerifiedIdentity(idToken);
    await adminDb.collection("users").doc(uid).collection("notifications").doc(notificationId).update({
      isRead: true,
      read: true
    });
    return { success: true };
  } catch (error: any) {
    console.error("[NotificationAction] markAsRead error:", error);
    return { success: false, error: error.message };
  }
}

export async function markAllNotificationsReadAction(idToken: string) {
  try {
    const { uid } = await getVerifiedIdentity(idToken);
    const batch = adminDb.batch();
    
    const snap = await adminDb.collection("users").doc(uid).collection("notifications")
      .where("isRead", "==", false)
      .get();
      
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, read: true });
    });
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Aliases and compatibility wrappers
export async function markNotificationAsReadAction(userId: string, notificationId: string) {
    await adminDb.collection("users").doc(userId).collection("notifications").doc(notificationId).update({ isRead: true, read: true });
    return { success: true };
}

export async function markAllNotificationsAsReadAction(tokenOrUid: string) {
  try {
    let uid = tokenOrUid;
    
    if (tokenOrUid.length > 128) {
       const identity = await getVerifiedIdentity(tokenOrUid);
       uid = identity.uid;
    }

    const batch = adminDb.batch();
    const snap = await adminDb.collection("users").doc(uid).collection("notifications")
      .where("isRead", "==", false)
      .get();
      
    snap.docs.forEach(doc => {
      batch.update(doc.ref, { isRead: true, read: true });
    });
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
