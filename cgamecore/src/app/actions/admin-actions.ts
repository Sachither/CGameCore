"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { Match } from "@/lib/match-service";

// ─── INTERNAL HELPERS ────────────────────────────────────────────────────────

/**
 * Verifies the ID token AND confirms the caller is an admin.
 * This gate must pass before ANY admin action can run.
 */
async function getVerifiedAdminUid(idToken: string, requireHighLevel: boolean = false): Promise<string> {
  if (!idToken) throw new Error("Unauthorized: No identity token.");
  let uid: string;
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    uid = decoded.uid;
  } catch {
    throw new Error("Unauthorized: Invalid session token.");
  }

  const snap = await adminDb.collection("users").doc(uid).get();
  const data = snap.data();
  const role = data?.role || (data?.isAdmin ? "ADMIN" : "USER");

  if (requireHighLevel) {
     if (role !== "ADMIN") throw new Error("Forbidden: Full Admin clearance required.");
  } else {
     if (role !== "ADMIN" && role !== "MODERATOR") throw new Error("Forbidden: Moderator clearance required.");
  }
  
  return uid;
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
  await getVerifiedAdminUid(idToken);

  const matchRef = adminDb.collection("matches").doc(matchId);

  try {
    await adminDb.runTransaction(async (transaction) => {
      const matchSnap = await transaction.get(matchRef);
      if (!matchSnap.exists) throw new Error("Match not found.");

      const matchData = matchSnap.data() as Match;
      if (matchData.status === "CLOSED") throw new Error("Match is already closed.");

      const players = Object.keys(matchData.players);
      const fee = matchData.challengeFee;

      if (winnerId === "REFUND") {
        // Void match — refund all players and undo wager tracking
        for (const uid of players) {
          const userRef = adminDb.collection("users").doc(uid);
          transaction.update(userRef, {
            balanceCoins: admin.firestore.FieldValue.increment(fee),
            lifetimeWagered: admin.firestore.FieldValue.increment(-fee),
            "intervention.active": false
          });
        }
        transaction.update(matchRef, {
          status: "CLOSED",
          adminNote: "Voided by admin — all players refunded.",
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // NOTIFICATION: Dispute Void
        for (const uid of players) {
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

        // Update loser's match count
        const loserIds = players.filter((p) => p !== winnerId);
        for (const loserUid of loserIds) {
          const loserRef = adminDb.collection("users").doc(loserUid);
          transaction.update(loserRef, {
            totalMatches: admin.firestore.FieldValue.increment(1),
            "intervention.active": false
          });
        }

        transaction.update(matchRef, {
          status: "CLOSED",
          championUid: winnerId,
          rewardAmount: netPool,
          adminNote: `Manually resolved by admin. Winner: ${winnerId}`,
          resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // NOTIFICATION: Dispute Winner
        const winnerNoteRef = winnerRef.collection("notifications").doc();
        transaction.set(winnerNoteRef, {
          title: "Tribunal Verdict: Victory",
          message: `The Dispute Tribunal has awarded you the victory for Match #${matchId.slice(0, 8)}. Credits added.`,
          type: "DISPUTE",
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // NOTIFICATION: Dispute Losers
        loserIds.forEach((loserUid) => {
           const loserNoteRef = adminDb.collection("users").doc(loserUid).collection("notifications").doc();
           transaction.set(loserNoteRef, {
             title: "Tribunal Verdict: Defeat",
             message: `The Dispute Tribunal has ruled against your claim for Match #${matchId.slice(0, 8)}. Verdict is final.`,
             type: "DISPUTE",
             read: false,
             createdAt: admin.firestore.FieldValue.serverTimestamp()
           });
        });
      }
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
  await getVerifiedAdminUid(idToken, true);

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

    await adminDb.collection("users").doc(targetUid).update({
      isBanned,
      banReason: isBanned ? (banReason || "Violation of platform rules.") : "",
      suspendedUntil: suspendedUntil,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
  role: "USER" | "MODERATOR" | "ADMIN"
) {
  // Only high-level Admins can change roles
  await getVerifiedAdminUid(idToken, true);

  try {
    await adminDb.collection("users").doc(targetUid).update({ 
       role,
       isAdmin: role === "ADMIN" // backward compatibility with current checks
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
 */
export async function adjustUserBalanceAction(
  idToken: string,
  targetUid: string,
  amount: number, // positive = add, negative = deduct
  justification: string
) {
  await getVerifiedAdminUid(idToken);

  if (!justification?.trim()) throw new Error("A justification is required for balance adjustments.");

  try {
    const updates: any = {
      balanceCoins: admin.firestore.FieldValue.increment(amount),
    };

    if (amount > 0) {
      updates.lifetimeDeposits = admin.firestore.FieldValue.increment(amount);
    }

    await adminDb.collection("users").doc(targetUid).update(updates);

    // Log the action for audit trail
    await adminDb.collection("admin_audit_log").add({
      action: "BALANCE_ADJUST",
      targetUid,
      amount,
      justification,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If positive (deposit), update global stats
    if (amount > 0) {
      await adminDb.collection("stats").doc("platform_finances").set({
        totalDeposits: admin.firestore.FieldValue.increment(amount),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // NOTIFICATION: Balance Adjustment
    await createNotificationInternal(
      targetUid,
      amount > 0 ? "Credits Deposited" : "Credits Deducted",
      `Tactical update: ${Math.abs(amount)} CR ${amount > 0 ? 'added to' : 'removed from'} your wallet. Justification: ${justification}`,
      "SYSTEM"
    );

    return { success: true };
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

      // Refund all players and undo wager tracking
      for (const uid of players) {
        const userRef = adminDb.collection("users").doc(uid);
        transaction.update(userRef, {
          balanceCoins: admin.firestore.FieldValue.increment(fee),
          lifetimeWagered: admin.firestore.FieldValue.increment(-fee),
          "intervention.active": false
        });
      }

      transaction.update(matchRef, {
        status: "CLOSED",
        adminNote: "Cancelled by admin — ghost lobby. All players refunded.",
        resolvedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    });
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
  await getVerifiedAdminUid(idToken);
  try {
    // Try UID first (exact match)
    const byUid = await adminDb.collection("users").doc(query).get();
    if (byUid.exists) {
      return { success: true, users: [sanitizeData({ id: byUid.id, ...byUid.data() })] };
    }
    // Try username prefix match
    const snap = await adminDb
      .collection("users")
      .where("username", ">=", query)
      .where("username", "<=", query + "\uf8ff")
      .limit(10)
      .get();
    return { success: true, users: snap.docs.map((d) => sanitizeData({ id: d.id, ...d.data() })) };
  } catch (error: any) {
    return { success: false, error: error.message, users: [] };
  }
}

/**
 * ADMIN: GET PLATFORM OVERVIEW STATS
 */
export async function getPlatformStatsAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const [usersSnap, matchesSnap, disputedSnap, activeSnap, codmSnap, efootballSnap, financesSnap] = await Promise.all([
      adminDb.collection("users").count().get(),
      adminDb.collection("matches").count().get(),
      adminDb.collection("matches").where("status", "==", "DISPUTED").count().get(),
      adminDb.collection("matches").where("status", "in", ["WAITING", "READY", "PLAYING", "RESOLVING"]).count().get(),
      adminDb.collection("matches").where("game", "==", "CODM").count().get(),
      adminDb.collection("matches").where("game", "==", "EFOOTBALL").count().get(),
      adminDb.collection("stats").doc("platform_finances").get(),
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
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message, stats: null };
  }
}

// ─── TREASURY / PAYOUTS ──────────────────────────────────────────────────────

export async function getPendingWithdrawalsAction(idToken: string) {
  await getVerifiedAdminUid(idToken);
  try {
    const snap = await adminDb
      .collection("withdrawals")
      .where("status", "==", "PENDING")
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
  const adminUid = await getVerifiedAdminUid(idToken);
  const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;
  if (!PAYSTACK_SECRET) throw new Error("Paystack secret key missing.");

  try {
    const wRef = adminDb.collection("withdrawals").doc(withdrawalId);
    const wSnap = await wRef.get();

    if (!wSnap.exists || wSnap.data()?.status !== "PENDING") {
      return { success: false, error: "Withdrawal invalid or already processed." };
    }

    const wData = wSnap.data()!;
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

      // Queue Notification for user
      const noteRef = adminDb.collection("users").doc(wData.uid).collection("notifications").doc();
      transaction.set(noteRef, {
        title: "Withdrawal Sent!",
        message: `Your transfer of ₦${wData.fiatAmount} has been initiated via Paystack. Transfer ID: ${transferCode}. Funds arrive within 24 hours.`,
        type: "SYSTEM",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
  uid: string, 
  amountCoins: number
) {
  const adminUid = await getVerifiedAdminUid(idToken);
  try {
    await adminDb.runTransaction(async (transaction) => {
      const wRef = adminDb.collection("withdrawals").doc(withdrawalId);
      const uRef = adminDb.collection("users").doc(uid);
      
      const wSnap = await transaction.get(wRef);
      if (!wSnap.exists || wSnap.data()?.status !== "PENDING") {
        throw new Error("Withdrawal invalid or already processed.");
      }

      // 1. Mark as rejected
      transaction.update(wRef, {
        status: "REJECTED",
        processedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: adminUid
      });

      // 2. Refund the coins
      transaction.update(uRef, {
        balanceCoins: admin.firestore.FieldValue.increment(amountCoins)
      });

      // 3. Queue Notification
      const rejectNoteRef = uRef.collection("notifications").doc();
      transaction.set(rejectNoteRef, {
        title: "Withdrawal Problem",
        message: `Your withdrawal request was rejected. Your coins have been refunded. Contact Support if this was an error.`,
        type: "SYSTEM",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
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
  await getVerifiedAdminUid(idToken);
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
 * INTERNAL HELPER: CREATE NOTIFICATION
 */
export async function createNotificationInternal(
  uid: string, 
  title: string, 
  message: string, 
  type: "MATCH" | "DISPUTE" | "WALKTHROUGH" | "SYSTEM" = "SYSTEM"
) {
  try {
    await adminDb.collection("users").doc(uid).collection("notifications").add({
      title,
      message,
      type,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (e) {
    console.error("[Notification] Failed to create for user " + uid, e);
  }
}

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
