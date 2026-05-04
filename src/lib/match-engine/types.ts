import admin from "firebase-admin";

export interface EnginePlayer {
   uid: string;
   username: string;
   ready: boolean;
   team: 'alpha' | 'bravo';
   scoreFor?: number;
   scoreAgainst?: number;
   [key: string]: any;
}

export interface EngineMatch {
   id?: string;
   game: string;
   format: string;
   status: string;
   playerIds: string[];
   players: { [uid: string]: EnginePlayer };
   circuitId?: string;
   round?: string;
   group?: string;
   leg?: number | 'NONE';
   expiresAt?: admin.firestore.Timestamp | Date;
   isTestMode?: boolean;
   [key: string]: any;
}

export interface EngineTie {
   p1: string;
   p2: string;
   matchId1?: string;
   matchId2?: string;
   matchId3?: string;
   leg1Finished?: boolean;
   leg2Finished?: boolean;
   leg3Finished?: boolean;
   p1Goals_leg1?: number;
   p2Goals_leg1?: number;
   p1Goals_leg2?: number;
   p2Goals_leg2?: number;
   winner?: string;
}

export interface EngineCircuit {
   id?: string;
   format: '16_TOURNAMENT';
   status: string;
   playerIds: string[];
   players: { [uid: string]: EnginePlayer };
   matchesCompleted: number;
   expiresAt?: admin.firestore.Timestamp | Date;
   round1Winners?: string[];
   qfWinners?: string[];
   sfWinners?: string[];
   winnerUid?: string;
   runnerUpUid?: string;
   isTestMode?: boolean;
   [key: string]: any;
}
