import { adminDb } from "@/lib/firebase-admin";

export interface SystemConfig {
  matchFeePercentage: number; // e.g. 0.10 for 10%
  partnerCommissionShare: number; // e.g. 0.50 for 50% of the platform rake
  withdrawalFiatFee: number;
  referralCommissionShare: number; // e.g. 0.50 for 50% of the platform rake
}

export const DEFAULT_CONFIG: SystemConfig = {
  matchFeePercentage: 0.10,
  partnerCommissionShare: 0.50,
  withdrawalFiatFee: 10,
  referralCommissionShare: 0.50
};

/**
 * Fetch system configuration from Firestore (Server-side)
 */
export async function getSystemConfig(): Promise<SystemConfig> {
  try {
    const configSnap = await adminDb.collection("system").doc("config").get();
    if (!configSnap.exists) {
      console.warn("[Config] No system config found in Firestore. Using defaults.");
      return DEFAULT_CONFIG;
    }
    
    const data = configSnap.data() || {};
    return {
      matchFeePercentage: data.matchFeePercentage ?? DEFAULT_CONFIG.matchFeePercentage,
      partnerCommissionShare: data.partnerCommissionShare ?? DEFAULT_CONFIG.partnerCommissionShare,
      withdrawalFiatFee: data.withdrawalFiatFee ?? DEFAULT_CONFIG.withdrawalFiatFee,
      referralCommissionShare: data.referralCommissionShare ?? DEFAULT_CONFIG.referralCommissionShare,
    };
  } catch (error) {
    console.error("[Config] Error fetching system config:", error);
    return DEFAULT_CONFIG;
  }
}
