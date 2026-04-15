import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * CLEANUP: Process Tournament Data Deletion
 */
export async function cleanupTournamentData(circuitId: string) {
   try {
      console.log(`[CLEANUP] Starting tournament cleanup for circuit: ${circuitId}`);

      // 1. Delete all matches in this circuit
      const matchesSnap = await adminDb.collection("matches")
         .where("circuitId", "==", circuitId)
         .get();

      const batch = adminDb.batch();
      matchesSnap.docs.forEach(doc => {
         batch.delete(doc.ref);
      });

      // 2. Delete all competition chat messages
      const chatSnap = await adminDb.collection("competition_chats")
         .doc(circuitId)
         .collection("messages")
         .get();

      chatSnap.docs.forEach(doc => {
         batch.delete(doc.ref);
      });

      // 3. Delete the competition chat document
      const chatRef = adminDb.collection("competition_chats").doc(circuitId);
      batch.delete(chatRef);

      // 4. Delete any remaining cleanup job documents for this circuit
      const jobSnap = await adminDb.collection("cleanup_jobs")
         .where("circuitId", "==", circuitId)
         .get();
      jobSnap.docs.forEach(doc => {
         batch.delete(doc.ref);
      });

      // 5. Delete the circuit document itself
      const circuitRef = adminDb.collection("circuits").doc(circuitId);
      batch.delete(circuitRef);

      await batch.commit();

      console.log(`[CLEANUP] Successfully deleted tournament: ${circuitId}`);
      return true;
   } catch (error) {
      console.error(`[CLEANUP] Failed to cleanup tournament ${circuitId}:`, error);
      return false;
   }
}

/**
 * CLEANUP: Remove Expired Champion Badges
 */
export async function cleanupExpiredBadges() {
   try {
      console.log(`[CLEANUP] Starting expired badge cleanup`);

      const now = new Date();
      const expiredUsersSnap = await adminDb.collection("users")
         .where("championBadge.expiresAt", "<=", now)
         .get();

      if (expiredUsersSnap.empty) {
         console.log(`[CLEANUP] No expired badges found`);
         return 0;
      }

      const batch = adminDb.batch();
      expiredUsersSnap.docs.forEach(doc => {
         // Remove the championBadge field
         batch.update(doc.ref, {
            championBadge: admin.firestore.FieldValue.delete()
         });
      });

      await batch.commit();

      console.log(`[CLEANUP] Removed ${expiredUsersSnap.size} expired champion badges`);
      return expiredUsersSnap.size;
   } catch (error) {
      console.error(`[CLEANUP] Failed to cleanup expired badges:`, error);      return 0;
   }
}

/**
 * CLEANUP: Process User Account Deletion
 * Called when a user deletes their account to free up usernames and clean up data
 */
export async function cleanupDeletedUserAccount(uid: string) {
   try {
      console.log(`[CLEANUP] Starting user account cleanup for UID: ${uid}`);

      const batch = adminDb.batch();

      // 1. Get user data to find username
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();

      if (userSnap.exists) {
         const userData = userSnap.data();
         const username = userData?.username?.toLowerCase();

         // 2. Delete username reservation if it exists
         if (username) {
            const usernameRef = adminDb.collection("usernames").doc(username);
            batch.delete(usernameRef);
            console.log(`[CLEANUP] Freed username: ${username}`);
         }

         // 3. Delete phone reservation if it exists
         const phone = userData?.phone;
         if (phone) {
            const normalizedPhone = phone.replace(/[^0-9]/g, "");
            const phoneRef = adminDb.collection("phones").doc(normalizedPhone);
            batch.delete(phoneRef);
            console.log(`[CLEANUP] Freed phone: ${normalizedPhone}`);
         }

         // 4. Delete user document
         batch.delete(userRef);
         console.log(`[CLEANUP] Deleted user document for UID: ${uid}`);
      }

      // 5. Delete all user notifications
      const notificationsSnap = await adminDb.collection("users").doc(uid).collection("notifications").get();
      notificationsSnap.docs.forEach(doc => {
         batch.delete(doc.ref);
      });

      // 6. Delete any pending withdrawals (mark as cancelled)
      const withdrawalsSnap = await adminDb.collection("withdrawals")
         .where("uid", "==", uid)
         .where("status", "==", "PENDING")
         .get();

      withdrawalsSnap.docs.forEach(doc => {
         batch.update(doc.ref, {
            status: "CANCELLED",
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            cancellationReason: "Account deleted by user"
         });
      });

      await batch.commit();

      console.log(`[CLEANUP] Successfully cleaned up deleted user account: ${uid}`);
      return true;
   } catch (error) {
      console.error(`[CLEANUP] Failed to cleanup deleted user account ${uid}:`, error);      return 0;
   }
}
