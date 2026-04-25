"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { sendTacticalEmail } from "@/lib/mail";
import { getWelcomeEmailTemplate } from "@/lib/mail-templates";

/**
 * CLEANUP: Process User Account Deletion
 * Called when a user deletes their account to free up usernames and clean up data
 */
async function cleanupDeletedUserAccount(uid: string) {
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
      console.error(`[CLEANUP] Failed to cleanup deleted user account ${uid}:`, error);
      return false;
   }
}

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

export async function cleanupDeletedUserAccountAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  try {
    const success = await cleanupDeletedUserAccount(uid);
    if (!success) {
      return { success: false, error: "Failed to cleanup deleted account data." };
    }
    return { success: true };
  } catch (error: any) {
    console.error("[UserAction] cleanupDeletedUserAccountAction error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Get Partner/Referral Stats
 */
export async function getPartnerStatsAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  
  try {
    // 1. Get total recruits
    const recruitsSnap = await adminDb.collection("users")
      .where("referredBy", "==", uid)
      .get();
    
    const recruits = recruitsSnap.docs.map(doc => ({
      username: doc.data().username,
      createdAt: typeof doc.data().createdAt === 'string' 
        ? doc.data().createdAt 
        : (doc.data().createdAt?.toDate?.()?.toISOString() || null),
      totalMatches: doc.data().totalMatches || 0
    }));

    // 2. Get commission history
    const earningsSnap = await adminDb.collection("transactions")
      .where("uid", "==", uid)
      .where("category", "==", "PARTNER_COMMISSION")
      .orderBy("createdAt", "desc")
      .limit(20)
      .get();
    
    const earnings = earningsSnap.docs.map(doc => ({
      amount: doc.data().amount,
      description: doc.data().description,
      createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || null
    }));

    // 3. Get Active Tactical Summons (Admin requires presence)
    const summonsSnap = await adminDb.collection("matches")
      .where("creatorId", "==", uid)
      .where("status", "==", "DISPUTED")
      .where("partnerSummoned", "==", true)
      .get();
    
    const activeSummons = summonsSnap.docs.map(doc => ({
      id: doc.id,
      game: doc.data().game
    }));

    // 4. Get Live Operational Feed (All active matches in partner's domain)
    const liveMatchesSnap = await adminDb.collection("matches")
      .where("creatorId", "==", uid)
      .where("status", "in", ["WAITING", "READY", "IN_PROGRESS", "WAITING_FOR_OPPONENT", "DISPUTED"])
      .limit(15)
      .get();
    
    const liveMatches = liveMatchesSnap.docs.map(doc => {
      const data = doc.data();
      const pList = Object.values(data.players || {});
      return {
        id: doc.id,
        game: data.game,
        format: data.format,
        status: data.status,
        round: data.round || null,
        players: pList.map((p: any) => ({ username: p.username, team: p.team })),
        createdAt: data.createdAt?.toDate?.()?.toISOString() || null
      };
    });

    return { 
      success: true, 
      stats: {
        totalRecruits: recruitsSnap.size,
        recruits,
        recentEarnings: earnings,
        activeSummons,
        liveMatches
      }
    };
  } catch (error: any) {
    console.error("[UserAction] getPartnerStats error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Create Partner Tournament (Influencer Lobbies)
 * Rules: Max 1 per game type, must be a PARTNER.
 */
export async function createPartnerTournamentAction(
  idToken: string,
  game: 'CODM' | 'EFOOTBALL',
  entryFee: number,
  format: 'BR' | 'FFA' | 'tournament' = 'tournament',
  maxPlayers: number = 8,
  weaponClass: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' = 'ALL GUNS'
) {
  const uid = await getVerifiedUid(idToken);
  
  // 🛡️ VALIDATION: Only allow specific strategic entry tiers
  const allowedFees = [100, 200, 500, 1000]; // $1, $2, $5, $10
  if (!allowedFees.includes(entryFee)) {
    throw new Error("UNAUTHORIZED_FEE: Please select a tactical entry tier ($1, $2, $5, or $10).");
  }

  // 🛡️ VALIDATION: Player count logic
  if (game === 'CODM') {
    if (format === 'BR') {
      const allowedBR = [2, 4, 20, 30, 50, 100];
      if (!allowedBR.includes(maxPlayers)) throw new Error("Invalid BR player count.");
    } else if (format === 'FFA') {
      const allowedFFA = [2, 3, 4, 5, 6, 7, 8];
      if (!allowedFFA.includes(maxPlayers)) throw new Error("Invalid FFA player count.");
    }
  } else if (game === 'EFOOTBALL') {
    // Standardizing eFootball Elite to 16, 8, 4 or 2 player knockouts
    const allowedEF = [2, 4, 8, 16];
    if (!allowedEF.includes(maxPlayers)) maxPlayers = 16;
  }

  try {
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    
    if (!userSnap.exists) throw new Error("Profile not found.");
    const profile = userSnap.data()!;
    
    // 🛡️ SECURITY: Only Partners or Admins can create specialized lobbies
    if (profile.role !== 'PARTNER' && profile.role !== 'ADMIN' && profile.role !== 'SUPER_ADMIN') {
      throw new Error("UNAUTHORIZED: This command requires 'PARTNER' level clearance.");
    }

    // 🛡️ ANTI-SPAM: Check for existing active tournaments by this partner
    const activeLobbies = await adminDb.collection("matches")
      .where("creatorId", "==", uid)
      .where("game", "==", game)
      .where("status", "in", ["WAITING", "READY"])
      .get();
    
    if (!activeLobbies.empty) {
      throw new Error(`DEPLOYMENT_BLOCKED: You already have an active ${game} lobby. It must be filled or closed before you can spurn another.`);
    }

    // Create the Match document (Gathering format)
    const matchRef = adminDb.collection("matches").doc();
    const matchData = {
      game,
      format: game === 'CODM' ? format : 'tournament', // eFootball always uses tournament (knockout)
      challengeFee: entryFee,
      status: 'WAITING',
      playerIds: [],
      players: {},
      creatorId: uid,
      isPartnerTournament: true,
      partnerName: profile.username,
      maxPlayers: maxPlayers,
      weaponClass: game === 'CODM' && format === 'FFA' ? weaponClass : 'ALL GUNS',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 6 * 3600 * 1000)), // 6 hour window
    };

    await matchRef.set(matchData);

    return { success: true, matchId: matchRef.id };
  } catch (error: any) {
    console.error("[UserAction] createPartnerTournament error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Send Welcome Email
 * Dispatches the tactical onboarding sequence to a new operative.
 */
export async function sendWelcomeEmailAction(email: string, username: string, referralCode: string) {
  try {
    const html = getWelcomeEmailTemplate(username, referralCode);
    const res = await sendTacticalEmail(email, "OPERATIVE ENLISTED: Welcome to the Arena", html);
    return res;
  } catch (error: any) {
    console.error("[UserAction] sendWelcomeEmail error:", error);
    return { success: false, error: error.message };
  }
}
