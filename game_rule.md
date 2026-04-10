# CGameCore: Official Game Rules & Standard Operating Procedures (SOPs)

This document serves as the master source of truth for fair play, loadout restrictions, platform-wide rules, and conflict resolution standard operating procedures.

---

## 1. Platform "Universal" Rules
These rules apply to all game titles and protect the platform's integrity.

*   **The "5-Minute" Rule:** Once a match lobby is generated and the Host provides the Room ID, the opponent has exactly 5 minutes to join. Failure to join results in a **Technical Win** for the Host upon uploading a screenshot of the empty lobby.
*   **The Evidence Requirement:** A "Win" is only valid if the submitted screenshot clearly displays the **Final Scoreboard** and both players' **Usernames**.
*   **The "Toxic" Clause:** Zero tolerance for hate speech, tribalism, or severe harassment in match chats. Violators will have their account immediately suspended and forfeit their active match's 100 Coin ($1.00) entry fee to their opponent.

---

## 2. eFootball Rules (Mobile Version)
Because eFootball relies heavily on simulation mechanics, rules focus strictly on match settings and preventing network tampering.

### Match Settings
*   **1v1 Standard Match**
    *   **Duration:** 6 Minutes.
    *   **Injuries:** OFF (Removes RNG/luck).
    *   **Extra Time / Penalties:** ON (A definitive winner must be produced).
    *   **Substitutions:** 5 Players allowed across 3 intervals.
*   **1v1 Golden Goal (Fast Mode)**
    *   **Condition:** First player to score wins instantly.
    *   **Duration:** 5 Minutes.
    *   **Tie-Breaker:** If 0-0 at the end, the player with the most **Shots on Target** wins.

### Banned Behaviors & Validations
*   **Lag-Switching / Network Tampering:** If the match ends prematurely due to disconnection, the player with the stable connection must screenshot the **"Match Abandoned"** screen. If both disconnect, the match is voided, and fees refunded.
*   **"Bird-Caging" (Time Wasting):** Passing the ball exclusively among defenders in your own half for >5 in-game minutes. **Proof Required:** A 30-second video clip showing the opponent making no attempt to advance the ball.
*   **Invalid Players:** Using a Legendary/Epic card in a "Standard-Only" match immediately voids the match.

---

## 3. Call of Duty: Mobile (CODM) Rules
CODM features strict rules on loadouts to maintain a 100% skill-based environment without "Pay-to-Win" elements.

### 1v1 Duel Modes (Sniper / Shotgun / Melee)
*   **Winning Conditions:** 10 Kills (Kill Limit) or 5 Minutes (Time Limit).
*   **Approved Maps:** Killhouse, Shipment, Cage. If the Host starts on an unapproved map (e.g., Nuketown), the Guest must immediately leave and report "Wrong Map." Playing the match implies acceptance of the wrong map.
*   **The "Blacklist" (Banned Items):**
    *   *Scorestreaks:* UAVs, Sentry Guns, RC Cars.
    *   *Operator Skills:* K9 Unit, Purifier, Kinetic Armor.
    *   *Tacticals:* Heartbeat Sensors, Trip Mines.
    *   *Weapons:* Using grenades or pistols in "Sniper Only" lobbies.
*   **Special Snipe Rule:** No "Hard-scoping" for more than 3 continuous seconds.

### 5v5 Search & Destroy (Team Battle)
*   **Format:** Best of 11 (First to 6 Rounds). Round Timer: 120 Seconds.
*   **Approved Maps:** Firing Range, Standoff, Raid, Slums, Takeoff.
*   **Banned Weapons:**
    *   *LMGs:* Chopper, Holger, etc.
    *   *Launchers:* SMRS, FHJ.
    *   *Shotguns:* Banned entirely unless listed as a special "Shotgun Only" tournament.

### Battle Royale (100 Players - TPP)
*   **Mode:** Third Person Perspective (Standard).
*   **Scoring Logic:**
    *   *Placement:* 1st (50 pts), 2nd (30 pts), 3rd (20 pts), 4th-10th (10 pts).
    *   *Aggression:* +2 Points per Kill.
*   **Banned Classes:** Poltergeist, Rewind, Igniter.

---

## 4. The Reporting & Dispute System

### The "Report Violation" Form
When a player clicks "Dispute", they must provide:
1.  **Violation Category Dropdown:** Settings Violation, Banned Item Used, Gameplay Malpractice, Technical Issue, Toxic Behavior.
2.  **Proof Upload:** Mandatory 5MB limited screenshot or video upload. (Upload routes to Discord Webhooks for free admin review).
3.  **Description:** 200-character max limit (e.g., "Player used K9 unit at 4:12, marked in killfeed").

### CODM Killfeed Validation
The easiest way to prove loadout cheating natively. The "Victim" player submits a screenshot showing a banned item icon (like a Trip Mine or Operator Skill) in the killfeed.

---

## 5. The Punishment Scale & Enforcement Matrix
To enforce a healthy, competitive ecosystem, the backend automates the following penalty strikes tracked via a `violations_count` integer in the User Database:

*   **1st Offense:** Immediate Match Forfeit (The Entry Fee Escrow goes to the opponent) + Warning Email / Web Push notification.
*   **2nd Offense:** 48-Hour Platform Suspension + **100 Coin Fine** deducted from their active wallet balance.
*   **3rd Offense:** **Permanent Ban.** Any remaining Coins in the fraudster's wallet are frozen and proportionately distributed as compensation to users they cheated against.

---

## 6. The "Referee" Role (Tournament Feature)
A community-driven feature for high-scale (50+ player) tournaments to reduce platform moderation overhead.
*   **Role Description:** Trusted players with "Pro" status act as Spectators for tournament matches.
*   **Mechanism:** Referees watch matches live in-game and validate outcomes directly via a specialized Dashboard.
*   **Incentive:** The Referee earns a tiny fraction (e.g., 5 Coins) from the overarching tournament pool for their time, effectively decentralizing and crowdsourcing match moderation while making the tournament feel heavily "officially sanctioned."
