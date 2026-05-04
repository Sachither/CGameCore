import admin from "firebase-admin";
import { adminDb } from "@/lib/firebase-admin";
import { EngineCircuit, EngineMatch, EnginePlayer } from "./types";
import { pushMatchNotification, pushGlobalCommand } from "./progression";
import { getSystemConfig } from "@/lib/system-config-server";

/**
 * INITIALIZATION: Create a new Circuit (Master or Elite) from a lobby
 */
export async function initializeCircuit(
   transaction: admin.firestore.Transaction,
   matchRef: admin.firestore.DocumentReference,
   matchData: EngineMatch,
   playersList: EnginePlayer[],
   uid: string
) {
   const config = await getSystemConfig();
   const circuitRef = adminDb.collection("circuits").doc();
   const circuitId = circuitRef.id;
   
   const allPlayers = playersList;
   if (matchData.circuitId || matchData.status === 'CLOSED' || matchData.status === 'RESOLVING') {
      console.warn("[Engine] Attempted re-initialization of an active or resolved combat sector. Aborting.");
      return matchData.circuitId || null;
   }
   
   const shuffled = [...allPlayers].sort(() => Math.random() - 0.5);
   const fee = matchData.challengeFee || 0;
   // Deduplicate players by UID
   const uniquePlayers = allPlayers.filter((player, index, arr) => arr.findIndex(p => p.uid === player.uid) === index);
   const pCount = uniquePlayers.length;

   // Build fresh players map from the unique list to avoid stale snapshot data
   const playersMap: Record<string, any> = {};
   uniquePlayers.forEach(p => {
      playersMap[p.uid] = { ...p, ready: true };
   });

   // Validate player counts (2, 4, 8, 16)
   const allowedCounts = [2, 4, 8, 16];
   if (!allowedCounts.includes(pCount)) {
      throw new Error(`Tournament scaling error: Supported counts are 2, 4, 8, or 16 players. Got ${pCount}.`);
   }

   const isLeague = matchData.format === 'league';
   const format = isLeague ? `${pCount}_LEAGUE` : `${pCount}_TOURNAMENT`;
   const totalPool = Math.floor(fee * pCount * (1 - config.matchFeePercentage));

   // HQ BROADCAST: Tournament Start
   pushGlobalCommand(transaction, circuitId, `INITIALIZING SECTOR OPS: ${format.toUpperCase()} DEPLOYMENT CONFIRMED. Prize pool locked: ${totalPool} CR.`);

   // TACTICAL EXPIRY: 30 mins for League rounds, 3h for standard tournaments
   const expiresAt = isLeague 
      ? new Date(Date.now() + 30 * 60 * 1000) 
      : new Date(Date.now() + 3 * 3600 * 1000); 
   
   if (isLeague) {
      // LEAGUE INITIALIZATION (Round Robin - Circle Method)
      const pool = [...shuffled];
      if (pool.length % 2 !== 0) pool.push(null as any); // Bye player if odd
      
      const numRounds = pool.length - 1;
      const numMatchesPerRound = pool.length / 2;
      const leagueMatches: any[] = [];

      for (let r = 0; r < numRounds; r++) {
         const roundNumber = r + 1;
         for (let m = 0; m < numMatchesPerRound; m++) {
            const p1 = pool[m];
            const p2 = pool[pool.length - 1 - m];
            
            if (p1 && p2) {
               const mRef = adminDb.collection("matches").doc();
               transaction.set(mRef, {
                  game: matchData.game, format: 'league', challengeFee: 0, 
                  status: roundNumber === 1 ? 'WAITING' : 'SCHEDULED',
                  circuitId, round: 'LEAGUE', roundNumber, 
                  group: matchData.group || 'NONE',
                  playerIds: [p1.uid, p2.uid], gatheringRoomId: matchRef.id,
                  expiresAt,
                  players: {
                     [p1.uid]: { ...p1, ready: false, team: 'alpha' },
                     [p2.uid]: { ...p2.uid === p1.uid ? { ...p2, uid: p2.uid + '_alt' } : p2, ready: false, team: 'bravo' } 
                  },
                  creatorId: matchData.creatorId || uid, 
                  isPartnerTournament: !!matchData.isPartnerTournament,
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
               });

               leagueMatches.push({ id: mRef.id, p1, p2, roundNumber });

               [p1, p2].forEach(p => {
                  const opp = p.uid === p1.uid ? p2 : p1;
                  pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, `Round ${roundNumber}`, "30 Minutes");
               });
            }
         }
         // Rotate pool (keep first element fixed)
         pool.splice(1, 0, pool.pop()!);
      }

      // Initialize Standings
      const leagueStandings: Record<string, any> = {};
      uniquePlayers.forEach(p => {
         leagueStandings[p.uid] = {
            uid: p.uid,
            username: p.username,
            avatarId: p.avatarId,
            played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0, pts: 0
         };
      });

      transaction.set(circuitRef, {
         title: `${matchData.game} ELITE LEAGUE #${circuitId.slice(0, 4)}`,
         game: matchData.game, format, challengeFee: fee, 
         status: 'LEAGUE_ACTIVE',
         playerIds: uniquePlayers.map(p => p.uid),
         players: playersMap, 
         totalPool,
         creatorId: matchData.creatorId || uid,
         isPartnerTournament: !!matchData.isPartnerTournament,
         partnerName: matchData.partnerName || 'Partner',
         quota: pCount,
         createdAt: admin.firestore.FieldValue.serverTimestamp(),
         expiresAt,
         matchesCompleted: 0,
         totalMatches: leagueMatches.length,
         currentRound: 1,
         roundSchedule: leagueMatches.reduce((acc, m) => {
            acc[m.roundNumber] = acc[m.roundNumber] || [];
            acc[m.roundNumber].push(m.id);
            return acc;
         }, {}),
         standings: leagueStandings,
         isTestMode: !!matchData.isTestMode
      });

      return circuitId;
   }

   let initialRound = 'QR1';
   let pairsCount = 8;

   if (pCount === 2) { initialRound = 'FINAL'; pairsCount = 1; }
   else if (pCount === 4) { initialRound = 'SF'; pairsCount = 2; }
   else if (pCount === 8) { initialRound = 'QF'; pairsCount = 4; }

   // SEEDING
   for (let i = 0; i < pairsCount; i++) {
      const p1 = shuffled[i * 2];
      const p2 = shuffled[i * 2 + 1];
      const mRef = adminDb.collection("matches").doc();
      transaction.set(mRef, {
         game: matchData.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
         circuitId, round: initialRound, leg: 'NONE', playerIds: [p1.uid, p2.uid], gatheringRoomId: matchRef.id,
         expiresAt,
         players: {
            [p1.uid]: { ...p1, ready: false, team: 'alpha' },
            [p2.uid]: { ...p2, ready: false, team: 'bravo' }
         },
         creatorId: matchData.creatorId || uid, 
         isPartnerTournament: !!matchData.isPartnerTournament,
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      [p1, p2].forEach(p => {
         const opp = p.uid === p1.uid ? p2 : p1;
         pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, initialRound, "3 Hours");
      });
   }

   transaction.set(circuitRef, {
      title: `${matchData.game} ELITE SERIES #${circuitId.slice(0, 4)}`,
      game: matchData.game, format, challengeFee: fee, 
      status: pCount === 2 ? 'KNOCKOUT_F' : (pCount === 4 ? 'KNOCKOUT_S' : (pCount === 8 ? 'KNOCKOUT_Q' : 'KNOCKOUT_Q')),
      playerIds: uniquePlayers.map(p => p.uid),
      players: playersMap, 
      totalPool,
      creatorId: matchData.creatorId || uid,
      isPartnerTournament: !!matchData.isPartnerTournament,
      partnerName: matchData.partnerName || 'Partner',
      quota: pCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt,
      matchesCompleted: 0,
      isTestMode: !!matchData.isTestMode
   });

   return circuitId;
}
