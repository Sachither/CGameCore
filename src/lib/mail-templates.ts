/**
 * TEMPLATE: Welcome New User
 * Clean, professional welcome email.
 */
export function getWelcomeEmailTemplate(username: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 20px;">Welcome to CGame, ${username}</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
        Your account has been successfully registered. You can now join tournaments, compete in matches, and withdraw your earnings directly to your bank account.
      </p>
      <a href="https://cgamecore.online/dashboard" style="display: inline-block; background-color: #00FF66; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Go to Dashboard
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
        <p style="font-size: 12px; color: #666666;">
          <a href="https://cgamecore.online/unsubscribe" style="color: #888888; text-decoration: underline;">Unsubscribe from emails</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Partner Summon
 * Professional notification for dispute resolution.
 */
export function getSummonEmailTemplate(username: string, matchId: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Review Required: Match Dispute</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
        Hello ${username}, a dispute has been opened for Match #${matchId.slice(-6)}. As the tournament host, your review is required to resolve this match.
      </p>
      <a href="https://cgamecore.online/match/${matchId}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Review Match
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Extraction Successful (Withdrawal)
 */
export function getExtractionEmailTemplate(username: string, amount: string, method: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Withdrawal Processed</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, your withdrawal request has been successfully processed.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px;">
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">Amount</p>
        <p style="margin: 0 0 15px 0; font-size: 20px; font-weight: 600; color: #ffffff;">${amount}</p>
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">Method</p>
        <p style="margin: 0; font-size: 15px; font-weight: 500; color: #cccccc;">${method}</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Match Deployment (Match Starting)
 */
export function getMatchStartEmailTemplate(username: string, matchId: string, game: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Your Match is Ready</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, your ${game} match is now ready. Please join the lobby to begin playing.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px; text-align: center;">
        <p style="margin: 0; font-size: 18px; font-weight: 600;">Match #${matchId.slice(-6)}</p>
      </div>
      <a href="https://cgamecore.online/match/${matchId}" style="display: inline-block; background-color: #00FF66; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Go to Match
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Security Breach (Login Alert)
 */
export function getSecurityAlertEmailTemplate(username: string, ip: string, device: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">New Login Detected</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, we noticed a new login to your account. If this was you, no further action is required.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px;">
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">IP Address</p>
        <p style="margin: 0 0 15px 0; font-size: 15px; color: #ffffff;">${ip}</p>
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">Device</p>
        <p style="margin: 0; font-size: 15px; color: #ffffff;">${device}</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          If you did not authorize this login, please change your password immediately.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Retention (Skill Reactivation)
 */
export function getRetentionEmailTemplate(username: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">We miss you at CGame</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, it's been a while since your last match. Log in today to claim a special return bonus.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px; text-align: center;">
        <p style="margin: 0 0 5px 0; font-size: 18px; font-weight: 600; color: #ffffff;">50 Bonus Coins</p>
        <p style="margin: 0; font-size: 13px; color: #888888;">Available upon your next login.</p>
      </div>
      <a href="https://cgamecore.online/dashboard" style="display: inline-block; background-color: #00FF66; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Claim Bonus
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          <a href="https://cgamecore.online/unsubscribe" style="color: #888888; text-decoration: underline;">Unsubscribe from promotional emails</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Partner Contract Induction
 */
export function getPartnerUpgradeEmailTemplate(username: string, duration: string, referralCode: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Partner Account Upgraded</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, your account has been upgraded to Partner status for the next ${duration}.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px; text-align: center;">
        <p style="margin: 0 0 10px 0; font-size: 13px; color: #888888;">Your Referral Code</p>
        <p style="margin: 0; font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: 2px;">${referralCode}</p>
      </div>
      <a href="https://cgamecore.online/dashboard/partner" style="display: inline-block; background-color: #00FF66; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Access Partner Portal
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Partner Contract Revocation
 */
export function getPartnerRevokedEmailTemplate(username: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Partner Status Update</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, your Partner status has expired or been revoked.
      </p>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
        Your account has been returned to standard access. If you believe this is an error, please contact support.
      </p>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Tactical Ping (Opponent Alert)
 */
export function getPingEmailTemplate(username: string, pingerName: string, matchId: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Your opponent is waiting</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello ${username}, your opponent <strong>${pingerName}</strong> is waiting for you in Match #${matchId.slice(-6)}.
      </p>
      <a href="https://cgamecore.online/match/${matchId}" style="display: inline-block; background-color: #ffffff; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Join Match Now
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Promo Tournament Started
 */
export function getPromoStartedEmailTemplate(promoTitle: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #00FF66; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px;">Tournament Started</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 30px;">
        Hello player, the <strong>${promoTitle}</strong> tournament has officially begun! Log in now to view the bracket and find your first match.
      </p>
      <a href="https://cgamecore.online/dashboard" style="display: inline-block; background-color: #00FF66; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        View Tournament Bracket
      </a>
      <div style="margin-top: 40px; border-top: 1px solid #222222; padding-top: 20px;">
        <p style="font-size: 12px; color: #666666; margin-bottom: 5px;">
          This is an automated message from CGame. Please do not reply.
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Admin Dispute Alert
 * Sent to support@cgamecore.online when a new dispute is opened.
 */
export function getAdminDisputeAlertEmailTemplate(matchId: string, reason: string, triggeredBy: string) {
  return `
    <div style="background-color: #0a0a0a; color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 40px; border: 1px solid #222222; border-top: 3px solid #f59e0b; max-width: 600px; margin: auto;">
      <h1 style="font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #f59e0b;">ACTION REQUIRED: New Dispute</h1>
      <p style="color: #cccccc; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        A new dispute has been triggered for Match <strong>#${matchId.slice(-6)}</strong>.
      </p>
      <div style="background: #111111; padding: 20px; border-radius: 4px; border: 1px solid #222222; margin-bottom: 30px;">
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">Triggered By User ID</p>
        <p style="margin: 0 0 15px 0; font-size: 14px; color: #ffffff;">${triggeredBy}</p>
        <p style="margin: 0 0 5px 0; font-size: 13px; color: #888888;">Reason</p>
        <p style="margin: 0; font-size: 14px; color: #ffffff; white-space: pre-wrap;">${reason}</p>
      </div>
      <a href="https://cgamecore.online/admin/matches" style="display: inline-block; background-color: #f59e0b; color: #000000; text-decoration: none; padding: 12px 24px; font-weight: 600; font-size: 14px; border-radius: 4px;">
        Open Admin Panel
      </a>
    </div>
  `;
}
