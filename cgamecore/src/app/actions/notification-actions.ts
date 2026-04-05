"use server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

async function getVerifiedUid(idToken: string) {
  if (!idToken) throw new Error("Unauthorized");
  const decoded = await adminAuth.verifyIdToken(idToken);
  return decoded.uid;
}

export async function getUserNotificationsAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  try {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();

    const notifications = snap.docs.map(d => ({
      id: d.id,
      ...d.data(),
      createdAt: d.data().createdAt?.toDate?.()?.toISOString() || new Date().toISOString()
    }));

    return { success: true, notifications };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markNotificationReadAction(idToken: string, notificationId: string) {
  const uid = await getVerifiedUid(idToken);
  try {
    await adminDb
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .doc(notificationId)
      .update({ read: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markAllNotificationsReadAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  try {
    const snap = await adminDb
      .collection("users")
      .doc(uid)
      .collection("notifications")
      .where("read", "==", false)
      .get();
    
    if (snap.empty) return { success: true };

    const batch = adminDb.batch();
    snap.docs.forEach(d => {
      batch.update(d.ref, { read: true });
    });
    
    await batch.commit();
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
