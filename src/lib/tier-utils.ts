
export interface TierInfo {
  level: 1 | 2 | 3;
  label: string;
  color: string;
  minWins: number;
  maxWins: number;
}

export const TIERS: Record<number, TierInfo> = {
  1: { level: 1, label: "TIER 1: RECRUIT", color: "#94a3b8", minWins: 0, maxWins: 50 },
  2: { level: 2, label: "TIER 2: OPERATIVE", color: "#3b82f6", minWins: 51, maxWins: 200 },
  3: { level: 3, label: "TIER 3: ELITE", color: "#f59e0b", minWins: 201, maxWins: Infinity },
};

export function getTierFromWins(wins: number): TierInfo {
  if (wins <= 50) return TIERS[1];
  if (wins <= 200) return TIERS[2];
  return TIERS[3];
}

export const TIER_RULES = [
  { rank: "TIER 1", range: "0 - 50 Wins", status: "Basic Clearance" },
  { rank: "TIER 2", range: "51 - 200 Wins", status: "Advanced Clearance" },
  { rank: "TIER 3", rankLabel: "201+ Wins", status: "Elite Clearance" },
];
