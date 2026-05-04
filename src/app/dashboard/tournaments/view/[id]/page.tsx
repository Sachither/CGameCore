"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, query, collection, where, limit, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Circuit, Match } from "@/lib/match-service";
import CircuitWarRoom from "@/components/dashboard/CircuitWarRoom";
import { Loader2, ShieldAlert, ChevronLeft } from "lucide-react";
import Link from "next/link";

export default function WarRoomPage() {
  const { id } = useParams();
  const { user, idToken } = useAuth();
  const router = useRouter();

  const [competition, setCompetition] = useState<Circuit | null>(null);
  const [nextMatch, setNextMatch] = useState<Match | null>(null);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [playerStatus, setPlayerStatus] = useState<{ isQualified: boolean, isEliminated: boolean, played: number, max: number }>({ isQualified: false, isEliminated: false, played: 0, max: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !user) return;

    let unsubCompetition: (() => void) | null = null;
    let unsubMatches: (() => void) | null = null;

    const syncCompetition = async () => {
      setLoading(true);
      setError(null);

      try {
        // Deterministic Detection: Check leagues FIRST, then circuits
        const leagueRef = doc(db, "leagues", id as string);
        const circuitRef = doc(db, "circuits", id as string);
        
        let targetRef = leagueRef;
        try {
          const leagueSnap = await getDoc(leagueRef);
          if (!leagueSnap.exists()) {
            const circuitSnap = await getDoc(circuitRef);
            if (circuitSnap.exists()) {
              targetRef = circuitRef;
            } else {
               setError("Tactical data missing for this sector.");
               setLoading(false);
               return;
            }
          }
        } catch (docErr: any) {
          // If permission denied on first try, that's ok - we'll get it via onSnapshot
          if (docErr.code !== 'permission-denied') {
            throw docErr;
          }
          // Continue anyway - the onSnapshot will handle permissions properly
        }

        // Single Stable Listener
        unsubCompetition = onSnapshot(targetRef, (snap) => {
          if (snap.exists()) {
            setCompetition({ id: snap.id, ...snap.data() } as any);
            setLoading(false);
            setError(null);
          } else {
            setError("Tactical data sync lost.");
            setLoading(false);
          }
        }, (err: any) => {
          console.error("Combat Sync Error:", err);
          // Handle permission errors gracefully
          if (err.code === 'permission-denied') {
            setError("Access restricted. You may not have permission to view this war room.");
          } else {
            setError(`Neural Link Failure: ${err.message}`);
          }
          setLoading(false);
        });

      } catch (err: any) {
        console.error("Neural Link Failure:", err);
        setError(`Access Denied: ${err.message}`);
        setLoading(false);
      }
    };

    syncCompetition();

    // 2. Sync All Matches for this Tournament (Circuit or League)
    const qMatches = query(
      collection(db, "matches"),
      where("circuitId", "==", id as string),
      limit(100)
    );

    const qLeagueMatches = query(
      collection(db, "matches"),
      where("leagueId", "==", id as string),
      limit(100)
    );

    // 2. Sync All Matches for this Circuit/League
    const circuitUnsub = onSnapshot(qMatches, (circuitSnap) => {
      const circuitMatches = circuitSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      updateMatches(circuitMatches, leagueMatches);
    });

    const leagueUnsub = onSnapshot(qLeagueMatches, (leagueSnap) => {
      const leagueMatches = leagueSnap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      updateMatches(circuitMatches, leagueMatches);
    });

    // Helper function to combine and filter matches
    let circuitMatches: Match[] = [];
    let leagueMatches: Match[] = [];
    
    const updateMatches = (newCircuitMatches: Match[], newLeagueMatches: Match[]) => {
      circuitMatches = newCircuitMatches;
      leagueMatches = newLeagueMatches;
      
      // Combine and deduplicate matches
      const allMatches = [...circuitMatches, ...leagueMatches];
      const uniqueMatches = allMatches.filter((match, index, self) => 
        index === self.findIndex(m => m.id === match.id)
      );
      
      // Filter to only include tournament matches - STRICT filtering by competition type
      let tournamentMatches: Match[] = [];
      
      if (competition) {
        const fmt = (competition as any).format || '';
        const isNewLeague = fmt.includes('LEAGUE');
        const isCircuit = fmt === 'MASTER_CIRCUIT' || fmt === '16_TOURNAMENT' || isNewLeague;
        
        if (isCircuit) {
          // For circuits & new leagues, use circuitId matches
          tournamentMatches = uniqueMatches.filter(m => 
            m.circuitId === id && 
            (m.format === 'tournament' || m.format === 'league' || m.round)
          );
        } else {
          // Legacy support for leagues using leagueId
          tournamentMatches = uniqueMatches.filter(m => 
            m.leagueId === id && 
            (m.format === 'tournament' || m.round)
          );
        }
      } else {
        // Fallback: use both but prioritize circuitId for tournaments
        tournamentMatches = uniqueMatches.filter(m => 
          (m.circuitId === id || m.leagueId === id) && 
          (m.format === 'tournament' || m.round) // Only tournament format or matches with rounds
        );
      }
      
      setAllMatches(tournamentMatches);
    };

    unsubMatches = () => {
      circuitUnsub();
      leagueUnsub();
    };

    return () => {
      unsubCompetition?.();
      unsubMatches?.();
    };
  }, [id, user]);

  // --- NEW: HARDEEND STANDINGS & PROGRESSION ENGINE ---
  useEffect(() => {
    if (!competition || !user) return;

    const fmt = (competition as any).format || '';
    const isMaster = fmt === 'MASTER_CIRCUIT';
    const isKnockout = fmt === '16_TOURNAMENT';
    const isNewLeague = fmt.includes('LEAGUE');
    const pCount = parseInt(fmt.split('_')[0]) || 0;
    const max = isNewLeague ? (pCount - 1) : (isMaster ? 2 : (isKnockout ? 1 : 0));
    
    let played = 0;
    let qualified = false;
    let eliminated = false;

    // 1. Calculate Status
    const currentPhase = (competition as any).status;
    const isGroupsPhase = currentPhase === 'GROUPS' || currentPhase === 'FILLING' || currentPhase === 'ACTIVE' || currentPhase === 'LEAGUE_ACTIVE';

    if (isNewLeague && (competition as any).standings) {
       const myStats = (competition as any).standings[user.uid];
       if (myStats) {
          played = myStats.played || 0;
          // In a league, you are only "eliminated" or "qualified" at the very end
          // For now, we show them as "Active" (qualified=false, eliminated=false)
       }
    } else if (isGroupsPhase && isMaster && (competition as any).groups) {
      const groupEntry = Object.entries((competition as any).groups).find(([_, g]: any) => g.playerIds.includes(user.uid));
      if (groupEntry) {
        const [gCode, gData]: [string, any] = groupEntry;
        const myStats = gData.standings[user.uid];
        if (myStats) {
          played = myStats.played || 0;
          if (played >= max) {
             const sortedStandings = Object.entries(gData.standings)
               .map(([id, s]: any) => ({ id, ...s }))
               .sort((a,b) => (b.pts||0) - (a.pts||0) || ((b.gf||0)-(b.ga||0)) - ((a.gf||0)-(a.ga||0)));
             
             const myRank = sortedStandings.findIndex(s => s.id === user.uid) + 1;
             if (myRank <= 2) qualified = true;
             else eliminated = true;
          }
        }
      }
    } else if (!isGroupsPhase) {
       // --- KNOCKOUT PHASE STATUS ---
       // For 16_TOURNAMENT at KNOCKOUT_Q phase, prioritize QF if player has advanced
       if (isKnockout && currentPhase === 'KNOCKOUT_Q') {
          // First check if player has advanced to QF
          const myQFMatch = allMatches.find(m =>
            m.playerIds?.includes(user.uid) &&
            (m.round === 'QF' || m.round === 'QF TIE-BREAKER')
          );
          
          if (myQFMatch) {
             // Player is in QF - evaluate QF result
             if (myQFMatch.status === 'CLOSED' || myQFMatch.status === 'COMPLETED') {
                if (myQFMatch.championUid === user.uid) {
                   qualified = true;
                } else {
                   eliminated = true;
                }
                played = 2;
             } else {
                // QF match in progress
                qualified = false;
                eliminated = false;
                played = 2;
             }
          } else {
             // Not in QF yet, check R16
             const myR16Match = allMatches.find(m =>
               m.playerIds?.includes(user.uid) &&
               ['QR1', 'QR2', 'R16'].includes(m.round || '')
             );
             
             if (myR16Match) {
                if (myR16Match.status === 'CLOSED' || myR16Match.status === 'COMPLETED') {
                   if (myR16Match.championUid === user.uid) {
                      qualified = true;
                   } else {
                      eliminated = true;
                   }
                   played = 1;
                } else {
                   // R16 match in progress
                   qualified = false;
                   eliminated = false;
                }
             } else {
                // R16 match may not have spawned yet
                qualified = false;
                eliminated = false;
             }
          }
       } else {
          // For other knockout rounds (QF, SF, FINAL)
          const targetRound = currentPhase === 'KNOCKOUT_Q' ? 'QF' : currentPhase === 'KNOCKOUT_S' ? 'SF' : 'FINAL';
          const myMatches = allMatches.filter(m => m.playerIds?.includes(user.uid) && (m.round === targetRound || m.round === `${targetRound} TIE-BREAKER`));
          
          if (myMatches.length === 0) {
             // Check if I even qualified for this phase
             const bracket = (competition as any).bracket;
             const isInQF = bracket?.quarters?.some((t: any) => t.p1 === user.uid || t.p2 === user.uid);
             const isInSF = bracket?.semis?.some((t: any) => t.p1 === user.uid || t.p2 === user.uid);
             const isInFI = bracket?.final?.matchId1 && allMatches.find(m => m.id === bracket.final.matchId1)?.playerIds?.includes(user.uid);

             if (!isInQF && !isInSF && !isInFI) eliminated = true;
             else qualified = true; // In bracket but match not found yet? (Holding)
          } else {
             const allClosed = myMatches.every(m => m.status === 'CLOSED' || m.status === 'COMPLETED');
             if (allClosed) {
                const bracket = (competition as any).bracket;
                let winnerId = null;
                if (targetRound === 'QF') {
                    winnerId = bracket?.quarters?.find((t: any) => t.p1 === user.uid || t.p2 === user.uid)?.winner;
                } else if (targetRound === 'SF') {
                    winnerId = bracket?.semis?.find((t: any) => t.p1 === user.uid || t.p2 === user.uid)?.winner;
                } else {
                    winnerId = bracket?.final?.winner;
                }

                if (winnerId) {
                   if (winnerId === user.uid) qualified = true;
                   else eliminated = true;
                } else {
                   // Engine still deciding / tie-breaker spawning
                   qualified = false;
                   eliminated = false;
                }
             } else {
                // Mission in progress
                qualified = false;
                eliminated = false;
             }
          }
       }
    } else if (isKnockout || (competition as any).format === 'PROMO_TOURNAMENT') {
       // PROMO or Standard Knockout Check
       const isPromo = (competition as any).format === 'PROMO_TOURNAMENT';
       
       if (isPromo) {
          // Promo format tracks winners explicitly
          const currentWinners = (competition as any).roundWinners || [];
          const myLatestMatch = allMatches
             .filter(m => m.playerIds?.includes(user.uid) && (m.status === 'CLOSED' || m.status === 'COMPLETED'))
             .sort((a,b) => {
                const aTime = (a.resolvedAt as any)?.seconds || (a.createdAt as any)?.seconds || 0;
                const bTime = (b.resolvedAt as any)?.seconds || (b.createdAt as any)?.seconds || 0;
                return bTime - aTime;
             })[0];
             
          if (myLatestMatch) {
             played = allMatches.filter(m => m.playerIds?.includes(user.uid) && (m.status === 'CLOSED' || m.status === 'COMPLETED')).length;
             // If I won my latest match or if I got a bye, I'm qualified
             if (myLatestMatch.championUid === user.uid || (competition as any).byePlayer === user.uid) {
                qualified = true;
             } else {
                eliminated = true;
             }
          } else {
             // Have not played yet
             qualified = false;
             eliminated = false;
          }
       } else {
          // Legacy Knockout
          const myRound1Match = allMatches.find(m =>
            m.playerIds?.includes(user.uid) &&
            ['QR1', 'QR2', 'R16'].includes(m.round || '')
          );
          if (myRound1Match && (myRound1Match.status === 'CLOSED' || myRound1Match.status === 'COMPLETED')) {
             played = 1;
             if (myRound1Match.championUid === user.uid) qualified = true;
             else eliminated = true;
          }
       }
    }

    setPlayerStatus({ isQualified: qualified, isEliminated: eliminated, played, max });

    // 2. Identify & Filter DIRECTIVE (nextMatch)
    if (eliminated || (qualified && isGroupsPhase)) {
       setNextMatch(null);
    } else {
      const activeStatuses = ["WAITING", "READY", "IN_PROGRESS", "WAITING_FOR_OPPONENT", "RESOLVING", "DISPUTED"];
      const myActiveMatches = allMatches
        .filter(m => m.playerIds?.includes(user.uid))
        .filter(m => activeStatuses.includes(m.status));
      
      // Sort by expiresAt ascending
      myActiveMatches.sort((a, b) => {
        const getMs = (m: any) => {
          const exp = (m as any).expiresAt;
          if (!exp) return Infinity;
          if (typeof exp.toMillis === 'function') return exp.toMillis();
          if (exp._seconds) return exp._seconds * 1000;
          if (exp.seconds) return exp.seconds * 1000;
          return Infinity;
        };
        return getMs(a) - getMs(b);
      });
      
      setNextMatch(myActiveMatches[0] || null);
    }

  }, [competition, allMatches, user]);


  if (loading) return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background gap-4">
      <Loader2 className="w-10 h-10 text-accent animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-widest text-sub">Establishing Neural Link to War Room...</p>
    </div>
  );

  if (error || !competition) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
       <ShieldAlert className="w-16 h-16 text-red-500 opacity-20" />
       <div>
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Access Denied</h2>
          <p className="text-xs text-sub font-bold uppercase tracking-widest">{error || "Neural data corrupted."}</p>
       </div>
       <Link href="/dashboard/tournaments">
          <button className="px-8 py-3 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-sm hover:bg-accent transition-all italic">
             Return to Basecamp
          </button>
       </Link>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] bg-background overflow-y-auto custom-scrollbar">
      <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
         {/* Breadcrumb Header */}
         <div className="flex items-center justify-between mb-12 border-b border-surface-border pb-8">
            <div className="flex items-center gap-6">
               <button 
                 onClick={() => router.push('/dashboard')}
                 className="p-3 bg-surface border border-surface-border rounded-sm hover:border-accent group transition-all cursor-pointer shadow-xl"
               >
                  <ChevronLeft className="w-5 h-5 text-gray-500 group-hover:text-accent transition-colors" />
               </button>
               <div>
                  <div className="flex items-center gap-2 mb-1">
                     <span className="text-[10px] text-accent font-black uppercase tracking-widest italic">{competition.game} Operational Hub</span>
                     <span className="text-gray-700">/</span>
                     <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest italic">War Room</span>
                  </div>
                  <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none">
                     {competition.title}
                  </h1>
               </div>
            </div>

            <div className="hidden md:flex bg-black/40 border border-surface-border px-6 py-3 rounded-sm gap-8">
               <div>
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest block mb-1">Entry Stake</span>
                  <span className="text-lg font-black text-main italic">{(competition as any).challengeFee || 0} CR</span>
               </div>
               <div className="w-px bg-surface-border h-full" />
               <div>
                  <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest block mb-1">Status</span>
                  <span className={`text-lg font-black italic uppercase tracking-tighter ${competition.status === 'ACTIVE' ? 'text-accent' : 'text-blue-500'}`}>
                     {competition.status}
                  </span>
               </div>
            </div>
         </div>

          <CircuitWarRoom 
            competition={competition} 
            nextMatch={nextMatch} 
            activeMatches={allMatches.filter(m => m.playerIds?.includes(user?.uid!) && ["WAITING", "READY", "IN_PROGRESS", "WAITING_FOR_OPPONENT", "RESOLVING", "DISPUTED"].includes(m.status))}
            allMatches={allMatches}
            playerStatus={playerStatus}
            userUid={user?.uid} 
            idToken={idToken}
          />
      </div>
    </div>
  );
}
