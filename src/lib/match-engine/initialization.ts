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

   const isLeague = matchData.format === 'league';
   // Validate player counts
   const allowedCounts = isLeague ? [2, 4, 8, 10, 16, 32] : [2, 4, 8, 16, 32];
   if (!allowedCounts.includes(pCount)) {
      throw new Error(`Tournament scaling error: Supported counts are ${isLeague ? '2, 4, 8, 10, 16, or 32' : '2, 4, 8, 16, or 32'} players. Got ${pCount}.`);
   }

   const format = isLeague ? `${pCount}_LEAGUE` : `${pCount}_TOURNAMENT`;
   const totalPool = Math.floor(fee * pCount * (1 - config.matchFeePercentage));
   
   // TEST MODE: Use 3 minutes instead of 24 hours for faster testing
   const isTestMode = matchData.isTestMode || process.env.NEXT_PUBLIC_TEST_MODE === 'true';
   const expiryHours = isTestMode ? 0.05 : 24; // 0.05 hours = 3 minutes; 24 hours for production
   const timerDisplay = isTestMode ? '3 Minutes' : '24 Hours'; // Display text for notifications

   // HQ BROADCAST: Tournament Start
   pushGlobalCommand(transaction, circuitId, `INITIALIZING SECTOR OPS: ${format.toUpperCase()} DEPLOYMENT CONFIRMED. Prize pool locked: ${totalPool} CR.`);

   // TACTICAL EXPIRY: Each match gets its own expiry time based on round to prevent cascade failures
   
   if (isLeague) {
      // LEAGUE INITIALIZATION (Round Robin - Circle Method)
      const pool = [...shuffled];
      if (pool.length % 2 !== 0) pool.push(null as any); // Bye player if odd
      
      const numRounds = pool.length - 1;
      const numMatchesPerRound = pool.length / 2;
      const leagueMatches: any[] = [];

      for (let r = 0; r < numRounds; r++) {
         const roundNumber = r + 1;
         // Only Round 1 matches get immediate expiry
         // Scheduled matches (Round 2+) get expiresAt set when they're activated
         const matchExpiresAt = roundNumber === 1 ? new Date(Date.now() + 3600 * 1000 * expiryHours) : null;
         
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
                  ...(matchExpiresAt && { expiresAt: matchExpiresAt }),
                  players: {
                     [p1.uid]: { ...p1, ready: false, team: 'alpha' },
                     [p2.uid]: { ...p2.uid === p1.uid ? { ...p2, uid: p2.uid + '_alt' } : p2, ready: false, team: 'bravo' } 
                  },
                  creatorId: matchData.creatorId || uid, 
                  isPartnerTournament: !!matchData.isPartnerTournament,
                  createdAt: admin.firestore.FieldValue.serverTimestamp()
               });

               leagueMatches.push({ id: mRef.id, p1, p2, roundNumber });

               // Only notify active (Round 1) matches with timer; scheduled matches notified separately when activated
               if (roundNumber === 1) {
                  [p1, p2].forEach(p => {
                     const opp = p.uid === p1.uid ? p2 : p1;
                     pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, `Round ${roundNumber}`, timerDisplay);
                  });
               }
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

      // League container expiry is when all rounds complete
      const leagueExpiresAt = new Date(Date.now() + (3600 * 1000 * expiryHours) * numRounds);
      
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
         expiresAt: leagueExpiresAt,
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
   let initialStatus = 'KNOCKOUT_Q';

   if (pCount === 32) {
      initialRound = 'R32';
      pairsCount = 16;
      initialStatus = 'KNOCKOUT_R32';
   } else if (pCount === 16) {
      initialRound = 'QR1';
      pairsCount = 8;
      initialStatus = 'KNOCKOUT_Q';
   } else if (pCount === 8) {
      initialRound = 'QF';
      pairsCount = 4;
      initialStatus = 'KNOCKOUT_Q';
   } else if (pCount === 4) {
      initialRound = 'SF';
      pairsCount = 2;
      initialStatus = 'KNOCKOUT_S';
   } else if (pCount === 2) {
      initialRound = 'FINAL';
      pairsCount = 1;
      initialStatus = 'KNOCKOUT_F';
   }

   // Tournament expiry: 24 hours from now
   const tournamentExpiresAt = new Date(Date.now() + 3600 * 1000 * expiryHours);

   // SEEDING
   for (let i = 0; i < pairsCount; i++) {
      const p1 = shuffled[i * 2];
      const p2 = shuffled[i * 2 + 1];
      const mRef = adminDb.collection("matches").doc();
      transaction.set(mRef, {
         game: matchData.game, format: 'tournament', challengeFee: 0, status: 'WAITING',
         circuitId, round: initialRound, leg: 'NONE', playerIds: [p1.uid, p2.uid], gatheringRoomId: matchRef.id,
         expiresAt: tournamentExpiresAt,
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
         pushMatchNotification(transaction, p.uid, opp.uid, opp.username, mRef.id, initialRound, timerDisplay);
      });
   }

   transaction.set(circuitRef, {
      title: `${matchData.game} ELITE SERIES #${circuitId.slice(0, 4)}`,
      game: matchData.game, format, challengeFee: fee, 
      status: initialStatus,
      playerIds: uniquePlayers.map(p => p.uid),
      players: playersMap, 
      totalPool,
      creatorId: matchData.creatorId || uid,
      isPartnerTournament: !!matchData.isPartnerTournament,
      partnerName: matchData.partnerName || 'Partner',
      quota: pCount,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: tournamentExpiresAt,
      matchesCompleted: 0,
      isTestMode: isTestMode
   });

   return circuitId;
}
