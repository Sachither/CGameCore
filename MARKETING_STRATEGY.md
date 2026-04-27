# CGameCore: Marketing & Growth Strategy (2026)

This document outlines the strategic roadmap for scaling CGameCore using zero-upfront-cost marketing and a performance-based influencer model.

---

## 1. Core Brand Positioning
*   **The "No-Ghost" Arena**: Every player is verified by a $1 "Anti-Cheat Shield." This is our primary competitive advantage. We sell **quality** over quantity.
*   **The "Operative" Persona**:
    *   **Users**: Operatives
    *   **Matches**: Deployments
    *   **Wins**: Confirmed Extractions
    *   **Dashboard**: Command Center
*   **Regional Strategy**: Lean into the "Sector" rivalries. (e.g., NG Sector vs. KE Sector).

---

## 2. The "Zero-Cash" Influencer Outreach (TikTok/Reels)
We do not pay for posts. We offer **Equity in Activity**. We pitch this as a "Partner Business Opportunity."

### The TikTok Pitch Script
> **Subject: Collab: Launch your own [Creator Name] Elite Cup**
>
> Yo [Creator Name]! 
>
> I’ve been watching your [eFootball/CODM] clips and your community is exactly the vibe we're looking for. I’m the founder of **CGameCore**, a new high-stakes arena built specifically for competitive players in our region.
>
> We got tired of platforms full of ghosts and lag-switchers, so we fixed it with a **$1 Anti-Cheat Shield**—nobody gets in unless they’re serious and verified.
>
> **The Deal:** I want to set you up with an **Official Partner Contract**. There's no upfront cost to you. Here is exactly what you get:
>
> 1. **The Creator Cup:** You get your own private 'Partner Portal' where you can deploy massive 100-Player BRs, FFAs, or eFootball Knockouts for your fans to compete in.
> 2. **50% Revenue Share:** When a player registers with your unique Recruitment Code, you get **50% of the platform's commission** on every single match they play for their first 90 days. If they play a lot, you get paid a lot.
> 3. **Performance Contracts:** We start you on a 30-day or 60-day Tactical Contract. If your community is active, we renew it and bump your perks. 
>
> Let me know if you're down and I'll generate your clearance code right now. Let's build.

---

## 3. Technical Implementation Plan (The "Referral Engine")

### Phase 1: Database Schema
*   [ ] Add `referralCode` (string) to User profile.
*   [ ] Add `referredBy` (uid) to User profile.
*   [ ] Create `PartnerEarnings` collection to track every $0.05 - $0.10 earned by influencers.

### Phase 2: User Onboarding
*   [ ] Add "Referral Code (Optional)" field to the Registration Page.
*   [ ] Logic: If code exists, verify it and link the users.
*   [ ] (Optional) Credit the new user with 5-10 "Promo Coins" to start their first match.

### Phase 3: The Commission Loop
*   [ ] **Trigger**: Match Result Confirmed.
*   [ ] **Action**: Check if winner/loser has a `referredBy` tag.
*   [ ] **Payout**: Deduct the platform rake, then split that rake 50/50 with the referring Partner.

---

## 4. Onboarding Assets

### Welcome Email Template
**Subject: Welcome to the Core, Operative [Username] 🛡️**
> Status: DEPLOYED. 
> You are now part of the most elite arena in the region. 
> 1. **Verify your Shield**: Your $1 deposit ensures professional brackets.
> 2. **Join a Deployment**: Find a match in the Dashboard.
> 3. **Secure the Bag**: Win and withdraw.
> Stay Frosty.

### Referral Logic Summary
*   **Entry Fee**: 100 Coins ($1.00)
*   **Prize Pool**: 180 Coins (90% Payout)
*   **Platform Rake**: 20 Coins (10% Fee)
*   **Influencer Cut**: 10 Coins (50% of the Rake)
*   **Platform Net**: 10 Coins


. Preparing for Deployment (Going Live)
When you are ready to launch CGameCore to the public:

Go back to the Credentials page.
Create a NEW OAuth 2.0 Client ID specifically for Production.
In the Production client, ONLY add your secure domains:
https://cgamecore.online
https://cgamecore.web.app
Remove all localhost and ngrok links from that Production client.