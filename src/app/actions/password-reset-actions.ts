"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { sendTacticalEmail } from "@/lib/mail";
import { getPasswordResetEmailTemplate, getPasswordResetEmailText } from "@/lib/mail-templates-auth";
import { validate } from "@/lib/validation-utils";

/**
 * SERVER ACTION: Send Password Reset Email
 * 
 * Generates a Firebase password reset link and sends it via custom email system (Resend)
 * instead of using Firebase's built-in email which requires configuration.
 */
export async function sendPasswordResetEmailAction(email: string): Promise<{
  success: boolean;
  error?: string;
  message?: string;
}> {
  try {
    // Validate email format
    const emailErr = validate("EMAIL", email);
    if (emailErr) {
      return { success: false, error: emailErr };
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 1. Check if user exists in Firebase Auth
    let userRecord;
    try {
      userRecord = await adminAuth.getUserByEmail(trimmedEmail);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        // For security, return generic message (don't reveal if email exists)
        console.log(`[PasswordReset] User not found for email: ${trimmedEmail}`);
        return { 
          success: true, 
          message: "If an account exists with this email, a reset link will be sent." 
        };
      }
      throw err;
    }

    // 2. Generate password reset link using Firebase Admin SDK
    let resetLink: string;
    try {
      resetLink = await adminAuth.generatePasswordResetLink(trimmedEmail);
      console.log(`[PasswordReset] Generated reset link for ${trimmedEmail}`);
    } catch (err: any) {
      console.error(`[PasswordReset] Failed to generate reset link:`, err.message);
      return { 
        success: false, 
        error: "Unable to generate reset link. Please try again later or contact support." 
      };
    }

    // 3. Send email via Resend with custom template
    try {
      const htmlTemplate = getPasswordResetEmailTemplate(resetLink, 60);
      const textTemplate = getPasswordResetEmailText(resetLink, 60);

      const mailResult = await sendTacticalEmail(
        trimmedEmail,
        "🔐 CGame Password Reset Request",
        htmlTemplate
      );

      if (!mailResult.success) {
        console.error(`[PasswordReset] Email send failed:`, mailResult.error);
        return { 
          success: false, 
          error: "Failed to send email. Please try again later." 
        };
      }

      console.log(`[PasswordReset] ✅ Password reset email sent to ${trimmedEmail}`);

      // 4. Log event in Firestore for audit trail
      try {
        const auditRef = adminDb.collection("audit_logs").doc();
        await auditRef.set({
          event: "password_reset_requested",
          email: trimmedEmail,
          uid: userRecord.uid,
          timestamp: new Date(),
          status: "email_sent"
        });
      } catch (auditErr) {
        console.warn(`[PasswordReset] Failed to log audit entry:`, auditErr);
        // Don't fail the operation if audit logging fails
      }

      return { 
        success: true, 
        message: "Password reset email has been sent. Check your inbox for the secure link." 
      };
    } catch (emailErr: any) {
      console.error(`[PasswordReset] Email system error:`, emailErr.message);
      return { 
        success: false, 
        error: "Email service temporarily unavailable. Please try again in a few moments." 
      };
    }

  } catch (error: any) {
    console.error("[PasswordReset] Critical error:", {
      message: error?.message,
      code: error?.code,
      stack: error?.stack
    });
    
    return { 
      success: false, 
      error: "An error occurred while processing your request. Please contact support." 
    };
  }
}

/**
 * Verify password reset code (used in reset form)
 * This is client-side, so imported from firebase/auth, but we expose it for testing
 */
export async function verifyPasswordResetCodeAction(oobCode: string): Promise<{
  valid: boolean;
  email?: string;
  error?: string;
}> {
  try {
    // This should be done on client-side, but providing server version for flexibility
    // Import on client: import { verifyPasswordResetCode } from 'firebase/auth';
    
    return {
      valid: false,
      error: "Use client-side verifyPasswordResetCode from firebase/auth"
    };
  } catch (error: any) {
    return {
      valid: false,
      error: error?.message || "Failed to verify reset code"
    };
  }
}
