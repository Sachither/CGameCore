/**
 * Rate Limiter Library
 *
 * Implements distributed rate limiting using Firestore for admin operations.
 * Prevents abuse of admin search and audit functions.
 *
 * SECURITY FIXES:
 * - PHASE 4: Rate limiting on admin query functions
 */

import { adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

/**
 * Check rate limit for a given key and window
 * Uses Firestore for distributed rate limiting across server instances
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowResetAt = now + windowMs;

  try {
    const rateLimitRef = adminDb.collection("rate_limits").doc(key);

    // Use Firestore transaction for atomic updates
    const result = await adminDb.runTransaction(async (transaction) => {
      const rateLimitSnap = await transaction.get(rateLimitRef);

      if (!rateLimitSnap.exists) {
        // First request in window
        await transaction.set(rateLimitRef, {
          count: 1,
          windowResetAt,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetTime: windowResetAt,
        };
      }

      const data = rateLimitSnap.data()!;
      const currentCount = data.count || 0;
      const resetAt = data.windowResetAt || 0;

      // Check if window has expired
      if (now > resetAt) {
        // Reset window
        await transaction.set(rateLimitRef, {
          count: 1,
          windowResetAt,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        return {
          allowed: true,
          remaining: maxRequests - 1,
          resetTime: windowResetAt,
        };
      }

      // Window still active
      if (currentCount >= maxRequests) {
        // Rate limited
        return {
          allowed: false,
          remaining: 0,
          resetTime: resetAt,
          retryAfter: Math.ceil((resetAt - now) / 1000),
        };
      }

      // Increment counter
      await transaction.update(rateLimitRef, {
        count: admin.firestore.FieldValue.increment(1),
      });

      return {
        allowed: true,
        remaining: maxRequests - currentCount - 1,
        resetTime: resetAt,
      };
    });

    return result;
  } catch (error) {
    // On error, allow request but log it
    console.error("[RateLimit] Error checking rate limit:", error);
    return {
      allowed: true, // Fail open to avoid blocking legitimate requests
      remaining: maxRequests - 1,
      resetTime: now + windowMs,
    };
  }
}

/**
 * Clean up expired rate limit documents
 * Should be called periodically by a cleanup job
 */
export async function cleanupExpiredRateLimits(): Promise<void> {
  try {
    const now = Date.now();
    const expiredQuery = adminDb
      .collection("rate_limits")
      .where("windowResetAt", "<", now);

    const expiredDocs = await expiredQuery.get();

    const batch = adminDb.batch();
    expiredDocs.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    console.log(`[RateLimit] Cleaned up ${expiredDocs.size} expired rate limit entries`);
  } catch (error) {
    console.error("[RateLimit] Error cleaning up expired entries:", error);
  }
}