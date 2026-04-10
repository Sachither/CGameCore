import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";

/**
 * AUDIT LOGGING INFRASTRUCTURE
 * Centralized logging for all security-sensitive operations
 */

interface AuditLog {
  timestamp: admin.firestore.Timestamp;
  uid: string;
  action: string;
  targetUid?: string;
  resource?: string;
  resourceId?: string;
  changes?: Record<string, any>;
  justification?: string;
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAdminAction(
  transaction: admin.firestore.Transaction | null,
  uid: string,
  action: string,
  targetUid: string | null,
  changes: Record<string, any>,
  justification?: string,
  result: 'SUCCESS' | 'FAILED' | 'BLOCKED' = 'SUCCESS',
  reason?: string
) {
  try {
    const logRef = adminDb.collection("admin_audit_log").doc();
    const logEntry: AuditLog = {
      timestamp: admin.firestore.FieldValue.serverTimestamp() as any,
      uid,
      action,
      targetUid: targetUid || undefined,
      changes,
      justification,
      result,
      reason
    };

    if (transaction) {
      transaction.set(logRef, logEntry);
    } else {
      await logRef.set(logEntry);
    }

    console.log(`[AUDIT] ${action} by ${uid}: ${result}${reason ? ` (${reason})` : ""}`);
  } catch (err) {
    console.error("[AUDIT LOG ERROR]", err);
  }
}

export async function logFinancialChange(
  transaction: admin.firestore.Transaction | null,
  uid: string,
  type: 'DEPOSIT' | 'WITHDRAWAL' | 'ADJUSTMENT' | 'REFUND' | 'PRIZE',
  amount: number,
  category: string,
  status: 'PENDING' | 'COMPLETED' | 'FAILED',
  metadata?: Record<string, any>
) {
  try {
    const logRef = adminDb.collection("financial_audit_log").doc();
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      uid,
      type,
      amount,
      category,
      status,
      metadata
    };

    if (transaction) {
      transaction.set(logRef, logEntry);
    } else {
      await logRef.set(logEntry);
    }

    console.log(`[FINANCIAL] ${type} for ${uid}: ${amount} CR (${status})`);
  } catch (err) {
    console.error("[FINANCIAL LOG ERROR]", err);
  }
}

export async function logAuthError(
  uid: string,
  action: string,
  reason: string
) {
  try {
    const logRef = adminDb.collection("auth_error_log").doc();
    await logRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      uid,
      action,
      reason,
      severity: 'ERROR'
    });

    console.error(`[AUTH ERROR] ${uid} attempted ${action}: ${reason}`);
  } catch (err) {
    console.error("[AUTH LOG ERROR]", err);
  }
}

export async function logMatchStateChange(
  transaction: admin.firestore.Transaction | null,
  matchId: string,
  previousStatus: string,
  newStatus: string,
  details?: Record<string, any>
) {
  try {
    const logRef = adminDb.collection("match_state_log").doc();
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      matchId,
      previousStatus,
      newStatus,
      details
    };

    if (transaction) {
      transaction.set(logRef, logEntry);
    } else {
      await logRef.set(logEntry);
    }

    console.log(`[MATCH STATE] ${matchId}: ${previousStatus} → ${newStatus}`);
  } catch (err) {
    console.error("[MATCH LOG ERROR]", err);
  }
}

export async function logTournamentProgression(
  transaction: admin.firestore.Transaction | null,
  circuitId: string,
  round: string,
  action: string,
  details?: Record<string, any>
) {
  try {
    const logRef = adminDb.collection("tournament_progression_log").doc();
    const logEntry = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      circuitId,
      round,
      action,
      details
    };

    if (transaction) {
      transaction.set(logRef, logEntry);
    } else {
      await logRef.set(logEntry);
    }

    console.log(`[TOURNAMENT] Circuit ${circuitId} ${round}: ${action}`);
  } catch (err) {
    console.error("[TOURNAMENT LOG ERROR]", err);
  }
}

/**
 * QUERY HELPERS - For compliance and monitoring
 */
export async function getAdminActionLog(adminUid: string, days: number = 30) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await adminDb
    .collection("admin_audit_log")
    .where("uid", "==", adminUid)
    .where("timestamp", ">=", cutoffDate)
    .orderBy("timestamp", "desc")
    .get();
}

export async function getFinancialAnomalies(days: number = 7) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return await adminDb
    .collection("financial_audit_log")
    .where("timestamp", ">=", cutoffDate)
    .where("status", "==", "FAILED")
    .orderBy("timestamp", "desc")
    .get();
}

export async function getUserAuditTrail(uid: string, days: number = 90) {
  const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const financial = await adminDb
    .collection("financial_audit_log")
    .where("uid", "==", uid)
    .where("timestamp", ">=", cutoffDate)
    .orderBy("timestamp", "desc")
    .get();

  const matches = await adminDb
    .collection("match_state_log")
    .orderBy("timestamp", "desc")
    .limit(100)
    .get();

  return { financial: financial.docs, matches: matches.docs };
}
