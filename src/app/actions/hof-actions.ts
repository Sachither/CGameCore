"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { HofCategory, getHofWeekKey, getHofPhase } from "@/lib/hof-service";

/**
 * Submits a new Hall of Fame entry
 */
export async function submitHofEntryAction(idToken: string, videoUrl: string, category: HofCategory) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const phase = getHofPhase();
    if (phase !== 'SUBMISSION') {
      return { success: false, error: "Submission phase is closed for this week." };
    }

    const weekKey = getHofWeekKey();
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return { success: false, error: "User profile not found." };
    }

    const userData = userSnap.data()!;

    // Limit: 1 entry per category per week
    const existingSnap = await adminDb.collection("hall_of_fame_entries")
      .where("uid", "==", uid)
      .where("weekKey", "==", weekKey)
      .where("category", "==", category)
      .get();

    if (existingSnap.size >= 1) {
      const catTitle = category === 'eFOOTBALL_GOAL' ? "eFootball Best Goal of the Week" : "Best CODM Squad Wipeout";
      return { success: false, error: `You have already submitted an entry for ${catTitle} this week.` };
    }

    const entryRef = adminDb.collection("hall_of_fame_entries").doc();
    await entryRef.set({
      uid,
      username: userData.username || "Operative",
      avatarId: userData.avatarId || 0,
      videoUrl,
      embedType: 'DIRECT',
      category,
      weekKey,
      voterUids: [],
      voteCount: 0,
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (err: any) {
    console.error("[HOF Action] Submission Error:", err);
    return { success: false, error: err.message || "Failed to submit entry." };
  }
}

/**
 * Votes for a Hall of Fame entry
 */
export async function voteHofEntryAction(idToken: string, entryId: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const phase = getHofPhase();
    if (phase !== 'VOTING') {
      return { success: false, error: "Voting phase has not started yet." };
    }

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists || !userSnap.data()?.username) {
      return { success: false, error: "Please complete your profile to vote." };
    }

    // Anti-Spam Check 2: Account Age (24 hours)
    const userData = userSnap.data()!;
    const createdAt = userData.createdAt;
    const accountAgeMs = Date.now() - (createdAt?.toDate?.()?.getTime() || 0);
    if (accountAgeMs < 24 * 60 * 60 * 1000) {
      return { success: false, error: "Your account must be 24 hours old to vote." };
    }

    const entryRef = adminDb.collection("hall_of_fame_entries").doc(entryId);

    return await adminDb.runTransaction(async (transaction) => {
      const entrySnap = await transaction.get(entryRef);
      if (!entrySnap.exists) throw new Error("Entry found.");

      const entryData = entrySnap.data()!;
      if (entryData.voterUids?.includes(uid)) {
        throw new Error("You have already voted for this entry.");
      }

      transaction.update(entryRef, {
        voterUids: admin.firestore.FieldValue.arrayUnion(uid),
        voteCount: admin.firestore.FieldValue.increment(1)
      });

      return { success: true };
    });

  } catch (err: any) {
    return { success: false, error: err.message || "Voting failed." };
  }
}

/**
 * Admin: Crowns winners and purges non-winners
 */
export async function adminCrownWinnerAction(idToken: string, weekKey: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const adminRef = adminDb.collection("users").doc(uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.data()?.isAdmin) {
      return { success: false, error: "Unauthorized access." };
    }

    // STEP 1: NUKE ALL EXISTING WINNERS (CLEAN SLATE)
    const currentWinnersSnap = await adminDb.collection("hall_of_fame_entries")
      .where("status", "==", "WINNER")
      .get();

    if (!currentWinnersSnap.empty) {
      const nukeBatch = adminDb.batch();
      currentWinnersSnap.docs.forEach(doc => nukeBatch.delete(doc.ref));
      await nukeBatch.commit();
    }

    // FETCH ENTRIES FOR THE WEEK TO CROWN
    const allEntriesSnap = await adminDb.collection("hall_of_fame_entries")
      .where("weekKey", "==", weekKey)
      .get();

    if (allEntriesSnap.empty) {
      return { success: false, error: `RECON FAILURE: No entries found for week ${weekKey}.` };
    }

    // STEP 2: IDENTIFY AND MARK NEW WINNERS
    const finalBatch = adminDb.batch();

    // Categorize
    const catGroups: { [key: string]: admin.firestore.QueryDocumentSnapshot[] } = {};
    allEntriesSnap.docs.forEach(doc => {
      const cat = doc.data().category || 'UNCATEGORIZED';
      if (!catGroups[cat]) catGroups[cat] = [];
      catGroups[cat].push(doc);
    });

    const newWinnerIds = new Set<string>();

    Object.keys(catGroups).forEach(catName => {
      const group = catGroups[catName];
      let winnerDoc = group[0];
      let maxVotes = -1;

      group.forEach(doc => {
        const data = doc.data();
        const votes = data.voteCount || 0;
        const createdAt = data.createdAt?.toDate?.()?.getTime() || 0;

        if (votes > maxVotes) {
          maxVotes = votes;
          winnerDoc = doc;
        } else if (votes === maxVotes) {
          // Tie-Breaker: The one submitted EARLIER wins
          const currentWinnerCreatedAt = winnerDoc.data().createdAt?.toDate?.()?.getTime() || 0;
          if (createdAt < currentWinnerCreatedAt) {
            winnerDoc = doc;
          }
        }
      });

      newWinnerIds.add(winnerDoc.id);
      finalBatch.update(winnerDoc.ref, {
        status: 'WINNER',
        crownedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // STEP 3: DELETE ALL LOSERS FROM THIS WEEK
    allEntriesSnap.docs.forEach(doc => {
      if (!newWinnerIds.has(doc.id)) {
        finalBatch.delete(doc.ref);
      }
    });

    await finalBatch.commit();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to crown winners." };
  }
}

/**
 * Admin: Deletes a specific entry
 */
export async function adminDeleteHofEntryAction(idToken: string, entryId: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const adminRef = adminDb.collection("users").doc(uid);
    const adminSnap = await adminRef.get();
    if (!adminSnap.data()?.isAdmin) {
      return { success: false, error: "Unauthorized access." };
    }

    await adminDb.collection("hall_of_fame_entries").doc(entryId).delete();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete entry." };
  }
}

/**
 * User: Deletes their own entry
 */
export async function deleteMyHofEntryAction(idToken: string, entryId: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const entryRef = adminDb.collection("hall_of_fame_entries").doc(entryId);
    const entrySnap = await entryRef.get();

    if (!entrySnap.exists) {
      return { success: false, error: "Entry not found." };
    }

    if (entrySnap.data()?.uid !== uid) {
      return { success: false, error: "Unauthorized access." };
    }

    await entryRef.delete();
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || "Failed to delete entry." };
  }
}
