"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { getVerifiedUid } from "@/lib/server-utils";
import { sendTacticalEmail } from "@/lib/mail";
import { getSecurityAlertEmailTemplate } from "@/lib/mail-templates";

/**
 * Session context for token binding validation
 */
interface SessionContext {
  ipAddress: string;
  userAgent: string;
  createdAt: admin.firestore.FieldValue;
  expiresAt: admin.firestore.FieldValue;
}

// 🔒 [SECURITY] PHASE 7: Tactical session cache to prevent Quota Exhaustion
const sessionCache = new Map<string, { success: boolean, data: any, timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache

export async function validateSessionContextAction(
  idToken: string,
  clientIp?: string,
  clientUserAgent?: string
) {
  try {
    const uid = await getVerifiedUid(idToken);
    const now = Date.now();

    // 1. Check Memory Cache first (Saves 1 Firestore Read)
    const cached = sessionCache.get(uid);
    if (cached && (now - cached.timestamp < CACHE_TTL)) {
      return cached.data;
    }

    // 2. Get user profile (Check restrictions)
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return { success: false, error: "User profile not found" };
    }

    const userData = userSnap.data()!;
    if (userData.isBanned === true) {
      return { success: false, error: "Account is banned" };
    }

    // 3. Simple Session logic (Avoid constant writes)
    const sessionId = `session_${uid}_stable`;
    
    const result = {
      success: true,
      sessionId,
      message: "Session validated successfully"
    };

    // Update cache
    sessionCache.set(uid, { success: true, data: result, timestamp: now });

    return result;

  } catch (error: any) {
    console.error("[SessionValidation] Error:", error);
    return { success: false, error: error.message || "Session validation failed" };
  }
}

/**
 * SERVER ACTION: Update session activity
 * Call this periodically to keep sessions alive
 */
export async function updateSessionActivityAction(
  idToken: string,
  sessionId: string
) {
  try {
    // 1. If it's our new stable session, bypass the DB hit entirely
    if (sessionId.endsWith("_stable")) {
      return { success: true };
    }

    const uid = await getVerifiedUid(idToken);

    const sessionRef = adminDb.collection("user_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return { success: false, error: "Session not found" };
    }

    const sessionData = sessionSnap.data()!;
    if (sessionData.uid !== uid) {
      return { success: false, error: "Session does not belong to user" };
    }

    // Check if session is expired
    const expiresAt = sessionData.expiresAt.toDate().getTime();
    if (Date.now() > expiresAt) {
      await sessionRef.delete();
      return { success: false, error: "Session expired" };
    }

    // Update last activity
    await sessionRef.update({
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };

  } catch (error: any) {
    console.error("[SessionActivity] Error:", error);
    return { success: false, error: error.message || "Failed to update session" };
  }
}