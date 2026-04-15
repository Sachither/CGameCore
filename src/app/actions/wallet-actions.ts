"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";

import { getVerifiedUid } from "@/lib/server-utils";
import { validateNuban, validateCryptoAddressByNetwork } from "@/lib/address-validator";
import { getPlatformRate } from "@/app/actions/rate-actions";
import { validateWithdrawalTier, calculateWithdrawalHoldTime } from "@/lib/security-fixes";
import { getWithdrawalFee, isCryptoWithdrawalNetwork } from "@/lib/withdrawal-fees";

/**
 * SERVER ACTION: Request Withdrawal
 * Deducts the user's coins instantly and creates a PENDING ticket for manual admin review.
 */
export async function requestWithdrawalAction(
  idToken: string,
  amountCoins: number,
  bankName: string,
  bankCode: string,
  accountNumber: string,
  legalName: string
) {
  const uid = await getVerifiedUid(idToken);
  
  if (amountCoins < 100) return { success: false, error: "Minimum withdrawal is 100 Coins." };
  
  const isCrypto = isCryptoWithdrawalNetwork(bankCode);
  const isSolana = bankCode === "USDC_SOL";
  
  // 🌍 REGIONAL VALIDATION: Ensure user has a region set
  const userRef = adminDb.collection("users").doc(uid);
  const userSnapForRef = await userRef.get();
  const userDataForRef = userSnapForRef.data();
  const country = userDataForRef?.country || "NG";
  const currency = userDataForRef?.currency || "NGN";

  if (!userDataForRef?.country) {
    return { success: false, error: "REGION_REQUIRED: Please set your country in profile settings before withdrawing." };
  }

  // Validation
  if (!isCrypto) {
    // NG: Strict 10-digit NUBAN
    if (country === 'NG' && !validateNuban(accountNumber, bankCode)) {
      return { success: false, error: "Invalid account number. A standard 10-digit NUBAN is required." };
    }
    // GH/KE/ZA: Generic sanity check for now (9-16 digits)
    if (country !== 'NG' && (accountNumber.length < 9 || accountNumber.length > 16)) {
      return { success: false, error: `Invalid account/wallet number for ${country}. Please verify your details.` };
    }
  } else {
    const cryptoValidation = validateCryptoAddressByNetwork(accountNumber, bankCode);
    if (!cryptoValidation.isValid) {
       return { success: false, error: `Invalid wallet address for ${bankCode}. Expected format: ${cryptoValidation.format}` };
    }
  }

  if (!bankName || !bankCode || !legalName) {
    return { success: false, error: "Incomplete details provided." };
  }

  const withdrawalFee = getWithdrawalFee(bankCode);
  const netAmount = Math.max(0, amountCoins - withdrawalFee);

  const withdrawalRef = adminDb.collection("withdrawals").doc();

  // 🚀 DYNAMIC MULTI-CURRENCY LOGIC
  // 100 Coins = $1.00 USD
  // 1 Coin = (1/100) * Rate
  const rate = await getPlatformRate(currency, 'WITHDRAWAL');
  const ratePerCoin = rate / 100;
  const fiatAmount = netAmount * ratePerCoin;

  try {
    await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      if (!userSnap.exists) throw new Error("User profile missing.");

      const userData = userSnap.data()!;
      const totalMatches = userData.totalMatches || 0;
      const currentBalance = userData.balanceCoins || 0;
      const lifetimeDeposits = userData.lifetimeDeposits || 0;
      const lifetimeWagered = userData.lifetimeWagered || 0;

      // AML Logic: Calculate withdrawable balance (Balance minus un-wagered deposits)
      const unWageredDeposits = Math.max(0, lifetimeDeposits - lifetimeWagered);
      const maxWithdrawable = Math.max(0, currentBalance - unWageredDeposits);

      // 0. Security Check: Restricted?
      const now = Date.now();
      const suspensionEnd = userData.suspendedUntil ? (userData.suspendedUntil.toDate ? userData.suspendedUntil.toDate().getTime() : new Date(userData.suspendedUntil).getTime()) : 0;
      const isRestricted = userData.isBanned || (suspensionEnd > now);
      
      if (isRestricted) {
         throw new Error("SECURITY: Your vault is locked during investigation.");
      }

      // --- TIERED AML GATE ---
      // FIX F-001: Use >= for boundary checks instead of >
      // Tier 1: Small Balance (<= 500 CR)
      if (currentBalance < 500) {
        if (totalMatches < 1) {
          throw new Error("Tier 1 Requirement: You must play at least 1 match before your first withdrawal.");
        }
      }
      // Tier 2: Medium Balance (500 - 999 CR)
      else if (currentBalance < 1000) {
        if (totalMatches < 2) {
          throw new Error("Tier 2 Requirement: You must play at least 2 matches before withdrawing this amount.");
        }
      }
      // Tier 3: High Stakes (>= 1000 CR) - Strict Rollover
      else {
        if (amountCoins > maxWithdrawable) {
           throw new Error(`Tier 3 AML Limit: You can only withdraw up to ${maxWithdrawable} CR. Your remaining balance is currently "Locked" until you complete more match wagers (Rollover).`);
        }
      }

      if (currentBalance < amountCoins) {
        throw new Error("Insufficient coin balance for this payout.");
      }

      // 🔒 WITHDRAW: Deduct coins + create ticket + auditlog in same transaction
      // 1. Deduct coins instantly so they can't double-spend while it sits in queue
      const updateData: any = {
        balanceCoins: admin.firestore.FieldValue.increment(-amountCoins),
        lastWithdrawalAttempt: admin.firestore.FieldValue.serverTimestamp()
      };

      // 1.1 IDENTITY LOCK: Save legal name if not already set
      if (!userData.isIdentityLocked) {
        updateData.legalName = legalName;
        updateData.isIdentityLocked = true;
      } else {
        // Verify incoming name matches stored locked identity
        if (userData.legalName !== legalName) {
           throw new Error("IDENTITY_MISMATCH: The name provided does not match your verified legal identity on file. Please use your locked name or contact support.");
        }
      }

      transaction.update(userRef, updateData);

      // 2. Create the ticket — including bankCode for Paystack Transfer API
      // FIX F-002: Add withdrawal availability time (7-day hold on deposits)
      const withdrawalAvailableAt = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      );
      
      transaction.set(withdrawalRef, {
        uid,
        username: userData.username || "Unknown",
        amountCoins,
        withdrawalFee,
        netAmount,
        currency, // Store the currency requested
        fiatAmount, // Final local amount based on dynamic rate
        withdrawalAvailableAt, // FIX F-002: Can only proceed after this time
        bankName,
        bankCode,
        accountNumber,
        legalName,
        isVerifiedIdentity: true,
        status: "PENDING",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      // 3. Create audit log entry for withdrawal attempt
      const auditRef = adminDb.collection("audit_logs").doc();
      transaction.set(auditRef, {
        event: "WITHDRAWAL_REQUESTED",
        uid,
        username: userData.username || "Unknown",
        amount_coins: amountCoins,
        fee_coins: withdrawalFee,
        net_coins: netAmount,
        fiat_amount: fiatAmount,
        withdrawal_ticket_id: withdrawalRef.id,
        bank_name: bankName,
        account_last4: accountNumber.slice(-4),
        aml_checks: {
          banned: !!userData.isBanned,
          suspended: suspensionEnd > now,
          min_matches: totalMatches >= 1,
          deposit_rollover: `available: ${maxWithdrawable} CR out of ${currentBalance} CR balance`,
          lifecycle_deposits: lifetimeDeposits || 0,
          lifecycle_wagered: lifetimeWagered || 0
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        ipAddress: "wallet-action"
      });
    });

    return { success: true, ticketId: withdrawalRef.id };
  } catch (error: any) {
    console.error("[WalletAction] Withdrawal error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * SERVER ACTION: Get User Transaction Ledger
 */
export async function getWalletTransactionsAction(idToken: string) {
  const uid = await getVerifiedUid(idToken);
  
  try {
     const [matchesSnap, withdrawalsSnap, genericTransactionsSnap] = await Promise.all([
       adminDb.collection("matches").where("playerIds", "array-contains", uid).orderBy("createdAt", "desc").limit(20).get(),
       adminDb.collection("withdrawals").where("uid", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
       adminDb.collection("transactions").where("uid", "==", uid).orderBy("createdAt", "desc").limit(20).get(),
     ]);

     const transactions: any[] = [];

     // Process Match Entries & Winnings
     matchesSnap.forEach(doc => {
        const m = doc.data();
        const isWinner = m.championUid === uid;
        const netPool = m.rewardAmount || 0;
        
        // 1. Show the Entry Fee as a deduction
        if (m.createdAt) {
           transactions.push({
              id: `${doc.id}-entry`, // Unique React Key
              displayId: doc.id.substring(0, 8).toUpperCase(), // UI Display
              timestamp: m.createdAt.toDate ? m.createdAt.toDate() : new Date(),
              type: "Match Entry",
              match: `${m.game} ${m.format}`,
              amount: `-${m.challengeFee}`,
              status: "Completed"
           });
        }

        // 2. If won, show the winnings as a gain
        if (isWinner && m.status === 'CLOSED') {
           transactions.push({
              id: `${doc.id}-win`, // Unique React Key
              displayId: "WIN-" + doc.id.substring(0, 5).toUpperCase(), // UI Display
              timestamp: m.resolvedAt?.toDate ? m.resolvedAt.toDate() : new Date(),
              type: "Prize Won",
              match: `${m.game} Victory`,
              amount: `+${netPool}`,
              status: "Completed"
           });
        }
     });

     // Process Deployments, Deposits and Admin Adjs (Transactions Collection)
     genericTransactionsSnap.forEach(doc => {
        const t = doc.data();
        // Use the full doc.id for uniqueness, but keep the display format
        const displayId = doc.id.startsWith('CGC-') ? doc.id.replace('CGC-DEP-', 'DEP-') : doc.id.substring(0, 8).toUpperCase();
        
        transactions.push({
           id: doc.id, // Full ID for React key
           displayId: displayId, // Clean ID for UI
           timestamp: t.createdAt?.toDate ? t.createdAt.toDate() : new Date(),
           type: t.type === 'DEPOSIT' ? "Deposit" : 
                 t.type === 'IDENTITY_FINE' ? "Identity Fine" : "Wallet Adj",
           match: t.gateway === 'PAYSTACK' ? "Paystack Gateway" : "System Audit",
           amount: t.amount > 0 ? `+${t.amount}` : `${t.amount}`,
           status: t.status === 'COMPLETED' || t.status === 'SUCCESS' ? "Completed" : 
                   t.status === 'ABANDONED' ? "Abandoned" : "Pending"
        });
     });

     // Process Withdrawals
     withdrawalsSnap.forEach(doc => {
        const w = doc.data();
        transactions.push({
           id: doc.id, // Full ID for React key
           displayId: "WD-" + doc.id.substring(0, 6).toUpperCase(), // UI Display
           timestamp: w.createdAt?.toDate ? w.createdAt.toDate() : new Date(),
           type: "Withdrawal",
           match: "Bank Transfer",
           amount: `-${w.amountCoins}`,
           status: w.status === 'PENDING' ? "Pending" : 
                   w.status === 'REJECTED' ? "Rejected" : "Completed"
        });
     });

     // Sort by most recent
     transactions.sort((a, b) => b.timestamp - a.timestamp);

     const sanitized = transactions.map(t => ({
        ...t,
        date: t.timestamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        time: t.timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        timestamp: null // strip the Date object for Serialized Action response
     }));

     return { success: true, transactions: sanitized };
  } catch (error: any) {
     console.error("[WalletAction] Error fetching ledger:", error);
     return { success: false, error: error.message, transactions: [] };
  }
}
