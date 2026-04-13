"use server";

import { adminDb, adminAuth } from "@/lib/firebase-admin";
import admin from "firebase-admin";

/**
 * INTERNAL HELPER: Perform the actual API sync
 * This is called by both the Admin action and the automatic background sync.
 */
async function internalSyncRates(actorUid: string = "system_auto"): Promise<any> {
    const API_KEY = process.env.EXCHANGERATE_API_KEY;
    
    // Default failsafe rates
    let rates = {
      NGN: 1500,
      GHS: 14.5,
      ZAR: 18.8,
      KES: 130
    };

    if (!API_KEY) {
        console.warn("[RateSync] No EXCHANGERATE_API_KEY found, using defaults.");
    } else {
        try {
            console.log("[RateSync] Fetching fresh rates from ExchangeRate-API...");
            const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`, {
                next: { revalidate: 3600 } // Cache for 1 hour at the fetch level
            });
            const data = await response.json();
            
            if (data.result === "success") {
                rates = {
                    NGN: data.conversion_rates.NGN || rates.NGN,
                    GHS: data.conversion_rates.GHS || rates.GHS,
                    ZAR: data.conversion_rates.ZAR || rates.ZAR,
                    KES: data.conversion_rates.KES || rates.KES
                };
                console.log("[RateSync] ✓ Rates updated successfully.");
            } else {
                console.error("[RateSync] API Error:", data['error-type'] || "Unknown");
            }
        } catch (err) {
            console.error("[RateSync] Network/Fetch failed:", err);
        }
    }

    // Update Firestore cache
    const configRef = adminDb.collection("system").doc("config");
    await configRef.set({
        rates,
        ratesLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        ratesUpdatedBy: actorUid
    }, { merge: true });

    return rates;
}

/**
 * SERVER ACTION: SYNC PLATFORM RATES (Admin Triggered)
 */
export async function syncPlatformRatesAction(idToken: string) {
  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const userSnap = await adminDb.collection("users").doc(decoded.uid).get();
    const profile = userSnap.data();

    const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || profile?.isSuperAdmin === true;
    if (!isSuperAdmin) throw new Error("Forbidden: Super-Admin clearance required.");

    const rates = await internalSyncRates(decoded.uid);

    // Audit Log
    await adminDb.collection("admin_audit_log").add({
      action: "SYSTEM_RATES_SYNCED",
      adminUid: decoded.uid,
      details: JSON.stringify(rates),
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    return { success: true, rates };
  } catch (error: any) {
    console.error("[RateSync] Action Error:", error);
    return { success: false, error: error.message };
  }
}

/**
 * INTERNAL HELPER: Get Dynamic Rate with Automatic Background Refresh
 */
export async function getPlatformRate(currency: string, type: 'DEPOSIT' | 'WITHDRAWAL'): Promise<number> {
  const configSnap = await adminDb.collection("system").doc("config").get();
  const data = configSnap.data();

  const now = Date.now();
  const sixHoursMs = 6 * 60 * 60 * 1000;
  const lastUpdated = data?.ratesLastUpdated?.toDate()?.getTime() || 0;

  // AUTO-SYNC LOGIC:
  // If no data exists OR data is older than 6 hours, trigger a refresh
  if (!data || (now - lastUpdated > sixHoursMs)) {
      // If we have an API key, we try to refresh
      if (process.env.EXCHANGERATE_API_KEY) {
          if (!data) {
              // CRITICAL: No data at all? Wait for the first sync
              console.log("[RateEngine] Cache empty, performing initial sync...");
              const freshRates = await internalSyncRates();
              return getRateFromData(currency, freshRates);
          } else {
              // STALE: Data exists but is old. Trigger background refresh and return cached for speed.
              console.log("[RateEngine] Cache stale (>6h), triggering background refresh...");
              internalSyncRates().catch(e => console.error("[RateEngine] Background sync failed:", e));
          }
      }
  }

  return getRateFromData(currency, data?.rates);
}

/**
 * Private helper to extract rate from a rates object with failsafes
 */
function getRateFromData(currency: string, rates: any): number {
    const safeRates = rates || {
        NGN: 1500,
        GHS: 14.5,
        ZAR: 18.8,
        KES: 130
    };

    return safeRates[currency] || (
        currency === 'GHS' ? 14.5 :
        currency === 'ZAR' ? 18.8 :
        currency === 'KES' ? 130 : 
        1500
    );
}

/**
 * SERVER ACTION: Get Effective Rate for Client UI
 */
export async function getEffectiveRateAction(currency: string, type: 'DEPOSIT' | 'WITHDRAWAL') {
  try {
    const rate = await getPlatformRate(currency, type);
    return { success: true, rate };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
