"use server";

import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { getVerifiedAdminUid, getVerifiedIdentity } from "@/lib/server-utils";
import { spurnPromoTournamentInternal } from "../../lib/match-engine/promo-engine";

/**
 * Type Definition for Promo Events
 */
export interface PromoEvent {
  id: string;
  game: 'CODM' | 'EFOOTBALL';
  participantLimit: number;
  prizeUSD: number;
  prizeNGN: number;
  status: 'OPEN' | 'READY' | 'ACTIVE' | 'COMPLETED';
  participants: string[]; // Array of UIDs
  participantData: { [uid: string]: { username: string; avatarId: number; joinedAt: any } };
  createdAt: any;
  spurnedAt?: any;
  circuitId?: string; // For EFOOTBALL (Knockout)
  matchId?: string;   // For CODM (BR Room)
  entryFeeCoins?: number; // New: Optional entry fee
}

/**
 * ADMIN ACTION: Deploy a new Promo Tournament
 */
export async function createPromoEventAction(
  idToken: string,
  game: 'CODM' | 'EFOOTBALL',
  participantLimit: number,
  prizeUSD: number,
  prizeNGN: number,
  entryFeeCoins: number = 0
) {
  const adminUid = await getVerifiedAdminUid(idToken, true);
  
  const promoRef = adminDb.collection("promo_events").doc();
  const promoData: any = {
    game,
    participantLimit,
    prizeUSD,
    prizeNGN,
    entryFeeCoins,
    status: 'OPEN',
    participants: [],
    participantData: {},
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await promoRef.set(promoData);

  // Audit Log
  await adminDb.collection("admin_audit_log").doc().set({
    action: "CREATE_PROMO_EVENT",
    adminUid,
    promoId: promoRef.id,
    game,
    limit: participantLimit,
    entryFeeCoins,
    timestamp: admin.firestore.FieldValue.serverTimestamp()
  });

  return { success: true, promoId: promoRef.id };
}

/**
 * USER ACTION: Join an active Promo Event
 */
export async function joinPromoEventAction(idToken: string, promoId: string) {
  const { uid, profile } = await getVerifiedIdentity(idToken);
  const promoRef = adminDb.collection("promo_events").doc(promoId);
  const userRef = adminDb.collection("users").doc(uid);

  try {
    // 🛡️ SECURITY: Prevent Dual Enrollment in multiple Promos concurrently
    const activePromoQuery = await adminDb.collection("promo_events")
      .where("participants", "array-contains", uid)
      .where("status", "in", ["OPEN", "READY", "ACTIVE"])
      .get();

    if (!activePromoQuery.empty) {
      throw new Error("DUAL_ENROLLMENT_DENIED: You are currently active in another ongoing Promo Event. You must complete it or await elimination before joining a new one.");
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const promoSnap = await transaction.get(promoRef);
      const userSnap = await transaction.get(userRef);

      if (!promoSnap.exists) throw new Error("Promo event not found.");
      if (!userSnap.exists) throw new Error("User profile failure.");

      const promo = promoSnap.data() as PromoEvent;
      const user = userSnap.data()!;

      // 1. Validations
      if (promo.status !== 'OPEN') throw new Error("This event is no longer accepting participants.");
      if (promo.participants.includes(uid)) throw new Error("You are already registered for this event.");
      if (promo.participants.length >= promo.participantLimit) throw new Error("Event is full.");
      
      // 2. Dual Enrollment Logic
      const currentBalance = user.balanceCoins || 0;
      const entryFee = promo.entryFeeCoins || 0;

      // Rule A: Global Verification Minimum (100 Coins)
      if (currentBalance < 100) {
        throw new Error("Activation Required: You must have at least $1.00 (100 Coins) in your wallet to join this promo.");
      }

      // Rule B: Fee Coverage
      if (entryFee > 0 && currentBalance < entryFee) {
        throw new Error(`Insufficient Balance: This premium promo requires an entry fee of ${entryFee} Coins. You only have ${currentBalance}.`);
      }

      // 3. Update Promo & User Balance
      const participantInfo = {
        username: profile.username || "Unknown",
        avatarId: profile.avatarId || 1,
        joinedAt: new Date().toISOString()
      };

      // Deduct Fee if applicable
      if (entryFee > 0) {
        transaction.update(userRef, {
          balanceCoins: admin.firestore.FieldValue.increment(-entryFee)
        });
        
        // Audit Fee Deduction
        const feeLogRef = adminDb.collection("fee_audit_log").doc();
        transaction.set(feeLogRef, {
          uid,
          amount: entryFee,
          type: "PROMO_ENTRY_FEE",
          promoId,
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });
      }

      transaction.update(promoRef, {
        participants: admin.firestore.FieldValue.arrayUnion(uid),
        [`participantData.${uid}`]: participantInfo
      });

      return { 
        full: (promo.participants.length + 1) >= promo.participantLimit,
        game: promo.game,
        limit: promo.participantLimit
      };
    });

    // 4. Automation Signal (The Spurn)
    if (result.full) {
      // Trigger internal engine to spawn the matches
      await spurnPromoTournamentInternal(promoId);
    }

    return { success: true };
  } catch (error: any) {
    console.error("[PromoAction] Join Error:", error);
    return { success: false, error: error.message };
  }
}

// In-memory cache to mitigate Firebase Quota Exhaustion (Spark/Free plan limits)
let activePromoCache: { data: any, timestamp: number } | null = null;
const CACHE_TTL_MS = 60 * 1000; // 60-second shield

/**
 * PUBLIC/DASHBOARD: Get Active Promo
 * Layer 1: Memory Cache (Shields Firestore from rapid polling)
 * Layer 2: Firestore Query (Source of truth)
 */
export async function getActivePromoAction() {
  // 1. Check Cache Tier
  const now = Date.now();
  if (activePromoCache && (now - activePromoCache.timestamp) < CACHE_TTL_MS) {
    return { success: true, promo: activePromoCache.data, cached: true };
  }

  try {
    const snap = await adminDb.collection("promo_events")
      .where("status", "==", "OPEN")
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    let promoData = null;
    if (!snap.empty) {
      const doc = snap.docs[0].data();
      promoData = {
        id: snap.docs[0].id,
        ...doc,
        createdAt: doc.createdAt?.toDate?.()?.toISOString() || null
      };
    }

    // Update Cache Tier
    activePromoCache = { data: promoData, timestamp: now };

    return { 
      success: true, 
      promo: promoData,
      cached: false
    };
  } catch (error: any) {
    // 🔒 [SECURITY/UX] Quota Recovery Logic
    const isQuotaError = error.message?.includes("Quota exceeded") || error.code === 8;
    
    if (isQuotaError && activePromoCache) {
      console.warn("[PromoCache] 🛡️ Firebase Quota Exceeded. Serving stale tactical data to prevent crash.");
      return { success: true, promo: activePromoCache.data, stale: true };
    }

    console.error("[PromoAction] getActivePromo error:", error);
    return { success: false, error: "Database Link Throttled. Try again later." };
  }
}

/**
 * ADMIN ACTION: Delete a Promo Event
 */
export async function deletePromoEventAction(idToken: string, promoId: string, shouldRefund: boolean = false) {
  const adminUid = await getVerifiedAdminUid(idToken, true);
  const promoRef = adminDb.collection("promo_events").doc(promoId);
  
  try {
    await adminDb.runTransaction(async (transaction) => {
      const snap = await transaction.get(promoRef);
      if (!snap.exists) throw new Error("Promo not found");
      
      const pData = snap.data();
      const participants = pData?.participants || [];
      const fee = pData?.entryFeeCoins || 0;

      // Refund Logics
      if (shouldRefund && fee > 0 && participants.length > 0) {
        for (const uid of participants) {
          const uRef = adminDb.collection("users").doc(uid);
          transaction.update(uRef, {
            balanceCoins: admin.firestore.FieldValue.increment(fee)
          });
          
          // Notifications
          const noteRef = adminDb.collection("users").doc(uid).collection("notifications").doc();
          transaction.set(noteRef, {
            title: "Promo Cancelled - Refund Issued",
            message: `The promotional tournament '${pData?.game}' was cancelled. Your ${fee} coin entry fee has been refunded to your vault.`,
            type: "SYSTEM",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // 🚀 RECIPROCAL CLEANUP: Delete associated circuit/match records to prevent ghost entries on dashboard
      if (pData?.circuitId) {
        const cRef = adminDb.collection("circuits").doc(pData.circuitId);
        transaction.delete(cRef);
      }
      if (pData?.matchId) {
        const mRef = adminDb.collection("matches").doc(pData.matchId);
        transaction.delete(mRef);
      }

      transaction.delete(promoRef);

      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: shouldRefund ? "REFUND_AND_DELETE_PROMO" : "DELETE_PROMO_EVENT",
        adminUid,
        promoId,
        circuitId: pData?.circuitId || null,
        matchId: pData?.matchId || null,
        refundedCount: shouldRefund ? participants.length : 0,
        totalRefundAmount: shouldRefund ? (participants.length * fee) : 0,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("[PromoAction] Delete Error:", error);
    return { success: false, error: error.message };
  }
}
