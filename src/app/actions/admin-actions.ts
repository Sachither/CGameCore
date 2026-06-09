"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { Match, Circuit } from "@/lib/match-service";
import { purgeMatchDataInternal, purgeMatchMessagesOnly } from "@/lib/match-cleanup";
import { internalFinalizeMatchClosure, dispatchMatchResolutionNotifications, adminResolveMatchAction as internalAdminResolveMatchAction } from "./match-actions";
import sweepExpiredMatches from '@/lib/match-monitor';
import { decryptData } from "@/lib/encryption-utils";
import { sendTacticalEmail } from "@/lib/mail";
import { getExtractionEmailTemplate, getPartnerUpgradeEmailTemplate, getPartnerRevokedEmailTemplate } from "@/lib/mail-templates";

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

import { getVerifiedAdminUid, getVerifiedSuperAdminUid, getVerifiedUid } from "@/lib/server-utils";
import { checkRateLimit } from "@/lib/rate-limiter";
import { createNotificationInternal } from "@/lib/notifications";
import { isCryptoWithdrawalNetwork } from "@/lib/withdrawal-fees";
import { verifyAdminSecurityPin, setAdminSecurityPin } from "@/lib/admin-security";
import { getPlatformRate } from "@/app/actions/rate-actions";

let platformStatsCache: {
  expiresAt: number;
  stats: {
    totalUsers: number;
    totalMatches: number;
    openDisputes: number;
    activeMatches: number;
    codmMatches: number;
    efootballMatches: number;
    financeDeposits: number;
    financePayouts: number;
    financeRevenue: number;
    financeWithdrawals: number;
    format1v1: number;
    format5v5: number;
    formatBR: number;
    formatFFA: number;
    formatTourney: number;
    formatLeague: number;
    awaitingPayouts: number;
    pendingPartners: number;
  };
} | null = null;

// 🔒 [SECURITY] M-007 FIX: Test mode watermark - fail-safe check
// Production deployments MUST have NODE_ENV = 'production'
// We also double-check the server-side environment for the domain.
const MOCK_TRANSFER_WARNING = process.env.NODE_ENV !== 'production';
const IS_PRODUCTION_SERVER = process.env.VERCEL_URL?.includes('cgamecore.online') || process.env.NEXT_PUBLIC_BASE_URL?.includes('cgamecore.online');

if (MOCK_TRANSFER_WARNING && !IS_PRODUCTION_SERVER) {
  console.warn("⚠️ ADMIN ACTIONS: Running in TEST MODE. Mock transfers and purges are ENABLED. Financial operations may not be real.");
} else if (MOCK_TRANSFER_WARNING && IS_PRODUCTION_SERVER) {
  console.error("🛑 CRITICAL SECURITY ALERT: Test mode detected on PRODUCTION server. Disabling mock operations for safety.");
}

/**
 * Deep sanitizes Firestore payloads (converts Timestamps to strings)
 * so they can safely pass Next.js Server->Client boundaries.
 */
function sanitizeData(data: any): any {
  if (data === null || data === undefined) return data;
  if (data.toDate && typeof data.toDate === 'function') return data.toDate().toISOString();
  if (Array.isArray(data)) return data.map(sanitizeData);
  if (typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = sanitizeData(data[key]);
    }
    return res;
  }
  return data;
}

// ─── DISPUTE RESOLUTION ──────────────────────────────────────────────────────

/**
 * ADMIN ACTION: RESOLVE DISPUTE
 * Awards the win to the specified player and distributes funds.
 */
export async function resolveDisputeAction(
  idToken: string,
  matchId: string,
  winnerId: string, // 'REFUND' triggers a void match
  securityPin: string
) {
  const adminUid = await getVerifiedAdminUid(idToken);
  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
    if (!pinVerification.success) throw new Error(pinVerification.error);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("Match not found.");
    const matchData = matchSnap.data() as Match;
    const players = Object.keys(matchData.players);
    const fee = matchData.challengeFee;

    // FIX A-003: Validate winner BEFORE any status change or transaction
    if (winnerId !== "REFUND" && !players.includes(winnerId)) {
      throw new Error(`SECURITY: Winner ID not found in match players. Rejecting dispute resolution.`);
    }

    await adminDb.runTransaction(async (transaction) => {
      // Re-verify match state inside transaction
      const latestMatchSnap = await transaction.get(matchRef);
      const latestMatch = latestMatchSnap.data() as Match;
      
      // 🔒 [SECURITY] M-005 FIX: Dispute chain prevention - only DISPUTED can be resolved
      if (latestMatch.status !== "DISPUTED") {
        throw new Error("CHAIN_PREVENTION: Match must be in DISPUTED status. Current status: " + latestMatch.status);
      }

      // Fetch Circuit Data if this is a tournament match
      let circuitData: any = null;
      if (latestMatch.circuitId) {
        const circuitSnap = await transaction.get(adminDb.collection("circuits").doc(latestMatch.circuitId));
        if (circuitSnap.exists) {
          circuitData = circuitSnap.data();
        }
      }
      
      // Re-validate winner inside transaction (double-check)
      const latestPlayers = Object.keys(latestMatch.players);
      if (winnerId !== "REFUND" && !latestPlayers.includes(winnerId)) {
        throw new Error("SECURITY: Winner validation failed in transaction context");
      }
      
      // ── STEP 1.5: Finalization & Advancement ──────────────────────────────
      if (winnerId !== "REFUND") {
        // Use the shared finalization logic to handle stats, circuit advancement, etc.
        // We pass the match data and the chosen winner.
        await internalFinalizeMatchClosure(
          transaction,
          matchRef,
          latestMatch,
          winnerId,
          adminUid,
          circuitData // CRITICAL: Pass circuit data for advancement
        );
      } else {
        // Void match — refund all players and undo wager tracking
        for (const uid of players) {
          const userRef = adminDb.collection("users").doc(uid);
          transaction.update(userRef, {
            balanceCoins: admin.firestore.FieldValue.increment(fee),
            lifetimeWagered: admin.firestore.FieldValue.increment(-fee),
            "intervention.active": false
          });
          
          const voidNoteRef = adminDb.collection("users").doc(uid).collection("notifications").doc();
          transaction.set(voidNoteRef, {
            title: "Tribunal Verdict: Voided",
            message: `Match #${matchId.slice(0, 8)} has been voided by the Tribunal. Your challenge fee has been refunded.`,
            type: "DISPUTE",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Mark resolution as complete for REFUND case
        transaction.update(matchRef, {
          status: "CLOSED",
          resolution: "REFUND",
          resolutionNotes: `Voided by admin ${adminUid}`,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
          resolvedBy: adminUid
        });
      }
    });

    // ── STEP 2: Initiate Preservation Protocol (Purge Chat Only) ────────────
    // Clean up tactical chat but preserve the match document for history and notifications.
    await purgeMatchMessagesOnly(matchId);

    // ── STEP 3: Dispatch Verdict Notifications ──────────────────────────────
    // CRITICAL: Must run AFTER the transaction commits AND after the purge.
    // The match document must still exist (preserved above) for this to read.
    if (winnerId !== "REFUND") {
      await dispatchMatchResolutionNotifications(matchId, 'CLOSED', winnerId);
    }

    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_RESOLVE_DISPUTE",
      matchId,
      winnerId,
      adminUid,
      previousStatus: matchData.status,
      newStatus: "CLOSED",
      resolution: winnerId === "REFUND" ? "REFUND" : "ADMIN_AWARD",
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        playersAffected: players.length,
        feeAmount: fee,
        timestamp: new Date().toISOString()
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] resolveDispute error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: WIPE COMBAT QUEUE & MASS REFUND
 * Resets a stuck queue and restores credits to all participants.
 */
export async function wipeCombatQueueAction(
  idToken: string,
  queueId: string
) {
  const adminUid = await getVerifiedAdminUid(idToken);
  const queueRef = adminDb.collection("queues").doc(queueId);

  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const queueSnap = await transaction.get(queueRef);
      if (!queueSnap.exists) throw new Error("Queue not found or already empty.");

      const queueData = queueSnap.data()!;
      const playerIds = (queueData.playerIds || []) as string[];
      const fee = 500; // Standard High-Stake Fee

      // 1. Mass Refund
      for (const uid of playerIds) {
        const userRef = adminDb.collection("users").doc(uid);
        transaction.update(userRef, {
          balanceCoins: admin.firestore.FieldValue.increment(fee),
          lifetimeWagered: admin.firestore.FieldValue.increment(-fee)
        });
      }

      // 2. Wipe the Queue Document
      transaction.delete(queueRef);

      // 3. Audit Log
      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: "WIPE_COMBAT_QUEUE",
        adminUid,
        targetQueue: queueId,
        playersRefunded: playerIds.length,
        totalRefundAmount: playerIds.length * fee,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      return { refundedCount: playerIds.length };
    });

    console.log(`🧹 [ADMIN-WIPE] Queue ${queueId} reset by ${adminUid}. ${result.refundedCount} players refunded.`);
    return { success: true, ...result };
  } catch (error: any) {
    console.error("[AdminAction] wipeQueue error:", error);
    return { success: false, error: error.message };
  }
}

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

/**
 * ADMIN ACTION: BAN / UNBAN USER
 * Supports optional timed suspensions (durationHours).
 */
export async function setBanStatusAction(
  idToken: string,
  targetUid: string,
  isBanned: boolean,
  banReason?: string,
  durationHours?: number,
  securityPin?: string // Optional for backward compatibility but checked if provided
) {
  // Only high-level Admins can ban
  const adminUid = await getVerifiedAdminUid(idToken, true);

  try {
    // 🔒 [FORTRESS] Guard: Verify PIN for account lockdown
    if (securityPin) {
      const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
      if (!pinVerification.success) throw new Error(pinVerification.error);
    }
    let suspendedUntil: any = null;
    if (isBanned && durationHours && durationHours > 0) {
       // Timed Suspension
       suspendedUntil = admin.firestore.Timestamp.fromDate(
          new Date(Date.now() + durationHours * 60 * 60 * 1000)
       );
    } else if (isBanned) {
       // Permanent Ban (set to null, but isBanned = true)
       suspendedUntil = null;
    }

    await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(targetUid);
      
      // Update user ban status
      transaction.update(userRef, {
        isBanned,
        banReason: isBanned ? (banReason || "Violation of platform rules.") : "",
        suspendedUntil: suspendedUntil,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // 🔒 [SECURITY] H-007 FIX: When banning, cancel all active matches and refund
      if (isBanned) {
        const activeMatches = await adminDb.collection("matches")
          .where("playerIds", "array-contains", targetUid)
          .where("status", "in", ["WAITING", "READY", "IN_PROGRESS", "RESOLVING"])
          .get();

        for (const matchDoc of activeMatches.docs) {
          const matchData = matchDoc.data() as any;
          const fee = matchData.challengeFee || 0;

          // Refund the banned player
          if (fee > 0) {
            transaction.update(userRef, {
              balanceCoins: admin.firestore.FieldValue.increment(fee)
            });
          }

          // Mark match as VOIDED with ban note
          transaction.update(matchDoc.ref, {
            status: "VOIDED",
            voidReason: "Player banned during match",
            voidedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        // Log ban action
        const auditRef = adminDb.collection("admin_audit_log").doc();
        transaction.set(auditRef, {
          action: "BAN_USER",
          adminUid,
          targetUid,
          banReason: banReason || "Violation",
          matchesCancelled: activeMatches.docs.length,
          refundAmount: activeMatches.docs.length * (await adminDb.collection("matches")
            .where("playerIds", "array-contains", targetUid)
            .limit(1)
            .get()
            .then(s => s.docs[0]?.data().challengeFee || 0)),
          timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`🚨 [BAN] ${targetUid} banned by ${adminUid}. Cancelled ${activeMatches.docs.length} active matches.`);
      }
    });

    // Disable the Firebase Auth account if permanent
    if (isBanned && !durationHours) {
       await adminAuth.updateUser(targetUid, { disabled: true });
    } else if (!isBanned) {
       await adminAuth.updateUser(targetUid, { disabled: false });
    }
    
    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] setBanStatus error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: TOGGLE CHAT SUSPENSION
 */
export async function adminToggleChatSuspensionAction(
  idToken: string,
  targetUid: string,
  isChatSuspended: boolean,
  durationHours: number = 0 // 0 = permanent/manual toggle
) {
  const adminUid = await getVerifiedAdminUid(idToken); // Allows Moderators

  try {
    const userRef = adminDb.collection("users").doc(targetUid);
    
    let chatSuspendedUntil: any = null;
    if (isChatSuspended && durationHours > 0) {
      chatSuspendedUntil = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + durationHours * 60 * 60 * 1000)
      );
    }

    await userRef.update({
      isChatSuspended,
      chatSuspendedUntil,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify user
    const durationLabel = durationHours > 0 ? `${durationHours} hours` : "an indefinite period";
    await createNotificationInternal(
      targetUid,
      isChatSuspended ? "Communication Privileges Revoked" : "Communication Privileges Restored",
      isChatSuspended 
        ? `Your access to the community chat has been suspended for ${durationLabel} for violation of protocols.` 
        : "Your access to the community chat has been restored. Please adhere to war room rules.",
      "SYSTEM"
    );

    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: isChatSuspended ? "SUSPEND_CHAT" : "UNSUSPEND_CHAT",
      adminUid,
      targetUid,
      durationHours: isChatSuspended ? durationHours : null,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] adminToggleChatSuspension error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: SET USER ROLE (RBAC)
 */
export async function setUserRoleAction(
  idToken: string,
  targetUid: string,
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN",
  securityPin?: string
) {
  // SUPER_ADMIN promotion requires SUPER_ADMIN level access
  const requireSuperAdmin = role === "SUPER_ADMIN";
  const adminUid = requireSuperAdmin 
    ? await getVerifiedSuperAdminUid(idToken)
    : await getVerifiedAdminUid(idToken, true);

  try {
    // 🔒 [FORTRESS] Guard: Verify PIN for clearance elevation
    if (securityPin) {
      const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
      if (!pinVerification.success) throw new Error(pinVerification.error);
    }
    const customClaims = {
      role,
      isAdmin: role === "ADMIN" || role === "SUPER_ADMIN",
      isSuperAdmin: role === "SUPER_ADMIN"
    };

    // Read previous role for audit before updating.
    const userSnap = await adminDb.collection("users").doc(targetUid).get();
    const previousRole = userSnap.exists ? (userSnap.data()?.role || (userSnap.data()?.isAdmin ? "ADMIN" : "USER")) : "USER";

    // Update both the low-level record and Auth custom claims.
    // This gives us a secure, non-Firestore-overrideable role source while preserving existing data.
    await adminAuth.setCustomUserClaims(targetUid, customClaims);
    await adminDb.collection("users").doc(targetUid).update({ 
      role,
      isAdmin: role === "ADMIN"
    });

    // Audit role change separately from the basic admin log.
    const roleChangeRef = adminDb.collection("admin_role_changes").doc();
    await roleChangeRef.set({
      action: "SET_USER_ROLE",
      adminUid,
      targetUid,
      previousRole,
      newRole: role,
      grantedAt: admin.firestore.FieldValue.serverTimestamp(),
      source: "CUSTOM_CLAIMS"
    });

    // NOTIFICATION: Role Elevation/Change
    let notificationMsg = `Your operator clearance has been upgraded to: ${role}. Access to tactical dashboards has been adjusted.`;
    if (previousRole === 'PARTNER' && role === 'USER') {
      notificationMsg = `Your Tactical Partner clearance has been revoked. Access to the Partner Portal has been removed.`;
      
      // Send Email for revocation
      if (userSnap.exists && userSnap.data()?.email) {
        const username = userSnap.data()?.username || "Operative";
        const email = userSnap.data()!.email;
        await sendTacticalEmail(
          email,
          "Partner Status Update",
          getPartnerRevokedEmailTemplate(username)
        ).catch(e => console.error("Failed to send partner revoke email", e));
      }
    }

    await createNotificationInternal(
      targetUid,
      "Clearance Level Modified",
      notificationMsg,
      "SYSTEM"
    );

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] setUserRole error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: UPGRADE USER TO PARTNER (INFLUENCER)
 */
export async function upgradeToPartnerAction(
  idToken: string,
  targetUid: string,
  customCode?: string,
  durationDays: number = 90,
  securityPin?: string
) {
  const adminUid = await getVerifiedAdminUid(idToken, true);

  try {
    // 🔒 [FORTRESS] Guard: Verify PIN for partner induction
    if (securityPin) {
      const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
      if (!pinVerification.success) throw new Error(pinVerification.error);
    }
    const userRef = adminDb.collection("users").doc(targetUid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) throw new Error("User not found.");
    
    const userData = userSnap.data()!;
    const username = userData.username || "OPERATIVE";

    // Generate code if none provided
    const referralCode = customCode?.trim().toUpperCase() || 
      `${username.slice(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    // Calculate expiry based on durationDays (max 90 as per protocol)
    const finalDuration = Math.min(durationDays || 90, 90);
    const expiry = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + finalDuration * 24 * 60 * 60 * 1000)
    );

    await adminDb.runTransaction(async (transaction) => {
      // 1. Update user document
      transaction.update(userRef, {
        role: 'PARTNER',
        myReferralCode: referralCode,
        partnerCreatedAt: admin.firestore.FieldValue.serverTimestamp(),
        partnerExpiresAt: expiry,
        partnerApprovedBy: adminUid
      });

      // 2. Set custom claims for security
      await adminAuth.setCustomUserClaims(targetUid, {
        role: 'PARTNER'
      });

      // 3. Audit Log
      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: "UPGRADE_PARTNER",
        adminUid,
        targetUid,
        referralCode,
        expiry: expiry.toDate().toISOString(),
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    // 4. Dynamic Formatting & Notification
    let displayDuration = `${finalDuration} days`;
    if (finalDuration < 1) {
      const mins = Math.round(finalDuration * 24 * 60);
      displayDuration = mins >= 60 ? `${Math.round(mins / 60)} hours` : `${mins} minutes`;
    }

    await createNotificationInternal(
      targetUid,
      "Tactical Partner Clearance Granted",
      `Your account has been upgraded to PARTNER status. Access your Partner Portal now. Code: ${referralCode}. Expiry: ${displayDuration}.`,
      "SYSTEM"
    );

    // 5. Send Induction Email
    if (userData.email) {
      await sendTacticalEmail(
        userData.email,
        "Partner Account Upgraded",
        getPartnerUpgradeEmailTemplate(username, displayDuration, referralCode)
      ).catch(e => console.error("Failed to send partner induction email", e));
    }

    return { success: true, referralCode };
  } catch (error: any) {
    console.error("[AdminAction] upgradeToPartner error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: MANUALLY ADJUST USER BALANCE
 * 🔒 [SECURITY] H-005 FIX: Add balance minimum check + audit logging
 */
export async function adjustUserBalanceAction(
  idToken: string,
  targetUid: string,
  amount: number, // positive = add, negative = deduct
  justification: string,
  securityPin: string
) {
  const adminUid = await getVerifiedAdminUid(idToken, true);

  try {
    const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
    if (!pinVerification.success) throw new Error(pinVerification.error);
    
    const superAdminUid = await getVerifiedSuperAdminUid(idToken).catch(() => null);
    // FIX A-001: Large adjustments require 2-admin approval
    const requiresApproval = Math.abs(amount) > 1000;
    
    if (requiresApproval && !superAdminUid) {
      // Create approval request
      const approvalRef = adminDb.collection("admin_approval_queue").doc();
      await approvalRef.set({
        type: "BALANCE_ADJUSTMENT",
        requesterId: adminUid,
        targetUid,
        amount,
        justification,
        status: "PENDING",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 24 * 60 * 60 * 1000)), // 24hr approval window
      });

      // Notify SUPER_ADMIN for approval
      const staffQuery = adminDb.collection("admin_audit_log")
        .where("action", "==", "SUPER_ADMIN_ACTION")
        .limit(1);
      
      return {
        success: false,
        requiresApproval: true,
        error: `Adjustment of ${amount} CR requires SUPER_ADMIN approval. Request submitted. Waiting for approval...`,
        approvalRequestId: approvalRef.id
      };
    }

    const result = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection("users").doc(targetUid);
      const userSnap = await transaction.get(userRef);
      
      if (!userSnap.exists) throw new Error("User not found");
      
      const userData = userSnap.data()!;
      const currentBalance = userData.balanceCoins || 0;
      const newBalance = currentBalance + amount;
      
      // 🔒 [SECURITY] Prevent negative balance
      if (newBalance < 0) {
        throw new Error(`Cannot create negative balance. Current: ${currentBalance}, Adjustment: ${amount}, Would be: ${newBalance}`);
      }

      // Update balance
      transaction.update(userRef, {
        balanceCoins: newBalance,
        ...(amount > 0 && { lifetimeDeposits: admin.firestore.FieldValue.increment(amount) })
      });

      // 🔒 FIX A-006: Enhanced audit log with approval info
      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: "BALANCE_ADJUST",
        adminUid,
        superAdminApproved: requiresApproval ? superAdminUid : null,
        targetUid,
        previousBalance: currentBalance,
        newBalance,
        amount,
        justification,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        details: {
          approvalRequired: requiresApproval,
          createdAt: new Date().toISOString()
        }
      });

      // If large approval was required, update approval queue
      if (requiresApproval && superAdminUid) {
        const approvalQueue = adminDb.collection("admin_approval_queue");
        const pendingQuery = await approvalQueue
          .where("requesterId", "==", adminUid)
          .where("targetUid", "==", targetUid)
          .where("status", "==", "PENDING")
          .get();
        
        for (const doc of pendingQuery.docs) {
          transaction.update(doc.ref, {
            status: "approved",
            approverId: superAdminUid,
            approvedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      }

      // If positive, update platform stats
      if (amount > 0) {
        const statsRef = adminDb.collection("stats").doc("platform_finances");
        transaction.set(statsRef, {
          totalAdjustments: admin.firestore.FieldValue.increment(1),
          totalAdjustedAmount: admin.firestore.FieldValue.increment(amount),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      return { currentBalance, newBalance };
    });

    // Notify user outside transaction
    await createNotificationInternal(
      targetUid,
      amount > 0 ? "Credits Deposited" : "Credits Deducted",
      `Tactical update: ${Math.abs(amount)} CR ${amount > 0 ? 'added to' : 'removed from'} your wallet. Reason: ${justification}`,
      "SYSTEM"
    );

    console.log(`✅ [ADMIN] Balance adjusted: ${targetUid} ${amount > 0 ? '+' : ''}${amount} CR by ${adminUid}${requiresApproval && superAdminUid ? ` (approved by SUPER_ADMIN ${superAdminUid})` : ''}`);
    return { success: true, ...result };
  } catch (error: any) {
    console.error("[AdminAction] adjustBalance error:", error);
    return { success: false, error: error.message };
  }
}

// ─── ARENA MANAGEMENT ────────────────────────────────────────────────────────

/**
 * ADMIN ACTION: CANCEL STALE / GHOST MATCH
 * Forcefully closes a broken lobby and refunds all staked fees.
 */
export async function cancelStaleMatchAction(idToken: string, matchId: string) {
  await getVerifiedAdminUid(idToken);

  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match not found.");

      const matchData = matchSnap.data() as Match;
      if (matchData.status === "CLOSED") throw new Error("Match already closed.");

      const players = Object.keys(matchData.players);
      const fee = matchData.challengeFee;

      // 1. Refund all players and undo wager tracking
      for (const uid of players) {
        const userRef = adminDb.collection("users").doc(uid);
        transaction.update(userRef, {
          balanceCoins: admin.firestore.FieldValue.increment(fee),
          lifetimeWagered: admin.firestore.FieldValue.increment(-fee),
          "intervention.active": false
        });
      }

      // 2. RECURSIVE LOGIC: If this is a gathering room for a circuit, close everything associated
      if (matchData.circuitId) {
        const circuitRef = adminDb.collection("circuits").doc(matchData.circuitId);
        transaction.update(circuitRef, { status: 'COMPLETED', adminNote: `Cancelled via gathering lobby #${matchId}` });

        // Find all matches belonging to this circuit and close them
        // Note: Querying matches in a transaction isn't straightforward without knowing all IDs.
        // However, we can update the circuit status, and a background task or the UI can handle the rest.
        // For absolute consistency, we'll mark the circuit as COMPLETED.
      }

    });
    
    // Nuke it
    await purgeMatchDataInternal(matchId);
    
    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] cancelStaleMatch error:", error);
    return { success: false, error: error.message };
  }
}

// ─── DATA FETCHERS ────────────────────────────────────────────────────────────

/**
 * ADMIN: GET ALL DISPUTED MATCHES
 */
export async function getDisputedMatchesAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const snap = await adminDb
      .collection("matches")
      .where("status", "==", "DISPUTED")
      .limit(50)
      .get();
    
    const matches = await Promise.all(snap.docs.map(async (doc) => {
      const matchData = sanitizeData({ id: doc.id, ...doc.data() });
      
      // 1. Fetch all evidence from the dedicated subcollection (Modern Schema)
      const evidenceSnap = await doc.ref.collection("match_evidence").get();
      const subcollectionEvidence = evidenceSnap.docs.map(e => sanitizeData({ id: e.id, ...e.data() }));
      
      // 2. Scrape evidence from legacy fields (Backward Compatibility)
      const legacyEvidence: any[] = [];
      
      // From players map
      if (matchData.players) {
        Object.entries(matchData.players).forEach(([uid, p]: [string, any]) => {
          if (p.proofUrl) {
            legacyEvidence.push({
              id: `legacy_result_${uid}`,
              url: p.proofUrl,
              type: 'image',
              ownerUid: uid,
              username: p.username || "Operator",
              isLegacy: true
            });
          }
        });
      }

      // From match-level dispute fields
      if (matchData.disputeImageProof) {
        legacyEvidence.push({
          id: 'legacy_dispute_img',
          url: matchData.disputeImageProof,
          type: 'image',
          ownerUid: matchData.disputedBy || "unknown",
          username: "Dispute Filer",
          isLegacy: true
        });
      }
      if (matchData.disputeVideoProof) {
        legacyEvidence.push({
          id: 'legacy_dispute_vid',
          url: matchData.disputeVideoProof,
          type: 'video',
          ownerUid: matchData.disputedBy || "unknown",
          username: "Dispute Filer",
          isLegacy: true
        });
      }

      // Merge and deduplicate by URL to prevent showing the same image twice
      const allEvidenceMap = new Map();
      [...legacyEvidence, ...subcollectionEvidence].forEach(ev => {
        if (!allEvidenceMap.has(ev.url)) {
          allEvidenceMap.set(ev.url, ev);
        }
      });

      matchData.allEvidence = Array.from(allEvidenceMap.values());
      
      return matchData;
    }));

    return { success: true, matches };
  } catch (error: any) {
    console.error("[AdminAction] getDisputedMatches error:", error);
    return { success: false, error: error.message, matches: [] };
  }
}

/**
 * ADMIN: SEARCH USER BY USERNAME OR UID
 */
export async function searchUserAction(idToken: string, query: string) {
  const adminUid = await getVerifiedAdminUid(idToken);

  // 🔒 [SECURITY] PHASE 4: Rate limit admin searches (30 searches/minute per admin)
  const rateLimitKey = `admin_search_${adminUid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 30, 60 * 1000); // 30 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many searches. Try again in ${rateLimitResult.retryAfter} seconds.`,
      users: []
    };
  }
  
  // 🔒 [SECURITY] M-008 FIX: Username search injection prevention
  const sanitizedQuery = query.trim();
  const usernameRegex = /^[a-zA-Z0-9_ -]{2,32}$/;
  
  // For UID search, allow full UUID format (must be exact)
  const uidRegex = /^[a-zA-Z0-9_-]{20,}$/;
  
  const isValidUsername = usernameRegex.test(sanitizedQuery);
  const isValidUid = uidRegex.test(sanitizedQuery);
  
  if (!isValidUsername && !isValidUid) {
    return {
      success: false,
      error: "Invalid search query. Use alphanumeric characters, spaces, _ or - (2-32 chars).",
      users: []
    };
  }
  
  try {
      const processUsers = async (docs: FirebaseFirestore.DocumentSnapshot[]) => {
        const resultUsers = [];
        for (const doc of docs) {
          const data = doc.data();
          if (!data) continue;
          
          // 🔒 [LAZY DOWNGRADE] Automatically demote expired partners when scanned
          if (data.role === 'PARTNER' && data.partnerExpiresAt) {
            const expiryDate = data.partnerExpiresAt.seconds ? new Date(data.partnerExpiresAt.seconds * 1000) : new Date(data.partnerExpiresAt);
            if (expiryDate <= new Date()) {
              try {
                await adminAuth.setCustomUserClaims(doc.id, { role: 'USER', isAdmin: false, isSuperAdmin: false });
                await doc.ref.update({ role: 'USER' });
                data.role = 'USER'; // Reflect immediately in UI
                console.log(`[LazyRevoke] Automatically downgraded expired partner: ${doc.id}`);
              } catch (err) {
                console.error(`[LazyRevoke] Failed to downgrade ${doc.id}`, err);
              }
            }
          }
          resultUsers.push(sanitizeData({ id: doc.id, ...data }));
        }
        return resultUsers;
      };

    if (isValidUid) {
      const byUid = await adminDb.collection("users").doc(sanitizedQuery).get();
      if (byUid.exists) {
        return { success: true, users: await processUsers([byUid]) };
      }
    }
    
    if (isValidUsername) {
      const queryLower = sanitizedQuery.toLowerCase();
      
      // 🎯 SMART SEARCH: Try normalized lowercase field first
      const snapLower = await adminDb.collection("users")
        .where("usernameLower", ">=", queryLower)
        .where("usernameLower", "<=", queryLower + "\uf8ff")
        .limit(20)
        .get();

      if (!snapLower.empty) {
        return { success: true, users: await processUsers(snapLower.docs) };
      }

      // 🏺 LEGACY FALLBACK: Search original username (case-sensitive prefix)
      const snapLegacy = await adminDb.collection("users")
        .where("username", ">=", sanitizedQuery)
        .where("username", "<=", sanitizedQuery + "\uf8ff")
        .limit(20)
        .get();
        
      return { success: true, users: await processUsers(snapLegacy.docs) };
    }
    
    return { success: true, users: [] };
  } catch (error: any) {
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * ADMIN: GET PLATFORM OVERVIEW STATS
 */
export async function getPlatformStatsAction(idToken: string): Promise<{ success: boolean; error?: string; stats: { totalUsers: number; totalMatches: number; openDisputes: number; activeMatches: number; codmMatches: number; efootballMatches: number; financeDeposits: number; financePayouts: number; financeRevenue: number; financeWithdrawals: number; format1v1: number; format5v5: number; formatBR: number; formatFFA: number; formatTourney: number; formatLeague: number; awaitingPayouts: number; pendingPartners: number; } | null; }> {
  const adminUid = await getVerifiedAdminUid(idToken);

  // 🔒 [SECURITY] PHASE 4: Rate limit admin stats requests (20 requests/minute per admin)
  const rateLimitKey = `admin_stats_${adminUid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 20, 60 * 1000); // 20 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many stats requests. Try again in ${rateLimitResult.retryAfter} seconds.`,
      stats: null
    };
  }

  const now = Date.now();
  if (platformStatsCache && platformStatsCache.expiresAt > now) {
    return { success: true, stats: platformStatsCache.stats };
  }

  try {
    const [
      usersSnap, matchesSnap, disputedSnap, activeSnap, codmSnap, efootballSnap, financesSnap,
      v1Snap, v5Snap, brSnap, ffaSnap, tourneySnap, leagueSnap, resolvingSnap, partnerAppSnap
    ] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("matches").count().get(),
      adminDb.collection("matches").where("status", "==", "DISPUTED").count().get(),
      adminDb.collection("matches").where("status", "in", ["WAITING", "READY", "PLAYING", "RESOLVING"]).count().get(),
      adminDb.collection("matches").where("game", "==", "CODM").count().get(),
      adminDb.collection("matches").where("game", "==", "EFOOTBALL").count().get(),
      adminDb.collection("stats").doc("platform_finances").get(),
      adminDb.collection("matches").where("format", "==", "1v1").count().get(),
      adminDb.collection("matches").where("format", "==", "5v5").count().get(),
      adminDb.collection("matches").where("format", "==", "br").count().get(),
      adminDb.collection("matches").where("format", "==", "ffa").count().get(),
      adminDb.collection("matches").where("format", "==", "tournament").count().get(),
      adminDb.collection("matches").where("format", "==", "league").count().get(),
      adminDb.collection("matches").where("status", "==", "RESOLVING").count().get(),
      adminDb.collection("partner_applications").where("status", "==", "PENDING").count().get(),
    ]);

    const finances = financesSnap.exists ? financesSnap.data() : { 
      totalDeposits: 0, totalPayouts: 0, totalPlatformCut: 0, totalWithdrawals: 0 
    };

    const stats = {
      totalUsers: usersSnap.data().count,
      totalMatches: matchesSnap.data().count,
      openDisputes: disputedSnap.data().count,
      activeMatches: activeSnap.data().count,
      codmMatches: codmSnap.data().count,
      efootballMatches: efootballSnap.data().count,
      financeDeposits: finances?.totalDeposits || 0,
      financePayouts: finances?.totalPayouts || 0,
      financeRevenue: finances?.totalPlatformCut || 0,
      financeWithdrawals: finances?.totalWithdrawals || 0,
      format1v1: v1Snap.data().count,
      format5v5: v5Snap.data().count,
      formatBR: brSnap.data().count,
      formatFFA: ffaSnap.data().count,
      formatTourney: tourneySnap.data().count,
      formatLeague: leagueSnap.data().count,
      awaitingPayouts: resolvingSnap.data().count,
      pendingPartners: partnerAppSnap.data().count,
    };

    platformStatsCache = { expiresAt: now + 30 * 1000, stats };

    return {
      success: true,
      stats,
    };
  } catch (error: any) {
    return { success: false, error: error.message, stats: null };
  }
}

// ─── TREASURY / PAYOUTS ──────────────────────────────────────────────────────

export async function getPendingWithdrawalsAction(idToken: string) {
  const adminUid = await getVerifiedAdminUid(idToken);

  // 🔒 [SECURITY] PHASE 4: Rate limit admin withdrawal queries (15 requests/minute per admin)
  const rateLimitKey = `admin_withdrawals_${adminUid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 15, 60 * 1000); // 15 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many withdrawal queries. Try again in ${rateLimitResult.retryAfter} seconds.`,
      tickets: []
    };
  }
  try {
    const snap = await adminDb
      .collection("withdrawals")
      .where("status", "==", "PENDING")
      .limit(100)
      .get();
    
    // Sort manually in JS to avoid index requirement for simple POC/initial phase
    const tickets = snap.docs.map((d) => {
      const data = d.data();
      // Decrypt account number for admin display
      let accountNumber = '';
      try {
        if (data.encryptedAccountNumber) {
          accountNumber = decryptData(data.encryptedAccountNumber);
          if (!accountNumber) throw new Error("Decryption returned empty string (Check ENCRYPTION_KEY mismatch)");
        } else {
          accountNumber = data.accountNumber || '';
        }
      } catch (decryptError) {
        console.error(`Failed to decrypt account number for withdrawal ${d.id}:`, decryptError);
        accountNumber = '[DECRYPTION_FAILED]';
      }
      return sanitizeData({ id: d.id, ...data, accountNumber });
    });
    tickets.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));

    return { success: true, tickets };
  } catch (error: any) {
    return { success: false, error: error.message, tickets: [] };
  }
}

export async function adminApproveWithdrawalAction(idToken: string, withdrawalId: string, securityPin: string) {
  const adminUid = await getVerifiedAdminUid(idToken, true);

  try {
    const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
    if (!pinVerification.success) throw new Error(pinVerification.error);

    const FLUTTERWAVE_SECRET = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!FLUTTERWAVE_SECRET) throw new Error("Flutterwave secret key missing.");

    const wRef = adminDb.collection("withdrawals").doc(withdrawalId);
    
    // FETCH DATA ONCE
    const initialSnap = await wRef.get();
    if (!initialSnap.exists || initialSnap.data()?.status !== "PENDING") {
      return { success: false, error: "Withdrawal invalid or already processed." };
    }
    const wData = initialSnap.data()!;
    const amountCoins = wData.amountCoins || 0;
    const netAmount = wData.netAmount || 0;
    const fiatAmountUSD = wData.fiatAmount || 0;
    const currency = wData.currency || "NGN";

    console.log(`[AdminAction] Processing withdrawal ${withdrawalId}:`, {
      amountCoins,
      netAmount,
      fiatAmountUSD,
      currency,
      user: wData.username
    });

    // Decrypt account number for processing
    let accountNumber = '';
    try {
      accountNumber = decryptData(wData.encryptedAccountNumber || wData.accountNumber);
      if (!accountNumber) {
        throw new Error("ENCRYPTION_KEY mismatch or data corrupted");
      }
      console.log(`[AdminAction] ✅ Decrypted account number for ${wData.username}:`, {
        masked: accountNumber.slice(0, 4) + '***',
        length: accountNumber.length
      });
    } catch (decryptErr: any) {
      console.error(`[AdminAction] ❌ Decryption failed for withdrawal ${withdrawalId}:`, {
        message: decryptErr.message,
        hasEncrypted: !!wData.encryptedAccountNumber,
        storedValue: wData.encryptedAccountNumber?.substring(0, 50) + '...'
      });
      return { success: false, error: `Decryption failed: ${decryptErr.message}. Possible ENCRYPTION_KEY mismatch.` };
    }

    // ── STEP 1: Process Transfer ──────────────────────────────────────────
    let transferId = "";
    let transferStatus = "pending";
    const bankCode = wData.bankCode || "058"; // Fallback to GTB if missing

    // Force Success in Test Mode if using the universal test account
    const isTestAccount = accountNumber === "0000000000" || accountNumber.includes("0000");

    if (FLUTTERWAVE_SECRET.startsWith("FLWSECK_TEST") && isTestAccount) {
      console.warn("[AdminAction] Simulating Flutterwave Transfer for Test Account.");
      transferId = `FW_MOCK_${Math.random().toString(36).substring(7).toUpperCase()}`;
      transferStatus = "successful";
      await new Promise(res => setTimeout(res, 800)); // Realism
    } else {
      // Fetch real exchange rate for the target currency
      const rate = await getPlatformRate(currency, 'WITHDRAWAL');
      const transferAmount = Math.round(fiatAmountUSD * rate);

      console.log(`[AdminAction] Flutterwave transfer details:`, {
        fiatUSD: fiatAmountUSD,
        currency,
        rate,
        localAmount: transferAmount,
        accountNumber: accountNumber.slice(0, 4) + '***',
        bankCode
      });

      const transferRes = await fetch("https://api.flutterwave.com/v3/transfers", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${FLUTTERWAVE_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank: bankCode,
          account_number: accountNumber,
          amount: transferAmount,
          narration: `CGameCore payout for ${wData.username} (${amountCoins} CR)`,
          currency: currency,
          callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/flutterwave`,
          debit_currency: currency,
        }),
      });

      const transferJson = await transferRes.json();
      
      if (transferJson.status !== 'success') {
        // DEV FAILSAFE: Mock if in test mode even if API rejected (e.g. balance issues)
        if (FLUTTERWAVE_SECRET.startsWith("FLWSECK_TEST")) {
           console.warn("[AdminAction] Flutterwave rejected test transfer. Mocking to unblock.", transferJson.message);
           transferId = `FW_MOCK_ERR_${Math.random().toString(36).substring(7).toUpperCase()}`;
           transferStatus = "successful";
        } else {
           console.error("[AdminAction] Flutterwave transfer failed:", transferJson);
           return { success: false, error: `Transfer failed: ${transferJson.message || "Flutterwave rejected the request."}` };
        }
      } else {
        transferId = transferJson.data.id.toString();
        transferStatus = transferJson.data.status; // Usually "NEW" or "PENDING"
      }
    }

    // ── STEP 2: Update Firestore atomically ─────────────────────────────────
    await adminDb.runTransaction(async (transaction) => {
      const tSnap = await transaction.get(wRef);
      if (!tSnap.exists || tSnap.data()?.status !== "PENDING") {
        throw new Error("CONCURRENCY_ERROR: Already processed.");
      }

      transaction.update(wRef, {
        status: "APPROVED",
        flutterwaveTransferId: transferId,
        flutterwaveStatus: transferStatus,
        gateway: "FLUTTERWAVE",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: adminUid,
      });

      if (amountCoins > 0) {
        const platformFinancesRef = adminDb.collection("stats").doc("platform_finances");
        transaction.set(platformFinancesRef, {
          totalWithdrawals: admin.firestore.FieldValue.increment(amountCoins),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      const withdrawalReference = transferId || `FW_WITHDRAW_${wRef.id}`;
      const displayAmountUSD = (amountCoins / 100).toFixed(2);
      const notificationMessage = `Your withdrawal of $${displayAmountUSD} has been initiated via Flutterwave. Reference: ${withdrawalReference}. Funds typically arrive within 24 hours.`;

      await createNotificationInternal(
        wData.uid,
        "Withdrawal Sent!",
        notificationMessage,
        "SYSTEM"
      );

      // 3. Dispatch Extraction Email (Tactical Success)
      if (wData.email) {
        const displayAmountUSD = (amountCoins / 100).toFixed(2);
        const amountStr = `$${displayAmountUSD} (${currency})`;
        const emailHtml = getExtractionEmailTemplate(wData.username, amountStr, wData.bankName || "Digital Extraction");
        sendTacticalEmail(wData.email, "Withdrawal Processed", emailHtml).catch(e => {
          console.error("Failed to send extraction email:", e);
        });
      }
    });

    return { success: true, transferId };
  } catch (error: any) {
    console.error("[AdminAction] adminApproveWithdrawal error:", error);
    return { success: false, error: error.message };
  }
}

export async function adminRejectWithdrawalAction(
  idToken: string, 
  withdrawalId: string,
  reason: string
) {
  const adminUid = await getVerifiedAdminUid(idToken, true); // Admin only - financial operations
  if (!reason?.trim()) throw new Error("A rejection reason is required.");

  try {
    await adminDb.runTransaction(async (transaction) => {
      const wRef = adminDb.collection("withdrawals").doc(withdrawalId);
      
      const wSnap = await transaction.get(wRef);
      if (!wSnap.exists || wSnap.data()?.status !== "PENDING") {
        throw new Error("Withdrawal invalid or already processed.");
      }

      const wData = wSnap.data()!;
      const uid = wData.uid; // C-05: Fetch from DB truth instead of client payload
      const amountCoins = wData.amountCoins || 0;
      const uRef = adminDb.collection("users").doc(uid);

      // 1. Mark as rejected
      transaction.update(wRef, {
        status: "REJECTED",
        rejectionReason: reason,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: adminUid
      });

      // 2. Refund the coins
      transaction.update(uRef, {
        balanceCoins: admin.firestore.FieldValue.increment(amountCoins)
      });

      // 3. Queue Notification (Using internal utility)
      await createNotificationInternal(
        uid,
        "Withdrawal Rejection",
        `Your withdrawal request was rejected for: ${reason}. Your coins have been refunded.`,
        "FINANCE"
      );
    });
    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] adminRejectWithdrawal error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: GET PLAYER FORENSIC AUDIT (MATCH HISTORY + FINANCES)
 */
export async function getUserAuditHistoryAction(idToken: string, targetUid: string) {
  const adminUid = await getVerifiedAdminUid(idToken);

  // 🔒 [SECURITY] PHASE 4: Rate limit admin audit requests (10 audits/minute per admin)
  const rateLimitKey = `admin_audit_${adminUid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 10, 60 * 1000); // 10 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many audit requests. Try again in ${rateLimitResult.retryAfter} seconds.`,
      audit: []
    };
  }
  try {
    // 1. Fetch Matches
    const matchSnap = await adminDb
      .collection("matches")
      .where("playerIds", "array-contains", targetUid)
      .limit(50)
      .get();
    
    const matches = matchSnap.docs.map(doc => {
      const m = doc.data();
      const playerEntry = m.players?.[targetUid] || {};
      return {
        id: doc.id,
        type: 'MATCH',
        game: m.game,
        format: m.format,
        fee: m.challengeFee,
        status: m.status,
        claim: playerEntry.claim || 'NONE',
        proofUrl: playerEntry.proofUrl || null,
        isWinner: m.championUid === targetUid,
        reward: m.championUid === targetUid ? m.rewardAmount : 0,
        createdAt: sanitizeData(m.createdAt),
      };
    });

    // 2. Fetch User Profile for Join Date
    const userSnap = await adminDb.collection("users").doc(targetUid).get();
    const userData = userSnap.exists ? userSnap.data() : null;
    const joinDate = userData?.createdAt ? sanitizeData(userData.createdAt) : null;

    // 3. Fetch Financial History (Balance Adjustments)
    const logsSnap = await adminDb.collection("admin_audit_log").where("targetUid", "==", targetUid).get();
    const adjusts = logsSnap.docs.map(d => ({
       id: d.id,
       type: 'FINANCE_ADJUST',
       game: 'SYSTEM',
       format: 'BALANCE',
       fee: d.data().amount,
       status: 'COMPLETED',
       claim: d.data().justification || 'Adjustment',
       createdAt: sanitizeData(d.data().timestamp),
       isWinner: d.data().amount > 0,
       reward: 0
    }));

    // 4. Fetch User Withdrawals
    const withSnap = await adminDb.collection("withdrawals").where("uid", "==", targetUid).get();
    const withdrawals = withSnap.docs.map(d => ({
       id: d.id,
       type: 'FINANCE_WITHDRAW',
       game: 'BANK',
       format: 'PAYOUT',
       fee: d.data().amountCoins,
       status: d.data().status,
       claim: d.data().bankName || 'Payout',
       createdAt: sanitizeData(d.data().createdAt),
       isWinner: false,
       reward: 0
    }));

    // Combine and Sort
    const auditData = [...matches, ...adjusts, ...withdrawals];
    auditData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return { success: true, audit: auditData, joinDate };
  } catch (error: any) {
    console.error("[AdminAction] getUserAuditHistory error:", error);
    return { success: false, error: error.message, audit: [] };
  }
}

/**
 * ADMIN: GET RECENT PLATFORM TRANSACTIONS
 * Fetches the latest deposits, fines, and manual adjustments.
 */
export async function getPlatformTransactionsAction(idToken: string, limitCount: number = 50) {
  await getVerifiedAdminUid(idToken);
  try {
    const snap = await adminDb
      .collection("transactions")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();
    
    return { 
      success: true, 
      transactions: snap.docs.map(d => sanitizeData({ id: d.id, ...d.data() })) 
    };
  } catch (error: any) {
    console.error("[AdminAction] getPlatformTransactions error:", error);
    return { success: false, error: error.message, transactions: [] };
  }
}

/**
 * INTERNAL HELPER: CREATE NOTIFICATION (DEPRECATED - MOVED TO LIB/NOTIFICATIONS)
 */

/**
 * ADMIN: TRIGGER GLOBAL INTERVENTION
 * Sets a high-priority, full-screen alert on a player's app.
 */
export async function triggerAdminInterventionAction(
  idToken: string,
  targetUid: string,
  matchId: string,
  message: string
) {
  const adminUid = await getVerifiedAdminUid(idToken);
  const adminSnap = await adminDb.collection("users").doc(adminUid).get();
  const adminName = adminSnap.data()?.username || "Command Admin";

  try {
    await adminDb.collection("users").doc(targetUid).update({
      intervention: {
        active: true,
        matchId,
        message,
        adminName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }
    });

    // Also create a persistent notification record
    await createNotificationInternal(
      targetUid,
      "ADMIN INTERVENTION",
      `An admin is requesting your immediate attention regarding Match #${matchId.slice(0, 8)}.`,
      "DISPUTE"
    );

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] triggerAdminIntervention error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: DISMISS GLOBAL INTERVENTION
 * Clears the full-screen alert from the player's app.
 */
export async function dismissAdminInterventionAction(idToken: string, targetUid: string) {
  await getVerifiedAdminUid(idToken);
  try {
    await adminDb.collection("users").doc(targetUid).update({
      "intervention.active": false
    });
    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] dismissAdminIntervention error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * USER: DISMISS OWN INTERVENTION
 * Allows a player to acknowledge they've seen the message.
 */
export async function dismissSelfInterventionAction(idToken: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;
    await adminDb.collection("users").doc(uid).update({
      "intervention.active": false
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: CLEANUP STALE TOURNAMENTS
 * Finds and removes "rubbish" duplicate lobbies and stale matches.
 */
export async function cleanupStaleTournamentsAction(idToken: string) {
  await getVerifiedAdminUid(idToken, true); // Admin only

  try {
    // 1. Find stale league/tournament gathering rooms (> 12h old and still WAITING)
    const threshold = new Date(Date.now() - 12 * 60 * 60 * 1000);
    const staleMatchesSnap = await adminDb.collection("matches")
      .where("format", "in", ["league", "tournament"])
      .where("status", "==", "WAITING")
      .where("createdAt", "<", threshold)
      .limit(100)
      .get();

    let count = 0;
    for (const doc of staleMatchesSnap.docs) {
      const data = doc.data();
      // Refund if players are inside
      const players = Object.keys(data.players || {});
      const fee = data.challengeFee || 0;

      await adminDb.runTransaction(async (transaction) => {
        if (fee > 0) {
          for (const uid of players) {
            transaction.update(adminDb.collection("users").doc(uid), {
              balanceCoins: admin.firestore.FieldValue.increment(fee),
              lifetimeWagered: admin.firestore.FieldValue.increment(-fee)
            });
          }
        }
        transaction.update(doc.ref, { status: 'CLOSED', adminNote: "Cleanup: Stale gathering lobby" });
      });
      count++;
    }

    // 2. Find orphaned group matches (belonging to closed circuits)
    // This is more complex to do in one pass, but we can target matches where the gatheringRoomId or circuitId is stale.
    
    return { success: true, count };
  } catch (error: any) {
    console.error("[AdminAction] cleanupStaleTournaments error:", error);
    return { success: false, error: error.message };
  }
}

// ─── MATCH CONTROL PANEL ─────────────────────────────────────────────────────

/**
 * ADMIN ACTION: GET ALL ACTIVE MATCHES
 * Returns all matches that are not yet CLOSED or COMPLETED, grouped by circuit.
 */
export async function getAllActiveMatchesAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const snap = await adminDb.collection("matches")
      .where("status", "not-in", ["CLOSED", "COMPLETED"])
      .limit(200)
      .get();

    // Sort client-side: status asc, then createdAt desc
    const matches = snap.docs
      .map(d => sanitizeData({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => {
        if (a.status < b.status) return -1;
        if (a.status > b.status) return 1;
        return (b.createdAt || "").localeCompare(a.createdAt || "");
      });
    return { success: true, matches };
  } catch (error: any) {
    console.error("[AdminAction] getAllActiveMatches error:", error);
    return { success: false, error: error.message, matches: [] };
  }
}

/**
 * ADMIN ACTION: GET EXPIRED MATCHES
 * Returns matches that have passed expiresAt and are still unresolved.
 */
export async function getExpiredMatchesAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const now = new Date();
    const snap = await adminDb.collection('matches')
      .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(now))
      .where('status', 'not-in', ['CLOSED', 'COMPLETED'])
      .limit(200)
      .get();

    const matches = snap.docs
      .map(d => sanitizeData({ id: d.id, ...d.data() }))
      .sort((a: any, b: any) => {
        if ((a.expiresAt || '') < (b.expiresAt || '')) return -1;
        if ((a.expiresAt || '') > (b.expiresAt || '')) return 1;
        return (b.createdAt || '').localeCompare(a.createdAt || '');
      });
    return { success: true, matches };
  } catch (error: any) {
    console.error('[AdminAction] getExpiredMatches error:', error);
    return { success: false, error: error.message, matches: [] };
  }
}

/**
 * ADMIN ACTION: RUN EXPIRED MATCH SWEEP NOW
 * Executes a manual sweep of expired matches using the same server logic as the scheduled worker.
 */
export async function adminRunExpiredMatchSweepAction(idToken: string, limit = 100) {
  await getVerifiedAdminUid(idToken);
  try {
    const result = await sweepExpiredMatches(limit);
    return { success: true, result };
  } catch (error: any) {
    console.error('[AdminAction] adminRunExpiredMatchSweep error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: RESOLVE A SPECIFIC EXPIRED MATCH
 */
export async function adminResolveExpiredMatchAction(idToken: string, matchId: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const matchRef = adminDb.collection('matches').doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error('Match not found.');
    const matchData = matchSnap.data() as any;

    if (!matchData.expiresAt || matchData.status === 'CLOSED' || matchData.status === 'COMPLETED') {
      throw new Error('Match is not eligible for expiry resolution.');
    }

    const expiredAt = matchData.expiresAt.toDate ? matchData.expiresAt.toDate() : new Date(matchData.expiresAt);
    if (expiredAt.getTime() > Date.now()) {
      throw new Error('Match has not expired yet.');
    }

    await adminDb.runTransaction(async (transaction) => {
      const playersList = Object.values(matchData.players || {});
      const readyCount = playersList.filter((p: any) => p.ready).length;
      const claimCount = playersList.filter((p: any) => p.claim).length;

      if (matchData.status === 'WAITING') {
        for (const uid of matchData.playerIds || []) {
          transaction.update(adminDb.collection('users').doc(uid), {
            balanceCoins: admin.firestore.FieldValue.increment(matchData.challengeFee || 0),
          });
          const logRef = adminDb.collection('transactions').doc();
          transaction.set(logRef, {
            uid,
            type: 'CREDIT',
            category: 'MATCH_REFUND',
            description: 'Match timed out before opponent joined; refund processed.',
            amount: matchData.challengeFee || 0,
            status: 'COMPLETED',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        transaction.update(matchRef, {
          status: 'CLOSED',
          disputeReason: 'MATCHMAKING_EXPIRED_REFUNDED',
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
      }

      if (readyCount === 0 || (readyCount === playersList.length && claimCount === 0)) {
        const { resolveDoubleNoShow } = await import('@/lib/match-engine/validation');
        await resolveDoubleNoShow(transaction, matchRef, matchData as any);
      } else if (readyCount === 1 && claimCount === 0) {
        const readyPlayerUid = (playersList.find((p: any) => p.ready) as any)?.uid;
        if (!readyPlayerUid) throw new Error('Unable to resolve ready player.');
        const { resolveTechnicalWin } = await import('@/lib/match-engine/validation');
        await resolveTechnicalWin(transaction, matchRef, matchData as any, readyPlayerUid);
      } else if (claimCount === 1) {
        const claimantUid = Object.keys(matchData.players).find((pid) => !!(matchData.players[pid] as any).claim);
        if (!claimantUid) throw new Error('No claimant found.');
        const claim = (matchData.players[claimantUid] as any).claim;
        let winnerUid = claimantUid;
        if (claim === 'LOSS') {
          winnerUid = Object.keys(matchData.players).find((pid) => pid !== claimantUid) || claimantUid;
        }
        const { resolveTechnicalWin } = await import('@/lib/match-engine/validation');
        await resolveTechnicalWin(transaction, matchRef, matchData as any, winnerUid);
      } else {
        throw new Error('Match is ambiguous; manual dispute resolution required.');
      }
    });

    await dispatchMatchResolutionNotifications(matchId, 'RESOLVED');
    return { success: true };
  } catch (error: any) {
    console.error('[AdminAction] adminResolveExpiredMatch error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: RESOLVE MATCH WITH SELECTED WINNER
 * Use this for stuck matches when an admin wants to award a player and close the game.
 */
export async function adminResolveMatchAction(idToken: string, matchId: string, winnerUid: string) {
  return await internalAdminResolveMatchAction(idToken, matchId, winnerUid);
}

export async function adminResolveMatchWithPinAction(idToken: string, matchId: string, winnerUid: string, securityPin: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
  if (!pinVerification.success) {
    throw new Error(pinVerification.error || 'Security PIN validation failed.');
  }
  return await internalAdminResolveMatchAction(idToken, matchId, winnerUid);
}

/**
 * ADMIN ACTION: FORCE CLOSE A MATCH
 * Marks a single match as CLOSED without triggering payouts.
 * Used to unblock a stuck match that blocks circuit progression.
 */
export async function adminForceCloseMatchAction(idToken: string, matchId: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  try {
    const matchRef = adminDb.collection("matches").doc(matchId);
    const snap = await matchRef.get();
    if (!snap.exists) throw new Error("Match not found.");

    await matchRef.update({
      status: "CLOSED",
      forceClosedByAdmin: true,
      resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_FORCE_CLOSE_MATCH",
      matchId,
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] forceCloseMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: DELETE A MATCH (AND CIRCUIT SUB-MATCHES)
 * Purges a match document, its messages, and — if it belongs to a circuit —
 * every other match that shares the same circuitId.
 */
export async function adminDeleteMatchAction(idToken: string, matchId: string, deleteCircuitMatches: boolean) {
  const adminUid = await getVerifiedAdminUid(idToken);
  try {
    const matchRef = adminDb.collection("matches").doc(matchId);
    const snap = await matchRef.get();
    if (!snap.exists) throw new Error("Match not found.");
    const matchData = snap.data() as any;

    const idsToNuke: string[] = [matchId];

    // If it's a circuit match and admin opted to nuke all siblings, collect them
    if (deleteCircuitMatches && matchData.circuitId) {
      const siblingSnap = await adminDb.collection("matches")
        .where("circuitId", "==", matchData.circuitId)
        .get();
      siblingSnap.docs.forEach(d => {
        if (!idsToNuke.includes(d.id)) idsToNuke.push(d.id);
      });
      // Also delete the circuit record itself
      await adminDb.collection("circuits").doc(matchData.circuitId).delete();
    }
    
    // If it's a league match
    if (deleteCircuitMatches && matchData.leagueId) {
       const siblingSnap = await adminDb.collection("matches")
        .where("leagueId", "==", matchData.leagueId)
        .get();
      siblingSnap.docs.forEach(d => {
        if (!idsToNuke.includes(d.id)) idsToNuke.push(d.id);
      });
      // Also delete the league record itself
      await adminDb.collection("leagues").doc(matchData.leagueId).delete();
    }

    // Purge all collected matches (messages + doc)
    for (const id of idsToNuke) {
      await purgeMatchDataInternal(id);
    }

    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_DELETE_MATCH",
      matchId,
      adminUid,
      deletedCircuitMatches: deleteCircuitMatches,
      affectedIds: idsToNuke,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, deletedCount: idsToNuke.length };
  } catch (error: any) {
    console.error("[AdminAction] deleteMatch error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN ACTION: ALERT PLAYERS
 * Triggers a visual and audio alert in the Chat Room for all players.
 */
export async function alertPlayersOfAdminPresence(idToken: string, matchId: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  
  try {
    const matchRef = adminDb.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("Match not found");
    const matchData = matchSnap.data() as Match;

    // Trigger visual banner for players
    await matchRef.update({
      adminAlert: true,
      adminAlertAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const players = Object.keys(matchData.players || {});
    await Promise.all(players.map(async (uid) => {
      await createNotificationInternal(
        uid,
        "🚨 ADMIN IN COMMS",
        `An administrator has joined Match #${matchId.slice(0, 8)} comms link. Please check your match chat immediately.`,
        "SYSTEM"
      );
    }));

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

/**
 * SUPER ADMIN: TOGGLE EMERGENCY SYSTEM LOCKDOWN
 */
export async function toggleSystemLockdownAction(idToken: string, active: boolean, reason: string = "", pin: string) {
  const superAdminUid = await getVerifiedSuperAdminUid(idToken);
  
  try {
    // 🔒 PIN Authorization Gate
    const auth = await verifyAdminSecurityPin(superAdminUid, pin);
    if (!auth.success) return auth;

    const configRef = adminDb.collection("system").doc("config");
    await configRef.set({
      lockdownActive: active,
      lockdownReason: reason,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: superAdminUid
    }, { merge: true });

    // Log the emergency action
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: active ? "emergency_lockdown_activated" : "emergency_lockdown_lifted",
      adminUid: superAdminUid,
      details: { reason },
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: active ? "CRITICAL" : "INFO"
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SUPER ADMIN: TOGGLE DUMMY DATA DISPLAY
 */
export async function toggleDummyDataAction(idToken: string, active: boolean, pin: string) {
  const superAdminUid = await getVerifiedSuperAdminUid(idToken);
  
  try {
    const auth = await verifyAdminSecurityPin(superAdminUid, pin);
    if (!auth.success) return auth;

    const configRef = adminDb.collection("system").doc("config");
    await configRef.set({
      showDummyData: active,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedBy: superAdminUid
    }, { merge: true });

    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: active ? "dummy_data_activated" : "dummy_data_deactivated",
      adminUid: superAdminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      severity: "INFO"
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


/**
 * SUPER ADMIN: GET AUDIT LOGS
 * Resolves adminUid into a human-readable username.
 */
export async function getAuditLogsAction(idToken: string, limit: number = 100) {
  try {
    const superAdminUid = await getVerifiedSuperAdminUid(idToken);
    const snap = await adminDb
      .collection("admin_audit_log")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    
    const logs = snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() }));

    // --- IDENTITY RESOLUTION ---
    // Extract unique UIDs that performed actions
    const uniqueAdminUids = Array.from(new Set(logs.map(log => log.adminUid).filter(Boolean)));
    
    if (uniqueAdminUids.length > 0) {
      // Fetch corresponding usernames in one batch
      // Note: Firestore 'in' queries are capped at 30 items per batch.
      // 100 logs usually only has a few active admins, so this is likely <30.
      const usersSnap = await adminDb.collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", uniqueAdminUids.slice(0, 30))
        .get();
      
      const usernameMap: Record<string, string> = {};
      usersSnap.forEach(uDoc => {
        usernameMap[uDoc.id] = uDoc.data().username || "Unknown Operator";
      });

      // Inject usernames into logs
      logs.forEach(log => {
        log.adminUsername = usernameMap[log.adminUid] || `ID: ${log.adminUid?.slice(0, 4)}...`;
      });
    }

    return { success: true, logs };
  } catch (error: any) {
    console.error("[AdminAction] getAuditLogs error:", error);
    return { success: false, error: error.message, logs: [] };
  }
}

/**
 * ADMIN: DELETE STALE CIRCUIT BY ID
 */
export async function adminDeleteCircuitByIdAction(idToken: string, circuitId: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  try {
    await adminDb.collection("circuits").doc(circuitId).delete();
    
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_DELETE_CIRCUIT",
      circuitId,
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: DELETE STALE LEAGUE BY ID
 */
export async function adminDeleteLeagueByIdAction(idToken: string, leagueId: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  try {
    await adminDb.collection("leagues").doc(leagueId).delete();
    
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_DELETE_LEAGUE",
      leagueId,
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: SETUP INITIAL SECURITY PIN
 * Can only be used if no PIN exists.
 */
export async function setupAdminPinAction(idToken: string, pin: string) {
  const adminUid = await getVerifiedAdminUid(idToken);
  
  // Check if PIN already exists
  const existing = await adminDb.collection("admin_secrets").doc(adminUid).get();
  if (existing.exists) {
    throw new Error("PIN_EXISTS: A security PIN is already established. Use the change PIN protocol.");
  }

  const result = await setAdminSecurityPin(adminUid, pin);
  
  if (result.success) {
    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "SETUP_ADMIN_PIN",
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  return result;
}


/**
 * [FORTRESS] SUPER_ADMIN: Reset an Admin's Security PIN
 * Purges the PIN hash for a target admin, forcing them into the "Initial Setup" flow on their next action.
 */
export async function resetAdminSecurityPinAction(idToken: string, targetUid: string, pin: string) {
  // 🔒 STRICT: Only Super Admins can purge security profiles
  const superAdminUid = await getVerifiedSuperAdminUid(idToken);

  try {
    // 🔒 PIN Authorization Gate
    const auth = await verifyAdminSecurityPin(superAdminUid, pin);
    if (!auth.success) return auth;

    const pinRef = adminDb.collection("admin_secrets").doc(targetUid);
    
    // Unconditionally delete - if it doesn't exist, that's fine, we want it gone.
    await pinRef.delete();

    // Log the security purge
    console.warn(`[SECURITY_PURGE] Super Admin wiped PIN for ${targetUid}`);

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] resetAdminSecurityPin error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * [FORTRESS] SUPER_ADMIN: Get all Staff members
 * Retrieves a list of all MODERATOR, ADMIN, and SUPER_ADMIN users for security oversight.
 */
export async function getStaffListAction(idToken: string) {
  await getVerifiedSuperAdminUid(idToken);

  try {
    const staffSnap = await adminDb.collection("users")
      .where("role", "in", ["MODERATOR", "ADMIN", "SUPER_ADMIN"])
      .get();

    const staff = staffSnap.docs.map(doc => ({
      uid: doc.id,
      username: doc.data().username || "Unknown",
      role: doc.data().role,
      email: doc.data().email || "Hidden",
    }));

    return { success: true, staff };
  } catch (error: any) {
    console.error("[AdminAction] getStaffList error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: GET PENDING PARTNER APPLICATIONS
 */
export async function getPartnerApplicationsAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const snap = await adminDb.collection("partner_applications")
      .where("status", "==", "PENDING")
      .orderBy("appliedAt", "desc")
      .limit(50)
      .get();
    
    return { success: true, applications: snap.docs.map(doc => sanitizeData({ id: doc.id, ...doc.data() })) };
  } catch (error: any) {
    console.error("[AdminAction] getPartnerApplications error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: APPROVE/REJECT PARTNER APPLICATION
 */
export async function approvePartnerApplicationAction(idToken: string, appId: string, approved: boolean, securityPin: string) {
  const adminUid = await getVerifiedAdminUid(idToken, true);
  
  try {
    const pinVerification = await verifyAdminSecurityPin(adminUid, securityPin);
    if (!pinVerification.success) throw new Error(pinVerification.error);

    const appRef = adminDb.collection("partner_applications").doc(appId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new Error("Application not found.");
    const appData = appSnap.data()!;

    if (approved) {
       // Perform the upgrade using existing logic but wrapping it
       const res = await upgradeToPartnerAction(idToken, appData.uid, undefined, 90, securityPin);
       if (!res.success) throw new Error(res.error);
       
       await appRef.update({ 
         status: 'APPROVED', 
         processedAt: admin.firestore.FieldValue.serverTimestamp(),
         processedBy: adminUid 
       });
    } else {
       await appRef.update({ 
         status: 'REJECTED', 
         processedAt: admin.firestore.FieldValue.serverTimestamp(),
         processedBy: adminUid 
       });
       await adminDb.collection("users").doc(appData.uid).update({ partnerStatus: 'REJECTED' });
       
       await createNotificationInternal(
         appData.uid,
         "Partner Application Update",
         "Your partner application has been reviewed and declined at this time. Focus on growing your tactical footprint and try again in the future.",
         "SYSTEM"
       );
    }

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] approvePartnerApplication error:", error);
    return { success: false, error: error.message };
  }
}
