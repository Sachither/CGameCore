import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  runTransaction, 
  serverTimestamp, 
  increment,
  query,
  where,
  getDocs,
  getDoc,
  deleteDoc,
  onSnapshot,
  DocumentSnapshot,
  QuerySnapshot
} from "firebase/firestore";
import { db } from "./firebase";
import { 
  createMatchAction, 
  joinMatchAction, 
  leaveMatchAction, 
  submitMatchResultAction, 
  executeMatchClosureAction,
  registerChallengeInterestAction,
  setReadyStatusAction,
  respondToHostRoleAction,
  updateRoomCodeAction
} from "@/app/actions/match-actions";

export interface MatchPlayer {
  uid: string;
  username: string;
  avatarId: number;
  ready: boolean;
  team: 'alpha' | 'bravo';
  points?: number;
  wins?: number;
  draws?: number;
  losses?: number;
  goalsFor?: number;
  goalsAgainst?: number;
  claim?: 'WIN' | 'LOSS';
  proofUrl?: string;
  isHostCandidate?: boolean;
  isHost?: boolean;
  played?: number;
  inGameName?: string;
  scoreFor?: number;
  scoreAgainst?: number;
  kills?: number;
}

export interface Match {
  id?: string;
  game: 'CODM' | 'EFOOTBALL';
  format: '1v1' | '5v5' | 'br' | 'FFA' | 'alcatraz' | 'tournament' | 'league'; 
  duration?: '12m' | '15m' | 'NONE'; 
  challengeFee: number;
  status: 'WAITING' | 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_OPPONENT' | 'COMPLETED' | 'DISPUTED' | 'RESOLVING' | 'CLOSED';
  playerIds: string[]; // Added for efficient querying
  players: { [uid: string]: MatchPlayer };
  championUid: string | null;
  resolutionEndTime?: any; // Marks when the countdown expires
  hostUid?: string | null; // The player responsible for creating the in-game room
  creatorId: string;
  createdAt: any;
  leagueId?: string; // If this match belongs to a league
  round?: number;    // For tournament/league scheduling
  weaponClass?: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' | 'NONE'; // For CODM tactical duels
  maxPlayers?: number; // For FFA (3-8)
  rewardAmount?: number; // The payout credited to the winner
  resolvedAt?: any;     // When the match was finalized and paid out
  roomCode?: string;    // The in-game room code for joining
}

export interface League {
  id?: string;
  title: string;
  game: 'CODM' | 'EFOOTBALL';
  challengeFee: number;
  status: 'FILLING' | 'ACTIVE' | 'COMPLETED';
  playerIds: string[];
  players: { [uid: string]: MatchPlayer };
  createdAt: any;
  totalPool: number;
  playerCount?: number;
  quota?: number;
  format?: string;
}

/**
 * Get the current user's active match (if any)
 */
export const getUserActiveMatch = async (uid: string) => {
  const q = query(
    collection(db, "matches"),
    where("playerIds", "array-contains", uid)
  );
  
  const snap = await getDocs(q);
  const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED', 'WAITING_FOR_OPPONENT'];
  
  const activeMatch = snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Match))
    .find(m => activeStatuses.includes(m.status));
    
  return activeMatch || null;
};

/**
 * Listen to a user's active match changes
 */
export const subscribeToUserActiveMatch = (uid: string, callback: (match: Match | null) => void) => {
  const q = query(
    collection(db, "matches"),
    where("playerIds", "array-contains", uid)
  );

  return onSnapshot(q, (snap: QuerySnapshot) => {
    const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED', 'WAITING_FOR_OPPONENT'];
    const activeMatch = snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Match))
      .find(m => activeStatuses.includes(m.status));
    
    callback(activeMatch || null);
  }, (err: Error) => {
    console.error("Active Match Subscription Error:", err);
    callback(null);
  });
};

/**
 * Find an active WAITING match of a specific type to prevent singleton violations
 */
export const findActiveMatchByType = async (
  game: 'CODM' | 'EFOOTBALL', 
  format: string, 
  fee: number
): Promise<Match | null> => {
  const q = query(
    collection(db, "matches"),
    where("game", "==", game),
    where("format", "==", format),
    where("challengeFee", "==", fee),
    where("status", "==", "WAITING")
  );
  
  const snap = await getDocs(q);
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() } as Match;
};

/**
 * Create a new match with an initial vault deduction (SERVER-SIDE)
 */
export const createMatch = async (
  idToken: string,
  username: string, 
  avatarId: number, 
  game: 'CODM' | 'EFOOTBALL', 
  format: Match['format'], 
  challengeFee: number,
  inGameName: string,
  weaponClass: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' | 'NONE' = 'NONE',
  duration: '12m' | '15m' | 'NONE' = 'NONE',
  maxPlayers: number = 2
) => {
  // SINGLETON CHECK for 50/100 CR
  if (challengeFee <= 100) {
    const existing = await findActiveMatchByType(game, format, challengeFee);
    if (existing) {
       throw new Error(`A ${format.toUpperCase()} unit is already forming at this stake. Join them instead!`);
    }
  }

  const result = await createMatchAction(
    idToken, username, avatarId, game, format, challengeFee, inGameName, weaponClass, duration, maxPlayers
  );

  if (!result.success) throw new Error(result.error);
  return result.matchId;
};

/**
 * Join an existing match with fee deduction (SERVER-SIDE)
 */
export const joinMatch = async (
  idToken: string,
  username: string, 
  avatarId: number, 
  matchId: string,
  inGameName: string
) => {
  const result = await joinMatchAction(idToken, username, avatarId, matchId, inGameName);
  if (!result.success) throw new Error(result.error);
};

/**
 * Toggle ready status
 */
export const setReadyStatus = async (idToken: string, matchId: string, ready: boolean) => {
  const result = await setReadyStatusAction(idToken, matchId, ready);
  if (!result.success) throw new Error(result.error);
  return result.allReady;
};

/**
 * Handle match abandonment or cancellation (SERVER-SIDE)
 */
export const leaveMatch = async (idToken: string, matchId: string) => {
  const result = await leaveMatchAction(idToken, matchId);
  if (!result.success) throw new Error(result.error);
};

/**
 * Submit a claim for victory or loss (SERVER-SIDE)
 */
export const submitMatchResult = async (
  idToken: string, 
  matchId: string, 
  claim: 'WIN' | 'LOSS',
  proofUrl?: string
) => {
  const result = await submitMatchResultAction(idToken, matchId, claim, proofUrl);
  if (!result.success) throw new Error(result.error);
};

/**
 * Executes final match closure (SERVER-SIDE)
 */
export const executeMatchClosure = async (idToken: string, matchId: string) => {
  const result = await executeMatchClosureAction(idToken, matchId);
  if (!result.success) throw new Error(result.error);
};

/**
 * Admin or Auto-Resolve Match Reward
 * Uses a 20% platform commission since v2.0
 * Handles 50k threshold: <50k (100% to 1st), >=50k (75/25 split to 1st and 2nd)
 */
export const resolveMatch = async (matchId: string, championUid: string, loserUid?: string) => {
  const matchRef = doc(db, "matches", matchId);
  const winnerRef = doc(db, "users", championUid);

  await runTransaction(db, async (transaction) => {
    const matchSnap = await transaction.get(matchRef);
    const winnerSnap = await transaction.get(winnerRef);

    if (!matchSnap.exists() || !winnerSnap.exists()) throw new Error("Match or Champion not found.");
    
    const matchData = matchSnap.data() as Match;
    if (matchData.status === 'COMPLETED') return; 

    const playersCount = Object.keys(matchData.players).length;
    const totalPool = matchData.challengeFee * playersCount;
    const netPool = Math.floor(totalPool * 0.8); // 20% commission
    
    let victoryReward = netPool;
    const gameKey = matchData.game; // 'CODM' or 'EFOOTBALL'

    // 50k THRESHOLD RULE:
    // User requested: "lower than 50k only 1st place, higher than 50k 1 and 2nd place"
    if (netPool >= 50000 && loserUid) {
       // 75/25 Split for 1st and 2nd (No 3rd place as requested)
       victoryReward = Math.floor(netPool * 0.75);
       const runnerUpReward = Math.floor(netPool * 0.25);
       const runnerUpRef = doc(db, "users", loserUid);
       transaction.update(runnerUpRef, {
         balanceCoins: increment(runnerUpReward),
         totalMatches: increment(1),
         [`stats.${gameKey}.matches`]: increment(1)
       });
    }

    // 1. Grant reward to the champion and update global stats
    transaction.update(winnerRef, {
      balanceCoins: increment(victoryReward),
      totalWins: increment(1),
      totalMatches: increment(1),
      [`stats.${gameKey}.wins`]: increment(1),
      [`stats.${gameKey}.matches`]: increment(1)
    });

    if (loserUid && netPool < 50000) {
      const loserRef = doc(db, "users", loserUid);
      transaction.update(loserRef, {
        totalMatches: increment(1),
        [`stats.${gameKey}.matches`]: increment(1)
      });
    }

    // 2. Mark match as completed
    transaction.update(matchRef, {
      status: 'COMPLETED',
      championUid: championUid,
      rewardAmount: victoryReward,
      resolvedAt: serverTimestamp()
    });

    // 3. IF THIS IS A LEAGUE MATCH, UPDATE STANDINGS
    if (matchData.leagueId) {
      const leagueRef = doc(db, "leagues", matchData.leagueId);
      
      const leagueUpdates: Record<string, any> = {
        [`players.${championUid}.points`]: increment(3),
        [`players.${championUid}.wins`]: increment(1),
        [`players.${championUid}.played`]: increment(1),
        [`players.${championUid}.goalsFor`]: increment(matchData.players[championUid].goalsFor || 0),
        [`players.${championUid}.goalsAgainst`]: increment(matchData.players[championUid].goalsAgainst || 0),
      };

      if (loserUid) {
        leagueUpdates[`players.${loserUid}.losses`] = increment(1);
        leagueUpdates[`players.${loserUid}.played`] = increment(1);
        leagueUpdates[`players.${loserUid}.goalsFor`] = increment(matchData.players[loserUid].goalsFor || 0);
        leagueUpdates[`players.${loserUid}.goalsAgainst`] = increment(matchData.players[loserUid].goalsAgainst || 0);
      }

      transaction.update(leagueRef, leagueUpdates);
    }
  });
};

/**
 * Flag a match for manual review
 */
export const disputeMatch = async (matchId: string) => {
  const matchRef = doc(db, "matches", matchId);
  await updateDoc(matchRef, {
    status: 'DISPUTED'
  });
};

/**
 * --- COMBAT INTEREST (HIGH-STAKES WAITLIST) ---
 */

export interface ChallengeInterest {
  id?: string;
  uid: string;
  username: string;
  avatarId: number;
  game: 'CODM' | 'EFOOTBALL';
  segment: '1v1' | '5v5' | 'br' | 'ffa' | 'league';
  fee: number;
  expiresAt: any;
}

/**
 * Register interest in a high-stakes challenge (SERVER-SIDE)
 */
export const registerChallengeInterest = async (
  idToken: string,
  username: string,
  avatarId: number, 
  game: 'CODM' | 'EFOOTBALL', 
  segment: '1v1' | '5v5' | 'br' | 'ffa' | 'league', 
  fee: number = 500,
  inGameName?: string
) => {
  const result = await registerChallengeInterestAction(idToken, username, avatarId, game, segment, fee, inGameName);
  if (!result.success) throw new Error(result.error);
  return result; // Return the full result including matchId if created
};



/**
 * Get current waitlist count
 */
export const getChallengeInterestCount = async (game: string, segment: string) => {
  const queueId = `${game.toLowerCase()}_${segment}`;
  const queueRef = doc(db, "queues", queueId);
  const snap = await getDoc(queueRef);
  
  if (!snap.exists()) return 0;
  return (snap.data()?.playerIds || []).length;
};

/**
 * --- COD COMBAT HUB PROTOCOLS (HOST ASSIGNMENT) ---
 */

/**
 * Picks a random player to be the 'Candidate' for hosting the game room.
 */
export const designateRandomHostCandidate = async (matchId: string) => {
  const matchRef = doc(db, "matches", matchId);
  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(matchRef);
    if (!snap.exists()) return;
    const match = snap.data() as Match;
    
    // Pick lucky winner
    const players = Object.values(match.players);
    const candidate = players[Math.floor(Math.random() * players.length)];
    
    transaction.update(matchRef, {
      [`players.${candidate.uid}.isHostCandidate`]: true
    });
  });
};

/**
 * Handles the response from a Host Candidate.
 */
export const respondToHostRole = async (idToken: string, matchId: string, action: 'ACCEPT' | 'PASS') => {
  const result = await respondToHostRoleAction(idToken, matchId, action);
  if (!result.success) throw new Error(result.error);
};

/**
 * --- LEAGUE ENGINE (ROUND ROBIN SCHEDULER) ---
 */

export const generateLeagueFixtures = async (leagueId: string, uids: string[], players: { [uid: string]: MatchPlayer }, game: any, fee: number) => {
  const n = uids.length;
  const rounds = n - 1;
  const matchesPerRound = n / 2;
  const fixtures: any[] = [];

  const participants = [...uids];

  for (let r = 0; r < rounds; r++) {
    for (let m = 0; m < matchesPerRound; m++) {
      const p1 = participants[m];
      const p2 = participants[n - 1 - m];

      fixtures.push({
        game,
        format: '1v1',
        challengeFee: 0, 
        status: 'WAITING',
        leagueId,
        round: r + 1,
        players: {
          [p1]: { ...players[p1], ready: false },
          [p2]: { ...players[p2], ready: false }
        },
        playerIds: [p1, p2],
        creatorId: p1,
        createdAt: serverTimestamp()
      });
    }

    const last = participants.pop()!;
    participants.splice(1, 0, last);
  }

  for (const f of fixtures) {
    await addDoc(collection(db, "matches"), f);
  }

  await updateDoc(doc(db, "leagues", leagueId), { status: 'ACTIVE' });

  console.log(`[LeagueEngine] Generated ${fixtures.length} fixtures for League ${leagueId}`);
};

/**
 * --- ROOM CODE UPLINK ---
 */

/**
 * Persists a room code to the match document (HOST ONLY)
 */
export const updateRoomCode = async (idToken: string, matchId: string, roomCode: string) => {
  const result = await updateRoomCodeAction(idToken, matchId, roomCode);
  if (!result.success) throw new Error(result.error);
};
