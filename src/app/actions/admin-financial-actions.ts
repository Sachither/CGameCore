"use server";
import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { getVerifiedSuperAdminUid } from "@/lib/server-utils";
import { verifyAdminSecurityPin } from "@/lib/admin-security";

/**
 * ADMIN: RESET PLATFORM FINANCIAL STATS
 * Zeros out the aggregate aggregate financial document.
 * 🔒 Requires SUPER_ADMIN access + Security PIN.
 */
export async function resetPlatformFinancesAction(idToken: string, pin: string) {
  const adminUid = await getVerifiedSuperAdminUid(idToken);

  try {
    // 🔒 PIN Authorization Gate
    const auth = await verifyAdminSecurityPin(adminUid, pin);
    if (!auth.success) return auth;

    const statsRef = adminDb.collection("stats").doc("platform_finances");
    
    await statsRef.set({
      totalDeposits: 0,
      totalPayouts: 0,
      totalPlatformCut: 0,
      totalWithdrawals: 0,
      totalAdjustments: 0,
      totalAdjustedAmount: 0,
      lastResetAt: admin.firestore.FieldValue.serverTimestamp(),
      resetBy: adminUid
    });

    // Log the reset
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "FINANCIAL_RESET",
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: {
        reason: "Clean slate requested by operator"
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("[AdminFinancial] resetStats error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: PURGE TRANSACTION LEDGER
 * Deletes all documents in the 'transactions' collection.
 * 🔒 Requires SUPER_ADMIN access + Security PIN.
 */
export async function purgeFinancialLogsAction(idToken: string, pin: string) {
  const adminUid = await getVerifiedSuperAdminUid(idToken);

  try {
    // 🔒 PIN Authorization Gate
    const auth = await verifyAdminSecurityPin(adminUid, pin);
    if (!auth.success) return auth;

    const transactionsCollection = adminDb.collection("transactions");
    const snapshot = await transactionsCollection.limit(500).get();
    
    if (snapshot.empty) {
      return { success: true, count: 0 };
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    // Log the purge
    const auditRef = adminDb.collection("admin_audit_log").doc();
    await auditRef.set({
      action: "TRANSACTION_PURGE",
      adminUid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      count: snapshot.size
    });

    return { success: true, count: snapshot.size };
  } catch (error: any) {
    console.error("[AdminFinancial] purgeLogs error:", error);
    return { success: false, error: error.message };
  }
}
