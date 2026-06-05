import { EngineCircuit as Circuit, EngineTie as CircuitTie } from "./match-engine/types";

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
  format: '1v1' | 'br' | 'FFA' | 'ffa' | 'alcatraz' | 'tournament' | 'league'; 
  duration?: '12m' | '15m' | 'NONE'; 
  challengeFee: number;
  status: 'WAITING' | 'READY' | 'IN_PROGRESS' | 'WAITING_FOR_OPPONENT' | 'COMPLETED' | 'DISPUTED' | 'RESOLVING' | 'CLOSED' | 'SCHEDULED';
  playerIds: string[]; 
  players: { [uid: string]: MatchPlayer };
  championUid: string | null;
  resolutionEndTime?: any; 
  hostUid?: string | null; 
  creatorId: string;
  createdAt: any;
  weaponClass?: 'ALL GUNS' | 'SHOTGUN' | 'SNIPER' | 'NONE'; 
  maxPlayers?: number; 
  rewardAmount?: number; 
  resolvedAt?: any;     
  roomCode?: string;    
  roomName?: string;
  roomPassword?: string;
  isProtected?: boolean;
  isRanked?: boolean;
  circuitId?: string;   
  leagueId?: string;    
  round?: 'QR1' | 'QR2' | 'QF' | 'SF' | 'FINAL' | 'NONE' | 'QF TIE-BREAKER' | 'SF TIE-BREAKER' | 'LEAGUE' | string; 
  group?: 'A' | 'B' | 'C' | 'D' | 'NONE' | string;
  expiresAt?: any;     
  readyDeadline?: string | null;
  readyDeadlineDisabled?: boolean;
  leg?: 1 | 2 | 3 | 'NONE'; 
  adminAlert?: boolean;
  adminAlertAt?: any;
  isPromo?: boolean;
  promoId?: string;
  isPartnerTournament?: boolean;
  isTestMode?: boolean;
  partnerName?: string;
  overseers?: { [uid: string]: any };
  isGauntlet?: boolean;
}

export interface ChallengeInterest {
  id?: string;
  uid: string;
  username: string;
  avatarId: number;
  game: 'CODM' | 'EFOOTBALL';
  segment: '1v1' | 'br' | 'ffa' | 'tournament' | 'alcatraz';
  fee: number;
  expiresAt: any;
}

export interface GauntletState {
  active: boolean;
  game: 'CODM' | 'EFOOTBALL';
  targetWins: number;
  currentWins: number;
}

export type { Circuit, CircuitTie };
