"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { Match, Circuit } from "@/lib/match-service";
import { purgeMatchDataInternal } from "@/lib/match-cleanup";

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

import { getVerifiedAdminUid, getVerifiedSuperAdminUid } from "@/lib/server-utils";
import { checkRateLimit } from "@/lib/rate-limiter";
import { createNotificationInternal } from "@/lib/notifications";

// 🔒 [SECURITY] M-007 FIX: Test mode watermark - fail-safe check
// Production deployments MUST have NODE_ENV = 'production'
const MOCK_TRANSFER_WARNING = process.env.NODE_ENV !== 'production';
if (MOCK_TRANSFER_WARNING) {
  console.warn("⚠️ ADMIN ACTIONS: Running in TEST MODE. Mock transfers and purges are ENABLED. Financial operations may not be real.");
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
  winnerId: string // 'REFUND' triggers a void match
) {
  // 🔒 [SECURITY] M-007 FIX: Test mode watermark - warn if operating in non-production
  if (MOCK_TRANSFER_WARNING) {
    console.warn(`[TEST-MODE] Dispute resolution for match ${matchId} running in TEST MODE.`);
  }
  
  const adminUid = await getVerifiedAdminUid(idToken);

  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    const matchSnap = await matchRef.get();
    if (!matchSnap.exists) throw new Error("Match not found.");
    const matchData = matchSnap.data() as Match;
    const players = Object.keys(matchData.players);
    const fee = matchData.challengeFee;

    await adminDb.runTransaction(async (transaction) => {
      // Re-verify match state inside transaction
      const latestMatchSnap = await transaction.get(matchRef);
      const latestMatch = latestMatchSnap.data() as Match;
      
      // 🔒 [SECURITY] M-005 FIX: Dispute chain prevention - only DISPUTED can be resolved
      if (latestMatch.status !== "DISPUTED") {
        throw new Error("CHAIN_PREVENTION: Match must be in DISPUTED status. Current status: " + latestMatch.status);
      }
      
      // Mark as RESOLVING immediately to prevent concurrent resolution attempts
      transaction.update(matchRef, {
        status: "RESOLVING",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // H-03: Validate winnerId belongs to match
      if (winnerId !== "REFUND" && !players.includes(winnerId)) {
        throw new Error("SEC-ALPHA-DENIED: Winner ID not found in this combat session.");
      }

      if (winnerId === "REFUND") {
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
      } else {
        // Award win to specified player
        const playersCount = players.length;
        const totalPool = fee * playersCount;
        const netPool = Math.floor(totalPool * 0.8); // 20% platform fee

        const winnerRef = adminDb.collection("users").doc(winnerId);
        transaction.update(winnerRef, {
          balanceCoins: admin.firestore.FieldValue.increment(netPool),
          totalWins: admin.firestore.FieldValue.increment(1),
          totalMatches: admin.firestore.FieldValue.increment(1),
          "intervention.active": false
        });

        // Update loser's match count & notifications
        const loserIds = players.filter((p) => p !== winnerId);
        for (const loserUid of loserIds) {
          const loserRef = adminDb.collection("users").doc(loserUid);
          transaction.update(loserRef, {
            totalMatches: admin.firestore.FieldValue.increment(1),
            "intervention.active": false
          });

          const loserNoteRef = adminDb.collection("users").doc(loserUid).collection("notifications").doc();
          transaction.set(loserNoteRef, {
            title: "Tribunal Verdict: Defeat",
            message: `The Dispute Tribunal has ruled against your claim for Match #${matchId.slice(0, 8)}. Verdict is final.`,
            type: "DISPUTE",
            read: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }

        const winnerNoteRef = winnerRef.collection("notifications").doc();
        transaction.set(winnerNoteRef, {
          title: "Tribunal Verdict: Victory",
          message: `The Dispute Tribunal has awarded you the victory for Match #${matchId.slice(0, 8)}. Credits added.`,
          type: "DISPUTE",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
      
      // Mark resolution as complete
      transaction.update(matchRef, {
        status: "CLOSED"
      });
    });

    // ── STEP 2: Initiate Nuke Protocol (Purge) ──────────────────────────────
    // Permanent deletion of arena data.
    await purgeMatchDataInternal(matchId);

    // Audit log
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "ADMIN_RESOLVE_DISPUTE",
      matchId,
      winnerId,
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] resolveDispute error:", error);
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
  durationHours?: number
) {
  // Only high-level Admins can ban
  const adminUid = await getVerifiedAdminUid(idToken, true);

  try {
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
 * ADMIN ACTION: SET USER ROLE (RBAC)
 */
export async function setUserRoleAction(
  idToken: string,
  targetUid: string,
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN"
) {
  // SUPER_ADMIN promotion requires SUPER_ADMIN level access
  const requireSuperAdmin = role === "SUPER_ADMIN";
  const adminUid = requireSuperAdmin 
    ? await getVerifiedSuperAdminUid(idToken)
    : await getVerifiedAdminUid(idToken, true);

  try {
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
    await createNotificationInternal(
      targetUid,
      "Clearance Level Modified",
      `Your operator clearance has been upgraded to: ${role}. Access to tactical dashboards has been adjusted.`,
      "SYSTEM"
    );

    return { success: true };
  } catch (error: any) {
    console.error("[AdminAction] setUserRole error:", error);
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
  justification: string
) {
  const adminUid = await getVerifiedAdminUid(idToken, true);
  if (!justification?.trim()) throw new Error("A justification is required for balance adjustments.");

  try {
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

      // 🔒 Log the adjustment with full audit trail
      const auditRef = adminDb.collection("admin_audit_log").doc();
      transaction.set(auditRef, {
        action: "BALANCE_ADJUST",
        adminUid,
        targetUid,
        previousBalance: currentBalance,
        newBalance,
        amount,
        justification,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      // 3. Notify the user of the balance adjustment (Reason visibility requested by user)
      const typeLabel = amount > 0 ? "Credit" : "Deduction";
      await createNotificationInternal(
        targetUid,
        `Wallet ${typeLabel}`,
        `Admin has updated your balance: ${justification}`,
        "FINANCE"
      );

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
      `Tactical update: ${Math.abs(amount)} CR ${amount > 0 ? 'added to' : 'removed from'} your wallet.`,
      "SYSTEM"
    );

    console.log(`✅ [ADMIN] Balance adjusted: ${targetUid} ${amount > 0 ? '+' : ''}${amount} CR by ${adminUid}`);
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
    return { success: true, matches: snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() })) };
  } catch (error: any) {
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
  // Sanitize query - allow only alphanumeric, underscore, hyphen, 2-32 chars
  const sanitizedQuery = query.trim();
  const usernameRegex = /^[a-zA-Z0-9_-]{2,32}$/;
  
  // For UID search, allow full UUID format (must be exact)
  const uidRegex = /^[a-zA-Z0-9_-]{20,}$/; // Firebase UIDs are typically 28+ chars
  
  const isValidUsername = usernameRegex.test(sanitizedQuery);
  const isValidUid = uidRegex.test(sanitizedQuery);
  
  if (!isValidUsername && !isValidUid) {
    return {
      success: false,
      error: "Invalid search query. Username must be 2-32 characters (alphanumeric, _ or -), or provide a valid UID.",
      users: []
    };
  }
  
  try {
    // Try UID first (exact match) - only if it looks like a UID
    if (isValidUid) {
      const byUid = await adminDb.collection("users").doc(sanitizedQuery).get();
      if (byUid.exists) {
        return { success: true, users: [sanitizeData({ id: byUid.id, ...byUid.data() })] };
      }
    }
    
    // Try username prefix match - only if it looks like a username
    if (isValidUsername) {
      const snap = await adminDb
        .collection("users")
        .where("username", ">=", sanitizedQuery)
        .where("username", "<=", sanitizedQuery + "\uf8ff")
        .limit(10)
        .get();
      return { success: true, users: snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() })) };
    }
    
    return { success: true, users: [] };
  } catch (error: any) {
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * ADMIN: GET PLATFORM OVERVIEW STATS
 */
export async function getPlatformStatsAction(idToken: string) {
  const adminUid = await getVerifiedAdminUid(idToken);

  // 🔒 [SECURITY] PHASE 4: Rate limit admin stats requests (20 requests/minute per admin)
  const rateLimitKey = `admin_stats_${adminUid}`;
  const rateLimitResult = await checkRateLimit(rateLimitKey, 20, 60 * 1000); // 20 requests per minute

  if (!rateLimitResult.allowed) {
    return {
      success: false,
      error: `Rate limited - too many stats requests. Try again in ${rateLimitResult.retryAfter} seconds.`,
      stats: {}
    };
  }
  try {
    const [
      usersSnap, matchesSnap, disputedSnap, activeSnap, codmSnap, efootballSnap, financesSnap,
      v1Snap, brSnap, ffaSnap, tourneySnap, resolvingSnap
    ] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("matches").count().get(),
      adminDb.collection("matches").where("status", "==", "DISPUTED").count().get(),
      adminDb.collection("matches").where("status", "in", ["WAITING", "READY", "PLAYING", "RESOLVING"]).count().get(),
      adminDb.collection("matches").where("game", "==", "CODM").count().get(),
      adminDb.collection("matches").where("game", "==", "EFOOTBALL").count().get(),
      adminDb.collection("stats").doc("platform_finances").get(),
      adminDb.collection("matches").where("format", "==", "1v1").count().get(),
      adminDb.collection("matches").where("format", "==", "br").count().get(),
      adminDb.collection("matches").where("format", "==", "ffa").count().get(),
      adminDb.collection("matches").where("format", "==", "tournament").count().get(),
      adminDb.collection("matches").where("status", "==", "RESOLVING").count().get(),
    ]);

    const finances = financesSnap.exists ? financesSnap.data() : { 
      totalDeposits: 0, totalPayouts: 0, totalPlatformCut: 0, totalWithdrawals: 0 
    };

    return {
      success: true,
      stats: {
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
        formatBR: brSnap.data().count,
        formatFFA: ffaSnap.data().count,
        formatTourney: tourneySnap.data().count,
        awaitingPayouts: resolvingSnap.data().count,
      },
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
    const tickets = snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() }));
    tickets.sort((a: any, b: any) => (a.createdAt || 0) - (b.createdAt || 0));

    return { success: true, tickets };
  } catch (error: any) {
    return { success: false, error: error.message, tickets: [] };
  }
}

export async function adminApproveWithdrawalAction(idToken: string, withdrawalId: string) {
  const adminUid = await getVerifiedAdminUid(idToken, true); // Admin only - financial operations
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET) throw new Error("Paystack secret key missing.");

  try {
    const wRef = adminDb.collection("withdrawals").doc(withdrawalId);
    
    // FETCH DATA ONCE OUTSIDE (For Paystack params)
    const initialSnap = await wRef.get();
    if (!initialSnap.exists || initialSnap.data()?.status !== "PENDING") {
      return { success: false, error: "Withdrawal invalid or already processed." };
    }
    const wData = initialSnap.data()!;
    const amountCoins = wData.amountCoins || 0;
    const fiatAmountKobo = (wData.fiatAmount || 0) * 100; // Paystack amount in kobo

    // ── STEP 1: Create Paystack Transfer Recipient ──────────────────────────
    // Paystack only supports resolving 0000000000 for standard banks (like GTBank 058) in Test Mode.
    // If the user uses the test account number, we temporarily coerce the bank_code to 058 to guarantee it passes.
    const isTestAccount = wData.accountNumber === "0000000000" || wData.accountNumber.includes("0000");
    const enforcedBankCode = isTestAccount ? "058" : (wData.bankCode || "058");
    const enforcedAccountNum = isTestAccount ? "0000000000" : wData.accountNumber;

    const recipientRes = await fetch("https://api.paystack.co/transferrecipient", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "nuban",
        name: wData.legalName,
        account_number: enforcedAccountNum,
        bank_code: enforcedBankCode,
        currency: "NGN",
      }),
    });

    const recipientJson = await recipientRes.json().catch(() => ({ status: false, message: "Network fetch failed natively." }));
    let recipientCode = "";

    if (!recipientJson.status) {
      // 🚨 ULTIMATE DEV FAILSAFE: If Paystack validation fails and we are using a Test Key, bypass it completely.
      if (PAYSTACK_SECRET.startsWith("sk_test")) {
        console.warn("[AdminAction] Paystack recipient validation failed in Test Mode. Mocking recipient to unblock.", recipientJson.message);
        recipientCode = "RCP_mock_dev_bypass";
      } else {
        console.error("[AdminAction] Paystack recipient creation failed:", recipientJson);
        return { success: false, error: `Bank validation failed: ${recipientJson.message || "Invalid account details."}` };
      }
    } else {
      recipientCode = recipientJson.data.recipient_code;
    }

    // ── STEP 2: Initiate Paystack Transfer ──────────────────────────────────
    let transferCode = "";
    let transferStatus = "pending";

    // If we mocked the recipient, we MUST mock the transfer too, because Paystack won't recognize 'RCP_mock_dev_bypass'
    if (recipientCode === "RCP_mock_dev_bypass") {
      console.warn("[AdminAction] Simulating Paystack Transfer to unblock Test Mode.");
      transferCode = `TRF_mock_${Math.random().toString(36).substring(7)}`;
      transferStatus = "success"; 
      // Simulated delay just for realism
      await new Promise(res => setTimeout(res, 800));
    } else {
      const transferRes = await fetch("https://api.paystack.co/transfer", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${PAYSTACK_SECRET}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          source: "balance",
          amount: fiatAmountKobo,
          recipient: recipientCode,
          reason: `CGameCore payout for ${wData.username} (${amountCoins} CR)`,
        }),
      });

      const transferJson = await transferRes.json();
      if (!transferJson.status) {
        if (PAYSTACK_SECRET.startsWith("sk_test")) {
           console.warn("[AdminAction] Transfer failed in Test Mode. Mocking transfer to unblock.", transferJson);
           transferCode = `TRF_mock_${Math.random().toString(36).substring(7)}`;
           transferStatus = "success";
        } else {
           console.error("[AdminAction] Paystack transfer initiation failed:", transferJson);
           return { success: false, error: `Transfer failed: ${transferJson.message || "Paystack rejected the transfer."}` };
        }
      } else {
        transferCode = transferJson.data.transfer_code;
        transferStatus = transferJson.data.status; // "pending" in test mode
      }
    }

    // ── STEP 3: Update Firestore atomically ─────────────────────────────────
    await adminDb.runTransaction(async (transaction) => {
      // C-06: RE-VERIFY STATUS INSIDE TRANSACTION
      const tSnap = await transaction.get(wRef);
      if (!tSnap.exists || tSnap.data()?.status !== "PENDING") {
        throw new Error("CONCURRENCY_ERROR: Withdrawal was already processed by another admin.");
      }

      // Mark withdrawal as APPROVED with transfer reference
      transaction.update(wRef, {
        status: "APPROVED",
        paystackTransferCode: transferCode,
        paystackRecipientCode: recipientCode,
        paystackStatus: transferStatus,
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: adminUid,
      });

      // Track total withdrawals globally
      if (amountCoins > 0) {
        const platformFinancesRef = adminDb.collection("stats").doc("platform_finances");
        transaction.set(platformFinancesRef, {
          totalWithdrawals: admin.firestore.FieldValue.increment(amountCoins),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
      }

      // Queue Notification for user (Using internal utility)
      await createNotificationInternal(
        wData.uid,
        "Withdrawal Sent!",
        `Your transfer of ₦${wData.fiatAmount} has been initiated via Paystack. Transfer ID: ${transferCode}. Funds arrive within 24 hours.`,
        "SYSTEM"
      );
    });

    return { success: true, transferCode };
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
export async function toggleSystemLockdownAction(idToken: string, active: boolean, reason: string = "") {
  const superAdminUid = await getVerifiedSuperAdminUid(idToken);
  
  try {
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
 * SUPER ADMIN: GET AUDIT LOGS
 */
export async function getAuditLogsAction(idToken: string, limit: number = 100) {
  await getVerifiedSuperAdminUid(idToken);
  try {
    const snap = await adminDb
      .collection("admin_audit_log")
      .orderBy("timestamp", "desc")
      .limit(limit)
      .get();
    return { success: true, logs: snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() })) };
  } catch (error: any) {
    return { success: false, error: error.message, logs: [] };
  }
}

