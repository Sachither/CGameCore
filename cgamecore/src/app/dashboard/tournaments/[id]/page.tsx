"use client";
import React, { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { collection, doc, onSnapshot, query, where, QuerySnapshot, DocumentSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { League, Match } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import LeagueStandings from "@/components/match/LeagueStandings";
import TournamentRulesCard from "@/components/tournaments/TournamentRulesCard";
import MyCombatSchedule from "@/components/tournaments/MyCombatSchedule";
import { Loader2, ChevronLeft, Swords, Trophy, ShieldCheck } from "lucide-react";

export default function TournamentDetailsPage({ params }: { params: any }) {
  // Support both sync and async params for different Next.js versions
  const paramsResolved = params instanceof Promise ? React.use(params) : params;
  const id = paramsResolved?.id;
  
  const router = useRouter();
  const { user } = useAuth();
  
  const [league, setLeague] = useState<League | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Unified Mock Data - Mapping clean IDs to their competitive configurations
  const MOCK_LEAGUES: Record<string, Partial<League>> = {
    'codm': {
      id: 'codm',
      title: "Alcatraz Clash",
      game: 'CODM',
      format: 'Alcatraz Battleground',
      status: 'ACTIVE',
      challengeFee: 500,
      totalPool: 10000,
      playerCount: 14,
      quota: 40,
      players: {}
    },
    'efootball': {
      id: 'efootball',
      title: "eFootball Professional Rank",
      game: 'EFOOTBALL',
      format: '1v1 Standard League',
      status: 'ACTIVE',
      challengeFee: 500,
      totalPool: 8000,
      playerCount: 6,
      quota: 20,
      players: {}
    }
  };

  useEffect(() => {
    if (!id) return;

    // 1. Check for Internal Mock matches first
    if (MOCK_LEAGUES[id]) {
      setLeague(MOCK_LEAGUES[id] as League);
      setLoading(false);
      return;
    }

    // 2. Otherwise, fetch from Live Tactical Database
    const leagueRef = doc(db, "leagues", id);
    const unsub = onSnapshot(leagueRef, (snap: DocumentSnapshot) => {
      if (snap.exists()) {
        setLeague({ id: snap.id, ...snap.data() } as League);
      } else {
        setLeague(null);
      }
      setLoading(false);
    });

    // 3. Listen for Matches in this league
    const qMatches = query(
      collection(db, "matches"),
      where("leagueId", "==", id)
    );
    const unsubMatches = onSnapshot(qMatches, (snap: QuerySnapshot) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      setMatches(docs);
    });

    return () => {
      unsub();
      unsubMatches();
    };
  }, [id]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">Synchronizing Arena Data...</p>
    </div>
  );

  // If Not Found in Leagues, it might be a static tournament or deleted
  if (!league) {
    return (
      <div className="w-full max-w-7xl mx-auto py-20 text-center">
         <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6 rotate-45">
            <Swords className="w-10 h-10 text-red-500 -rotate-45" />
         </div>
         <h1 className="text-2xl font-black text-white uppercase italic mb-2">Arena Link Expired</h1>
         <p className="text-xs text-gray-500 uppercase tracking-widest mb-10">This competitive segment is no longer active or was moved.</p>
         <button onClick={() => router.push('/dashboard')} className="bg-accent text-black px-10 py-4 rounded-sm text-[10px] font-black uppercase tracking-widest">Return to Basecamp</button>
      </div>
    );
  }

  const isCODM = league.game === 'CODM';

  return (
    <div className="w-full max-w-7xl mx-auto pb-32">
       {/* Breadcrumbs */}
       <div className="mb-8 flex items-center gap-3">
         <button 
           onClick={() => router.back()}
           className="p-2 bg-surface border border-surface-border rounded-sm hover:border-accent hover:text-accent transition-all group"
         >
           <ChevronLeft className="w-4 h-4" />
         </button>
         <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
           <span>Dashboard</span>
           <span className="opacity-30">/</span>
           <span>Tournaments</span>
           <span className="opacity-30">/</span>
           <span className="text-accent">{league.title || league.game + " Arena"}</span>
         </div>
       </div>

       {/* Header Meta */}
       <div className="mb-12">
          <div className="flex items-center gap-3 mb-3">
             <Trophy className="w-6 h-6 text-accent" />
             <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase leading-none">
                {league.game} <span className="text-accent-aware">Competitive</span>
             </h1>
          </div>
          <div className="flex items-center gap-4">
             <div className="flex items-center gap-2 bg-accent/5 border border-accent/20 px-3 py-1 rounded-sm">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[9px] text-accent font-black uppercase tracking-widest italic">{league.status}</span>
             </div>
             <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest italic flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 opacity-30" /> 1 Week Regulation Window
             </span>
          </div>
       </div>

       {/* Main Grid: Rules (30%) / Dynamic Content (70%) */}
       <div className="flex flex-col lg:flex-row lg:items-start gap-8 w-full max-w-full">
          {/* Rules / Details Card */}
          <div className="w-full lg:w-[35%] xl:w-[30%] shrink-0">
             <TournamentRulesCard game={isCODM ? "codm" : "efootball"} league={league} />
             
             {/* League Prize Breakdown (Context-aware) */}
             <div className="mt-6 bg-surface border border-surface-border p-6 rounded-sm">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-4 pb-2 border-b border-surface-border">Victory Grant Policy</h4>
                <div className="space-y-4">
                   <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                      <span className="text-gray-500">Tier 1 Prize</span>
                      <span className="text-accent italic">
                        {Math.floor((league.totalPool || 0) * 0.8 * (league.totalPool >= 50000 ? 0.75 : 1)).toLocaleString()} CR
                      </span>
                   </div>
                   {league.totalPool >= 50000 && (
                     <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                        <span className="text-gray-500">Tier 2 Prize</span>
                        <span className="text-gray-400 italic">
                          {Math.floor((league.totalPool || 0) * 0.8 * 0.25).toLocaleString()} CR
                        </span>
                     </div>
                   )}
                   <p className="text-[8px] text-gray-600 leading-relaxed uppercase tracking-tighter mt-4 border-t border-surface-border pt-4">
                      *Splitting active for pools ≥ 50,000 CR. Standard Winner-Takes-All applies below threshold (20% platform commission).
                   </p>
                </div>
             </div>
          </div>

          {/* Dynamic Competition Hub */}
          <div className="w-full lg:w-[65%] xl:w-[70%]">
             {/* If it's a Round Robin League, show Standings */}
             {league.status === 'ACTIVE' || league.status === 'FILLING' ? (
                 <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
                    <LeagueStandings league={league} />
                    
                    <MyCombatSchedule 
                      leagueId={league.id || id} 
                      game={league.game} 
                      matches={matches} 
                      currentUid={user?.uid || ''} 
                    />
                 </div>
             ) : (
                <div className="bg-black/50 border border-surface-border p-20 text-center rounded-sm">
                   <Trophy className="w-16 h-16 text-accent mx-auto mb-6 opacity-20" />
                   <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">Arena Operations Terminated</p>
                </div>
             )}
          </div>
       </div>
    </div>
  );
}
