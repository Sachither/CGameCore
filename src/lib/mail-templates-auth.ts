/**
 * Password Reset Email Template
 */
export function getPasswordResetEmailTemplate(resetLink: string, expiryMinutes: number = 60) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #FF3B30; max-width: 600px; margin: auto;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 10px;">Password Reset Request</h1>
      <p style="color: #FF3B30; font-size: 12px; font-weight: 600; margin-bottom: 30px;">SECURITY ALERT</p>
      
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        You requested to reset your CGame password. Click the button below to securely reset your password.
      </p>
      
      <p style="color: #888888; font-size: 13px; margin-bottom: 30px;">
        ⏱️ This link expires in <strong>${expiryMinutes} minutes</strong>. If you didn't request this, ignore this email.
      </p>
      
      <a href="${resetLink}" style="display: inline-block; background-color: #FF3B30; color: #ffffff; text-decoration: none; padding: 14px 32px; font-weight: 700; font-size: 14px; border-radius: 4px; letter-spacing: 0.5px;">
        RESET PASSWORD
      </a>
      
      <p style="color: #666666; font-size: 12px; margin-top: 40px; margin-bottom: 30px; line-height: 1.6;">
        Or paste this link in your browser:<br/>
        <span style="word-break: break-all; color: #888888;">
          <code>${resetLink}</code>
        </span>
      </p>
      
      <div style="background: #111111; padding: 15px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px;">
        <p style="margin: 0; font-size: 12px; color: #FF3B30; font-weight: 600; margin-bottom: 8px;">⚠️ SECURITY NOTICE</p>
        <ul style="margin: 0; padding-left: 20px; font-size: 12px; color: #888888;">
          <li>Never share your password reset link</li>
          <li>CGame staff will never ask for your password</li>
          <li>Use only official CGame emails</li>
        </ul>
      </div>
      
      <div style="border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 11px; color: #666666; margin: 0 0 10px 0;">
          This is an automated message from CGame. Please do not reply to this email.
        </p>
        <p style="font-size: 11px; color: #666666; margin: 0;">
          <a href="https://cgamecore.online/privacy" style="color: #888888; text-decoration: underline;">Privacy Policy</a> • 
          <a href="https://cgamecore.online/terms" style="color: #888888; text-decoration: underline;">Terms</a> • 
          <a href="https://cgamecore.online/support" style="color: #888888; text-decoration: underline;">Support</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * Fallback text-only version for email clients that don't support HTML
 */
export function getPasswordResetEmailText(resetLink: string, expiryMinutes: number = 60) {
  return `
Password Reset Request
=======================

You requested to reset your CGame password.

Click the link below to reset your password (expires in ${expiryMinutes} minutes):
${resetLink}

SECURITY NOTICE:
- Never share your password reset link
- CGame staff will never ask for your password
- Use only official CGame emails

If you didn't request this, please ignore this email.

---
CGame Intelligence Command System
  `;
}
