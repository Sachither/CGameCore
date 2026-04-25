/**
 * TEMPLATE: Welcome Operative
 * High-impact HTML template for new recruits.
 */
export function getWelcomeEmailTemplate(username: string, referralCode: string) {
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
        You have been successfully enlisted into CGameCore. Your neural link is active, and your wallet is primed for deployment.
      </p>

      <div style="background-color: #111; border: 1px solid #222; padding: 20px; text-align: center; margin-bottom: 30px;">
        <p style="text-transform: uppercase; font-weight: 900; font-size: 10px; color: #ff4d4d; letter-spacing: 2px; margin-bottom: 10px;">Your Recruitment Code</p>
        <p style="font-family: monospace; font-size: 32px; font-weight: 900; letter-spacing: 4px; margin: 0;">${referralCode}</p>
        <p style="font-size: 10px; color: #555; margin-top: 10px; text-transform: uppercase; font-weight: 800;">Use this to build your own squad and earn commissions.</p>
      </div>

      <a href="https://cgamecore.com/dashboard" style="display: block; background-color: #ff4d4d; color: #000; text-decoration: none; padding: 15px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        Enter The Lobby
      </a>

      <div style="margin-top: 40px; border-top: 1px solid #222; padding-top: 20px;">
        <p style="font-size: 10px; color: #444; text-transform: uppercase; font-weight: 800; text-align: center;">
          This is an automated transmission from Command Center. Do not reply.
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

      <a href="https://cgamecore.com/match/${matchId}" style="display: block; background-color: #ff4d4d; color: #000; text-decoration: none; padding: 15px; text-align: center; font-weight: 900; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">
        Join Judgement Room
      </a>

      <p style="font-size: 10px; color: #ff4d4d; margin-top: 20px; text-transform: uppercase; font-weight: 800; text-align: center; opacity: 0.7;">
        Failure to respond may result in temporary partner suspension.
      </p>
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
      <p style="font-size: 12px; color: #444; text-align: center;">Funds should arrive in your local account within the tactical window (1-24 hours).</p>
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
      <a href="https://cgamecore.com/match/${matchId}" style="display: block; background: #ff4d4d; color: #000; text-align: center; padding: 15px; font-weight: 900; text-decoration: none; text-transform: uppercase;">ENTER THE ZONE</a>
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
      <p style="font-size: 11px; color: #f59e0b; font-weight: 900;">If this wasn't you, initiate account lockdown immediately in settings.</p>
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
      <a href="https://cgamecore.com/dashboard" style="display: block; background: #3b82f6; color: #fff; text-align: center; padding: 15px; font-weight: 900; text-decoration: none; text-transform: uppercase;">RE-ENLIST NOW</a>
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
    </div>
  `;
}
