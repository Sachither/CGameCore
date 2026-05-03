import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";

export interface SystemConfig {
  matchFeePercentage: number; // e.g. 0.10 for 10%
  partnerCommissionShare: number; // e.g. 0.50 for 50% of the platform rake
  withdrawalFiatFee: number;
  referralCommissionShare: number; // e.g. 0.50 for 50% of the platform rake
}

export const DEFAULT_CONFIG: SystemConfig = {
  matchFeePercentage: 0.20,
  partnerCommissionShare: 0.50,
  withdrawalFiatFee: 10,
  referralCommissionShare: 0.50
};

/**
 * Fetch system configuration from Firestore (Client-side)
 */
export async function getSystemConfigClient(): Promise<SystemConfig> {
  try {
    const docRef = doc(db, "system", "config");
    const snap = await getDoc(docRef);
    
    if (!snap.exists()) {
      return DEFAULT_CONFIG;
    }
    
    const data = snap.data() || {};
    return {
      matchFeePercentage: data.matchFeePercentage ?? DEFAULT_CONFIG.matchFeePercentage,
      partnerCommissionShare: data.partnerCommissionShare ?? DEFAULT_CONFIG.partnerCommissionShare,
      withdrawalFiatFee: data.withdrawalFiatFee ?? DEFAULT_CONFIG.withdrawalFiatFee,
      referralCommissionShare: data.referralCommissionShare ?? DEFAULT_CONFIG.referralCommissionShare,
    };
  } catch (error) {
    console.error("[Config] Client fetch error:", error);
    return DEFAULT_CONFIG;
  }
}
