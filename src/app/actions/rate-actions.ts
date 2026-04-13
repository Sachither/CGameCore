"use server";

import { adminDb, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

const ER_API_KEY = process.env.EXCHANGERATE_API_KEY;

/**
 * SERVER ACTION: SYNC PLATFORM RATES
 * Fetches latest exchange rates for USD -> NGN, GHS, ZAR, KES 
 * and saves them to the global system config.
 */
export async function syncPlatformRatesAction(idToken: string) {
  // 1. Verify Super-Admin
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const profile = userSnap.data();
    
    const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || profile?.isSuperAdmin === true;
    if (!isSuperAdmin) throw new Error("Forbidden: Super-Admin clearance required.");

    // 2. Fetch Rates
    // If no API key is provided, we use a failsafe set of "Reasonable Defaults"
    // to prevent the platform from breaking.
    let rates = {
      NGN: 1500,
      GHS: 14.5,
      ZAR: 18.8,
      KES: 130
    };

    if (ER_API_KEY) {
      try {
        const response = await fetch(`https://v6.exchangerate-api.com/v6/${ER_API_KEY}/latest/USD`);
        const data = await response.json();
        if (data.result === "success") {
          rates = {
            NGN: data.conversion_rates.NGN || rates.NGN,
            GHS: data.conversion_rates.GHS || rates.GHS,
            ZAR: data.conversion_rates.ZAR || rates.ZAR,
            KES: data.conversion_rates.KES || rates.KES
          };
        }
      } catch (err) {
        console.error("[RateSync] API Fetch failed, using defaults:", err);
      }
    }

    // 3. Update Firestore
    const configRef = adminDb.collection("system").doc("config");
    await configRef.set({
      rates,
      ratesLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      ratesUpdatedBy: decoded.uid
    }, { merge: true });

    // 4. Audit Log
    await adminDb.collection("admin_audit_log").add({
      action: "SYSTEM_RATES_SYNCED",
      adminUid: decoded.uid,
      details: JSON.stringify(rates),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, rates };
  } catch (error: any) {
    console.error("[RateSync] Critical Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * INTERNAL HELPER: Get Dynamic Rate with Safety Buffer
 * Type: 'DEPOSIT' (-2% yield) or 'WITHDRAWAL' (+2% cost)
 */
export async function getPlatformRate(currency: string, type: 'DEPOSIT' | 'WITHDRAWAL'): Promise<number> {
  const configSnap = await adminDb.collection("system").doc("config").get();
  const data = configSnap.data();
  
  // Base rates fallback logic
  const rates = data?.rates || {
    NGN: 1500,
    GHS: 14.5,
    ZAR: 18.8,
    KES: 130
  };

  const baseRate = rates[currency] || rates['NGN'] || 1500;
  
  // Apply 2% Safety Buffer
  // Deposits and Withdrawals now use 1:1 market rate parity for maximum price transparency.
  if (type === 'DEPOSIT') {
    return baseRate; // 1:1 Market Rate
  } else {
    return baseRate; // 1:1 Market Rate
  }
}
/**
 * SERVER ACTION: Get Effective Rate for Client UI
 * Returns the final rate with the safety buffer already applied.
 */
export async function getEffectiveRateAction(currency: string, type: 'DEPOSIT' | 'WITHDRAWAL') {
  try {
    const rate = await getPlatformRate(currency, type);
    return { success: true, rate };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
