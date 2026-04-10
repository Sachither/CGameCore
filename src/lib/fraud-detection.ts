/**
 * PHASE 2: FRAUD DETECTION RULES ENGINE
 * 
 * Analyzes match patterns to detect potential fraud before payout.
 * Flags suspicious matches for admin review without blocking legitimate players.
 * 
 * Detects:
 * - Collusion patterns (same opponent repeatedly)
 * - Unnatural win streaks
 * - Abnormal play times (24/7 gaming)
 * - Identical scores (always 10-5, etc.)
 * - New accounts with high win rates
 * - Rapid account progression
 */

import { adminDb } from './firebase-admin';
import { Match } from './match-service';

/**
 * Fraud score breakdown and reasoning
 */
export interface FraudAnalysis {
  baseScore: number;           // 0-100
  flagged: boolean;            // Should admin review?
  autoHold: boolean;           // Should hold payout pending admin approval?
  reasons: string[];           // Why this score?
  riskFactors: {
    collusionRisk: number;    // 0-30
    winStreakAnomalyRisk: number; // 0-25
    playTimeAnomalyRisk: number;  // 0-15
    scorePatternRisk: number;    // 0-15
    accountAnomalyRisk: number;   // 0-15
  };
}

/**
 * Historical player data needed for fraud detection
 */
export interface PlayerHistory {
  totalMatches: number;
  totalWins: number;
  winRate: number;            // 0-1
  accountAgeDays: number;
  last10_opponents: string[];
  last10_scores: Array<{ for: number; against: number }>;
  weeklyWinRate: number;      // Wins this week / matches this week
  weeklyMatchCount: number;
  lastPlayedTimestamp: number;
  createdAtTimestamp: number;
  averagePlayTimeHour: number; // Hour of day they usually play (0-23)
  playtimeVariance: number;    // How spread out their play times are
}

/**
 * Analyze a single match for fraud signals
 * Called before finalizing payout
 */
export async function analyzeMatchForFraud(
  match: Match,
  winnerUid: string
): Promise<FraudAnalysis> {
  const analysis: FraudAnalysis = {
    baseScore: 0,
    flagged: false,
    autoHold: false,
    reasons: [],
    riskFactors: {
      collusionRisk: 0,
      winStreakAnomalyRisk: 0,
      playTimeAnomalyRisk: 0,
      scorePatternRisk: 0,
      accountAnomalyRisk: 0
    }
  };

  try {
    // Fetch player histories
    const winnerHistory = await getPlayerHistory(winnerUid);
    const playerIds = Object.keys(match.players);
    const loserUid = playerIds.find((pid) => pid !== winnerUid) || '';
    const loserHistory = loserUid ? await getPlayerHistory(loserUid) : null;

    if (!winnerHistory || !loserHistory) {
      return analysis; // Can't analyze without history
    }

    // --- RISK FACTOR 1: Collusion Detection (0-30 points) ---
    const collusionAnalysis = analyzeCollusion(winnerUid, loserUid, winnerHistory, loserHistory);
    analysis.riskFactors.collusionRisk = collusionAnalysis.score;
    analysis.baseScore += collusionAnalysis.score;
    analysis.reasons.push(...collusionAnalysis.reasons);

    // --- RISK FACTOR 2: Win Streak Anomaly (0-25 points) ---
    const winStreakAnalysis = analyzeWinStreakAnomaly(winnerHistory);
    analysis.riskFactors.winStreakAnomalyRisk = winStreakAnalysis.score;
    analysis.baseScore += winStreakAnalysis.score;
    analysis.reasons.push(...winStreakAnalysis.reasons);

    // --- RISK FACTOR 3: Play Time Anomaly (0-15 points) ---
    const playTimeAnalysis = analyzePlayTimeAnomaly(match, winnerHistory);
    analysis.riskFactors.playTimeAnomalyRisk = playTimeAnalysis.score;
    analysis.baseScore += playTimeAnalysis.score;
    analysis.reasons.push(...playTimeAnalysis.reasons);

    // --- RISK FACTOR 4: Score Pattern Recognition (0-15 points) ---
    const scoreAnalysis = analyzeScorePattern(match, winnerHistory);
    analysis.riskFactors.scorePatternRisk = scoreAnalysis.score;
    analysis.baseScore += scoreAnalysis.score;
    analysis.reasons.push(...scoreAnalysis.reasons);

    // --- RISK FACTOR 5: Account Anomaly (0-15 points) ---
    const accountAnalysis = analyzeAccountAnomaly(winnerHistory);
    analysis.riskFactors.accountAnomalyRisk = accountAnalysis.score;
    analysis.baseScore += accountAnalysis.score;
    analysis.reasons.push(...accountAnalysis.reasons);

    // Clamp score to 0-100
    analysis.baseScore = Math.min(100, analysis.baseScore);

    // Flagging thresholds
    analysis.flagged = analysis.baseScore > 60;
    analysis.autoHold = analysis.baseScore > 80;

    if (analysis.flagged) {
      analysis.reasons.push(
        `Fraud score: ${analysis.baseScore}/100 - flagged for admin review`
      );
    }
    if (analysis.autoHold) {
      analysis.reasons.push(`Fraud score: ${analysis.baseScore}/100 - AUTO HOLD payout`);
    }

    // Log analysis for audit - ensure matchId is valid
    const matchId = match.id || 'UNKNOWN_MATCH';
    if (matchId && matchId !== 'UNKNOWN_MATCH') {
      await logFraudAnalysis(matchId, winnerUid, analysis);
    } else {
      console.warn('[FraudDetection] Match ID missing for fraud analysis logging');
    }
  } catch (error) {
    console.error('[FraudDetection] analyzeMatchForFraud error:', error);
  }

  return analysis;
}

/**
 * COLLUSION DETECTION (0-30 points)
 * Same opponent repeatedly? Both players colluding to generate fake wins?
 */
function analyzeCollusion(
  winnerUid: string,
  loserUid: string,
  winnerHistory: PlayerHistory,
  loserHistory: PlayerHistory
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Count how many times these players faced each other in last 10 matches
  const opponentMatchCount = winnerHistory.last10_opponents.filter(
    (opp) => opp === loserUid
  ).length;

  if (opponentMatchCount >= 5) {
    // Played each other 5+ times in last 10 matches
    score += 25;
    reasons.push(
      `Collusion risk HIGH: Same opponent ${opponentMatchCount}/10 recent matches`
    );
  } else if (opponentMatchCount >= 3) {
    score += 15;
    reasons.push(
      `Collusion risk MEDIUM: Same opponent ${opponentMatchCount}/10 recent matches`
    );
  } else if (opponentMatchCount >= 1) {
    score += 5;
    reasons.push(
      `Collusion risk LOW: Faced opponent ${opponentMatchCount}/10 recent matches`
    );
  }

  // Cross-check: Does loser have unusual loss pattern against this player?
  const loserAgainstWinner = loserHistory.last10_opponents.filter(
    (opp) => opp === winnerUid
  ).length;

  if (loserAgainstWinner >= 5) {
    score += 5;
    reasons.push(`Collusion risk: Loser also plays winner frequently (${loserAgainstWinner}/10)`);
  }

  return { score: Math.min(score, 30), reasons };
}

/**
 * WIN STREAK ANOMALY (0-25 points)
 * Sudden jump in win rate = could be account farming
 */
function analyzeWinStreakAnomaly(
  winnerHistory: PlayerHistory
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const weeklyWinRate = winnerHistory.weeklyWinRate;
  const allTimeWinRate = winnerHistory.winRate;

  // Big jump in win rate this week?
  const winRateDifference = weeklyWinRate - allTimeWinRate;

  if (weeklyWinRate > 0.9) {
    // 90%+ win rate this week
    score += 20;
    reasons.push(`Win streak anomaly: ${Math.round(weeklyWinRate * 100)}% weekly (>${Math.round(allTimeWinRate * 100)}% all-time)`);

    if (winnerHistory.weeklyMatchCount >= 10) {
      // Not just lucky 2-3 matches, but sustained over many matches
      score += 5;
      reasons.push(
        `Sustained high win rate: ${winnerHistory.weeklyMatchCount} matches this week`
      );
    }
  } else if (winRateDifference > 0.4 && weeklyWinRate > 0.7) {
    // Significant improvement (40+ percentage points)
    score += 15;
    reasons.push(
      `Win rate jumped ${Math.round(winRateDifference * 100)}% this week (from ${Math.round(allTimeWinRate * 100)}% to ${Math.round(weeklyWinRate * 100)}%)`
    );
  } else if (winRateDifference > 0.25 && weeklyWinRate > 0.65) {
    score += 8;
    reasons.push(
      `Win rate improved ${Math.round(winRateDifference * 100)}% this week`
    );
  }

  return { score: Math.min(score, 25), reasons };
}

/**
 * PLAY TIME ANOMALY (0-15 points)
 * Playing at 3am every day, 24/7 grinding?
 */
function analyzePlayTimeAnomaly(
  match: Match,
  playerHistory: PlayerHistory
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  const matchHour = new Date(match.createdAt).getHours();

  // Is player always playing at odd hours?
  if (matchHour >= 22 || matchHour <= 6) {
    // Playing at 10pm - 6am
    if (playerHistory.playtimeVariance < 3) {
      // Very consistent play times (within same 3-hour window)
      score += 10;
      reasons.push(
        `Abnormal play pattern: ${matchHour}:00 match, consistently plays odd hours (variance: ${playerHistory.playtimeVariance}h)`
      );
    } else {
      score += 3;
      reasons.push(`Odd hour play: ${matchHour}:00 (typical avg: ${playerHistory.averagePlayTimeHour}:00)`);
    }
  }

  // Is player playing CONSTANTLY (no sleep)?
  const timeSinceLastMatch = Date.now() - playerHistory.lastPlayedTimestamp;
  if (timeSinceLastMatch < 15 * 60 * 1000) {
    // Played again within last 15 minutes
    if (playerHistory.weeklyMatchCount > 50) {
      // 50+ matches in one week
      score += 5;
      reasons.push(`24/7 grinding pattern: ${playerHistory.weeklyMatchCount} matches this week`);
    }
  }

  return { score: Math.min(score, 15), reasons };
}

/**
 * SCORE PATTERN (0-15 points)
 * Always 10-5? Suspiciously consistent scores?
 */
function analyzeScorePattern(
  match: Match,
  playerHistory: PlayerHistory
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Count score variance in last 10 matches
  const scores = playerHistory.last10_scores;
  if (scores.length === 0) return { score: 0, reasons };

  // Calculate variance
  const avgs = scores.map((s) => (s.for + s.against) / 2);
  const variance =
    avgs.reduce((sum, val, _, arr) => sum + Math.pow(val - arr[0], 2), 0) / avgs.length;

  if (variance < 2) {
    // Very low score variance (almost identical scores)
    score += 12;
    reasons.push(
      `Suspicious score consistency: Variance ${variance.toFixed(2)} (scores always similar)`
    );
  } else if (variance < 5) {
    score += 6;
    reasons.push(`Score pattern: Low variance ${variance.toFixed(2)}`);
  }

  return { score: Math.min(score, 15), reasons };
}

/**
 * ACCOUNT ANOMALY (0-15 points)
 * New account with high win rate? Account purchased/boosted?
 */
function analyzeAccountAnomaly(
  playerHistory: PlayerHistory
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (playerHistory.accountAgeDays < 7) {
    // Brand new account (< 7 days)
    if (playerHistory.totalMatches > 20) {
      score += 12;
      reasons.push(
        `New account (${ playerHistory.accountAgeDays}d) with high activity (${playerHistory.totalMatches} matches)`
      );
    } else if (playerHistory.totalMatches > 10) {
      score += 8;
      reasons.push(
        `New account (${ playerHistory.accountAgeDays}d) with ${playerHistory.totalMatches} matches`
      );
    }

    // New account with high win rate?
    if (playerHistory.winRate > 0.8) {
      score += 5;
      reasons.push(
        `New account (${ playerHistory.accountAgeDays}d) with ${Math.round(playerHistory.winRate * 100)}% win rate`
      );
    }
  } else if (playerHistory.accountAgeDays < 30) {
    // Young account (< 30 days)
    if (playerHistory.winRate > 0.85) {
      score += 8;
      reasons.push(
        `Young account (${ playerHistory.accountAgeDays}d) with ${Math.round(playerHistory.winRate * 100)}% win rate`
      );
    }
  }

  return { score: Math.min(score, 15), reasons };
}

/**
 * Fetch or compute player's historical data
 */
async function getPlayerHistory(uid: string): Promise<PlayerHistory | null> {
  try {
    const userRef = adminDb.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) return null;

    const userData = userSnap.data() as any;

    // Fetch last 10 matches
    const matchesSnap = await adminDb
      .collection('matches')
      .where('playerIds', 'array-contains', uid)
      .where('status', 'in', ['CLOSED', 'COMPLETED'])
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();

    const matches = matchesSnap.docs.map((d) => d.data() as Match);

    // Extract opponent list and scores
    const last10_opponents: string[] = [];
    const last10_scores: Array<{ for: number; against: number }> = [];

    for (const match of matches) {
      const opponents = Object.keys(match.players).filter((p) => p !== uid);
      last10_opponents.push(...opponents);

      const playerData = (match.players as any)[uid];
      if (playerData) {
        last10_scores.push({
          for: playerData.scoreFor || playerData.kills || 0,
          against: playerData.scoreAgainst || 0
        });
      }
    }

    // Calculate weekly stats
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weeklyMatches = matches.filter((m) => m.createdAt > oneWeekAgo);
    const weeklyWins = weeklyMatches.filter((m) => m.championUid === uid).length;

    // Calculate play time statistics
    const playTimes = matches.map((m) => new Date(m.createdAt).getHours());
    const avgPlayTime = Math.round(playTimes.reduce((a, b) => a + b, 0) / playTimes.length || 0);
    const playTimeVariance = Math.sqrt(
      playTimes.reduce((sum, time) => sum + Math.pow(time - avgPlayTime, 2), 0) / playTimes.length
    );

    const totalMatches = userData.totalMatches || 0;
    const totalWins = userData.totalWins || 0;

    return {
      totalMatches,
      totalWins,
      winRate: totalMatches > 0 ? totalWins / totalMatches : 0,
      accountAgeDays: userData.createdAt
        ? Math.floor((Date.now() - userData.createdAt) / (24 * 60 * 60 * 1000))
        : 0,
      last10_opponents,
      last10_scores,
      weeklyWinRate: weeklyMatches.length > 0 ? weeklyWins / weeklyMatches.length : 0,
      weeklyMatchCount: weeklyMatches.length,
      lastPlayedTimestamp: matches[0]?.createdAt || 0,
      createdAtTimestamp: userData.createdAt || 0,
      averagePlayTimeHour: avgPlayTime,
      playtimeVariance: playTimeVariance
    };
  } catch (error) {
    console.error('[FraudDetection] getPlayerHistory error:', error);
    return null;
  }
}

/**
 * Log fraud analysis for audit trail
 */
async function logFraudAnalysis(
  matchId: string,
  playerUid: string,
  analysis: FraudAnalysis
): Promise<void> {
  try {
    const logRef = adminDb.collection('fraud_analysis_logs').doc();

    await logRef.set({
      matchId,
      playerUid,
      analysisScore: analysis.baseScore,
      flagged: analysis.flagged,
      autoHold: analysis.autoHold,
      riskFactors: analysis.riskFactors,
      reasons: analysis.reasons,
      analyzedAt: new Date().toISOString(),
      resolution: null // Set when admin reviews
    });
  } catch (error) {
    console.error('[FraudDetection] logFraudAnalysis error:', error);
  }
}

/**
 * Get fraud analysis summary for match
 */
export async function getFraudAnalysisSummary(matchId: string): Promise<FraudAnalysis | null> {
  try {
    const analysisSnap = await adminDb
      .collection('fraud_analysis_logs')
      .where('matchId', '==', matchId)
      .orderBy('analyzedAt', 'desc')
      .limit(1)
      .get();

    if (analysisSnap.empty) return null;

    const data = analysisSnap.docs[0].data() as any;
    return {
      baseScore: data.analysisScore,
      flagged: data.flagged,
      autoHold: data.autoHold,
      reasons: data.reasons,
      riskFactors: data.riskFactors
    };
  } catch (error) {
    console.error('[FraudDetection] getFraudAnalysisSummary error:', error);
    return null;
  }
}
