/**
 * TEMPLATE: Welcome Operative
 * High-impact HTML template for new recruits.
 */
export function getWelcomeEmailTemplate(username: string) {
  return `
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #333; max-width: 600px; margin: auto;">
      <div style="border-bottom: 2px solid #ff4d4d; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="text-transform: uppercase; font-style: italic; font-weight: 900; letter-spacing: -2px; font-size: 32px; margin: 0;">
          CGame <span style="color: #ff4d4d;">Intelligence</span>
        </h1>
      </div>
      
      <p style="text-transform: uppercase; font-weight: 900; font-size: 10px; color: #666; letter-spacing: 2px; margin-bottom: 10px;">Tactical Onboarding // ID: ${Math.random().toString(36).substring(2, 8).toUpperCase()}</p>
      
      <h2 style="font-size: 24px; font-weight: 900; text-transform: uppercase; margin-bottom: 20px;">Welcome to the Arena, Operative ${username}.</h2>
      
      <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 30px;">
        You have been successfully enlisted into CGameCore. Your neural link is active, and your wallet is primed for deployment. Complete your profile and enter the matchmaking zone to start your career.
      </p>

      <a href="https://cgamecore.online/dashboard" style="display: block; background-color: #ff4d4d; color: #000; text-decoration: none; padding: 15px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        Enter The Lobby
      </a>

      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          This is an automated transmission from Command Center. Do not reply.
        </p>
        <p style="font-size: 10px; color: #666;">
          No longer want tactical updates? <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">Unsubscribe</a>
        </p>
      </div>
    </div>
  `;
}

/**
 * TEMPLATE: Partner Summon
 * Emergency alert for Influencers during disputes.
 */
export function getSummonEmailTemplate(username: string, matchId: string) {
  return `
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #ff4d4d; max-width: 600px; margin: auto;">
      <div style="border-bottom: 2px solid #ff4d4d; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
        <h1 style="text-transform: uppercase; font-style: italic; font-weight: 900; letter-spacing: -2px; font-size: 32px; margin: 0; color: #ff4d4d;">
          CRITICAL ALERT
        </h1>
      </div>
      
      <p style="text-transform: uppercase; font-weight: 900; font-size: 10px; color: #ff4d4d; letter-spacing: 2px; margin-bottom: 10px; text-align: center;">Command Center Summons // Priority: Alpha</p>
      
      <h2 style="font-size: 20px; font-weight: 900; text-transform: uppercase; margin-bottom: 20px; text-align: center;">Operative ${username}, You are required for Judgement.</h2>
      
      <p style="color: #aaa; font-size: 14px; line-height: 1.6; margin-bottom: 30px; text-align: center;">
        A dispute has been triggered in a lobby you deployed (Match #${matchId.slice(-6)}). Your presence is mandatory for the resolution protocol.
      </p>

      <a href="https://cgamecore.online/match/${matchId}" style="display: block; background-color: #ff4d4d; color: #000; text-decoration: none; padding: 15px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        Join Judgement Room
      </a>

      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          This is an automated transmission from Command Center. Do not reply.
        </p>
        <p style="font-size: 10px; color: #666;">
          Manage notifications <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">here</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #22c55e; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #22c55e; margin: 0;">EXTRACTION COMPLETE</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">FINANCIAL INTELLIGENCE // SUCCESS</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, your request for extraction has been authorized and processed.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0;">
        <p style="margin: 5px 0; font-size: 12px; color: #666;">Amount:</p>
        <p style="margin: 0; font-size: 24px; font-weight: 900; color: #fff;">${amount}</p>
        <p style="margin: 15px 0 5px 0; font-size: 12px; color: #666;">Method:</p>
        <p style="margin: 0; font-size: 14px; font-weight: 900; color: #aaa;">${method}</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Tactical Extraction Successful.
        </p>
        <p style="font-size: 10px; color: #666;">
          Manage your account notifications <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">here</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #ff4d4d; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #ff4d4d; margin: 0;">DEPLOYMENT IMMINENT</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">ARENA INTEL // LOBBY FULL</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, your ${game} lobby is full. The match timer has been engaged.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 2px;">MATCH #${matchId.slice(-6)}</p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Combat Deployment Sequence Engaged.
        </p>
        <p style="font-size: 10px; color: #666;">
          Too many alerts? <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">Adjust settings</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #f59e0b; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #f59e0b; margin: 0;">SECURITY REALIGNMENT</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">NEURAL ACCESS // NEW DEVICE</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, a new login was detected on your account.</p>
      <div style="background: #111; padding: 15px; border: 1px solid #222; margin: 20px 0;">
        <p style="margin: 5px 0; font-size: 11px; color: #666;">IP Address: <span style="color: #fff;">${ip}</span></p>
        <p style="margin: 5px 0; font-size: 11px; color: #666;">Device: <span style="color: #fff;">${device}</span></p>
      </div>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Secure Access Monitoring Active.
        </p>
        <p style="font-size: 10px; color: #666;">
          Safety first. Manage alerts <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">here</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #3b82f6; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #3b82f6; margin: 0;">SKILL DEGRADATION WARNING</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">COMMAND CENTER // RE-DEPLOYMENT</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, our sensors indicate zero combat activity in the last 7 cycles. Your skills are degrading.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0; text-align: center;">
        <p style="color: #fff; font-size: 16px; font-weight: 900;">RETENTION BONUS: 50 COINS</p>
        <p style="font-size: 10px; color: #444;">Login today to claim your gear maintenance credits.</p>
      </div>
      <a href="https://cgamecore.online/dashboard" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 15px; font-weight: 900; text-decoration: none; text-transform: uppercase;">RE-ENLIST NOW</a>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Tactical Reactivation Bonus expires in 24h.
        </p>
        <p style="font-size: 10px; color: #666;">
          Don't want these? <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">Unsubscribe</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #3b82f6; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #3b82f6; margin: 0;">TACTICAL PARTNER CLEARANCE</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">COMMAND CENTER // STATUS UPGRADE</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, your clearance has been officially elevated to PARTNER status for the next ${duration}.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0; text-align: center;">
        <p style="color: #666; font-size: 12px; font-weight: 900; margin-bottom: 10px;">YOUR RECRUITMENT CODE</p>
        <p style="color: #fff; font-size: 24px; font-weight: 900; letter-spacing: 4px;">${referralCode}</p>
        <p style="font-size: 10px; color: #444; margin-top: 10px;">Use this to earn 50% commission on your squad's matches.</p>
      </div>
      <a href="https://cgamecore.com/dashboard/partner" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 15px; font-weight: 900; text-decoration: none; text-transform: uppercase;">ACCESS PARTNER PORTAL</a>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Welcome to the Inner Circle, Partner.
        </p>
        <p style="font-size: 10px; color: #666;">
          Partner communications management <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">here</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #ef4444; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #ef4444; margin: 0;">CONTRACT TERMINATED</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">COMMAND CENTER // CLEARANCE REVOKED</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, your Tactical Partner Contract has expired or been revoked by Command.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0;">
        <p style="font-size: 12px; color: #aaa;">Your clearance level has been downgraded to standard user. Access to the Partner Portal is restricted, and revenue share commissions have been halted.</p>
      </div>
      <p style="font-size: 11px; color: #ef4444; font-weight: 900;">If you believe this is an error, please contact Support.</p>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Contract Conclusion Finalized.
        </p>
        <p style="font-size: 10px; color: #666;">
          Unsubscribe from all future intel <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">here</a>
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
    <div style="background-color: #000; color: #fff; font-family: 'Inter', sans-serif; padding: 40px; border: 1px solid #f59e0b; max-width: 600px; margin: auto;">
      <h1 style="text-transform: uppercase; font-weight: 900; color: #f59e0b; margin: 0;">TACTICAL PING</h1>
      <p style="color: #666; font-size: 10px; font-weight: 900; margin-bottom: 30px;">COMBAT ZONE // URGENT ALERT</p>
      <p style="font-size: 14px; color: #aaa;">Operative ${username}, your opponent <strong>${pingerName}</strong> is waiting for you in the combat zone.</p>
      <div style="background: #111; padding: 20px; border: 1px solid #222; margin: 20px 0; text-align: center;">
        <p style="margin: 0; font-size: 16px; font-weight: 900; letter-spacing: 1px;">MATCH #${matchId.slice(-6)}</p>
        <p style="margin: 10px 0 0 0; font-size: 10px; color: #666; text-transform: uppercase;">Engagement Required Immediately</p>
      </div>
      <a href="https://cgamecore.online/match/${matchId}" style="display: block; background: #f59e0b; color: #000; text-align: center; padding: 15px; font-weight: 900; text-decoration: none; text-transform: uppercase; font-size: 12px;">RETURN TO MISSION</a>
      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px; text-align: center;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; margin-bottom: 10px;">
          Neural Alert Frequency: Standard Deployment.
        </p>
        <p style="font-size: 10px; color: #666;">
          Too many pings? <a href="https://cgamecore.online/unsubscribe" style="color: #888; text-decoration: underline;">Adjust frequency</a>
        </p>
      </div>
    </div>
  `;
}
