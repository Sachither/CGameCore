"use server";

import { adminAuth } from "@/lib/firebase-admin";
import { checkPaymentStatusAction } from "@/lib/payment-monitor";

/**
 * SERVER ACTION: Check payment status
 * Called when user suspects their payment didn't go through
 */
export async function getPaymentStatusAction(
  idToken: string,
  reference: string
) {
  if (!idToken || !reference) {
    return { success: false, error: "Missing authentication or reference" };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    return await checkPaymentStatusAction(uid, reference);
  } catch (error: any) {
    console.error("[PaymentStatus] Auth error:", error);
    return { success: false, error: "Authentication failed" };
  }
}
