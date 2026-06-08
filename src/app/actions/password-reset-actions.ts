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
      console.error(`[PasswordReset] Validation error:`, emailErr);
      return { success: false, error: emailErr };
    }

    const trimmedEmail = email.trim().toLowerCase();
    console.log(`[PasswordReset] Processing reset request for: ${trimmedEmail}`);

    // 1. Check if user exists in Firebase Auth
    let userRecord;
    try {
      console.log(`[PasswordReset] Looking up user in Firebase Auth...`);
      userRecord = await adminAuth.getUserByEmail(trimmedEmail);
      console.log(`[PasswordReset] ✅ Found user: ${userRecord.uid}`);
    } catch (err: any) {
      console.error(`[PasswordReset] Firebase lookup error:`, {
        code: err.code,
        message: err.message
      });
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
      console.log(`[PasswordReset] Generating reset link...`);
      resetLink = await adminAuth.generatePasswordResetLink(trimmedEmail);
      console.log(`[PasswordReset] ✅ Generated reset link (${resetLink.length} chars)`);
    } catch (err: any) {
      console.error(`[PasswordReset] Failed to generate reset link:`, {
        code: err.code,
        message: err.message
      });
      return { 
        success: false, 
        error: "Unable to generate reset link. Please try again later or contact support." 
      };
    }

    // 3. Send email via Resend with custom template
    try {
      console.log(`[PasswordReset] Building email template...`);
      const htmlTemplate = getPasswordResetEmailTemplate(resetLink, 60);
      const textTemplate = getPasswordResetEmailText(resetLink, 60);

      console.log(`[PasswordReset] Dispatching email via Resend...`);
      const mailResult = await sendTacticalEmail(
        trimmedEmail,
        "🔐 CGame Password Reset Request",
        htmlTemplate
      );

      if (!mailResult.success) {
        console.error(`[PasswordReset] Email send failed:`, {
          error: mailResult.error,
          code: (mailResult as any).code
        });
        return { 
          success: false, 
          error: `Mail service error: ${mailResult.error}` 
        };
      }

      console.log(`[PasswordReset] ✅ Email sent successfully`);
    } catch (emailErr: any) {
      console.error(`[PasswordReset] Email system exception:`, {
        message: emailErr?.message,
        stack: emailErr?.stack
      });
      return { 
        success: false, 
        error: "Email service encountered an error. Please try again later." 
      };
    }

    // 4. Log event in Firestore for audit trail
    try {
      console.log(`[PasswordReset] Logging audit entry...`);
      const auditRef = adminDb.collection("audit_logs").doc();
      await auditRef.set({
        event: "password_reset_requested",
        email: trimmedEmail,
        uid: userRecord.uid,
        timestamp: new Date(),
        status: "email_sent"
      });
      console.log(`[PasswordReset] ✅ Audit logged`);
    } catch (auditErr) {
      console.warn(`[PasswordReset] Failed to log audit entry (non-fatal):`, auditErr);
      // Don't fail the operation if audit logging fails
    }

    console.log(`[PasswordReset] ✅ COMPLETE: Password reset email sent to ${trimmedEmail}`);
    return { 
      success: true, 
      message: "Password reset email has been sent. Check your inbox for the secure link." 
    };

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
