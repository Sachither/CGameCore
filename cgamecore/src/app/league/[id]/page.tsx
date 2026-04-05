"use client";
import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, onSnapshot, collection, query, where, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { League, Match } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import LeagueStandings from "@/components/match/LeagueStandings";
import { Loader2, Calendar, Lock, ChevronLeft, Swords } from "lucide-react";

export default function LeaguePage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [league, setLeague] = useState<League | null>(null);
  const [fixtures, setFixtures] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // 1. Listen to League Data
    const leagueRef = doc(db, "leagues", id as string);
    const unsubLeague = onSnapshot(leagueRef, (snap) => {
      if (snap.exists()) {
        setLeague({ id: snap.id, ...snap.data() } as League);
      } else {
        router.push("/dashboard");
      }
    });

    // 2. Listen to League Fixtures (Matches assigned to this league)
    const matchesQ = query(
      collection(db, "matches"),
      where("leagueId", "==", id)
    );
    const unsubMatches = onSnapshot(matchesQ, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      // Client-side sort by round then createdAt to avoid index requirement
      const sorted = docs.sort((a, b) => {
        if (a.round !== b.round) return (a.round || 0) - (b.round || 0);
        return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
      });
      setFixtures(sorted);
      setLoading(false);
    });

    return () => {
      unsubLeague();
      unsubMatches();
    };
  }, [id, router]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
      <p className="text-xs font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">Synchronizing Arena Data...</p>
    </div>
  );

  if (!league) return null;

  return (
    <div className="w-full max-w-6xl mx-auto pb-20">
      {/* Header Navigation */}
      <button 
        onClick={() => router.back()}
        className="mb-8 flex items-center gap-2 text-gray-500 hover:text-white transition-colors group"
      >
        <div className="p-1 bg-surface border border-surface-border rounded-sm group-hover:border-accent group-hover:text-accent transition-all">
          <ChevronLeft className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-black uppercase tracking-widest">Back to Basecamp</span>
      </button>

      <div className="flex flex-col lg:flex-row gap-10">
        
        {/* LEFT COLUMN: Standings */}
        <div className="flex-1 space-y-10">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-2">
              {league.game} <span className="text-accent-aware">League</span>
            </h1>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 bg-accent/5 border border-accent/20 px-3 py-1 rounded-sm">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                <span className="text-[10px] text-accent font-black uppercase tracking-widest italic tracking-tight">{league.status}</span>
              </div>
              <span className="text-gray-600 text-[10px] font-bold uppercase tracking-widest italic">1 Week Campaign Window</span>
            </div>
          </div>

          <LeagueStandings league={league} />
        </div>

        {/* RIGHT COLUMN: Fixtures & Meta */}
        <div className="w-full lg:w-96 space-y-8">
          
          {/* Match Schedule */}
          <div className="bg-surface border border-surface-border rounded-sm overflow-hidden">
             <div className="p-4 bg-black border-b border-surface-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                   <Calendar className="w-4 h-4 text-accent" />
                   <h3 className="text-[10px] font-black uppercase tracking-widest text-white italic">Match Schedule</h3>
                </div>
                <span className="text-[9px] text-gray-500 font-bold uppercase">{fixtures.length} Fixtures</span>
             </div>

             <div className="p-2 space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                {fixtures.length === 0 ? (
                  <div className="py-10 text-center px-4">
                     <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest leading-loose">The League Commissioner has not generated fixtures yet.</p>
                  </div>
                ) : (
                  fixtures.map((m) => {
                    const players = Object.values(m.players);
                    return (
                      <button 
                        key={m.id}
                        onClick={() => router.push(`/match/${m.id}`)}
                        className="w-full bg-black/40 border border-surface-border/50 p-3 rounded-sm hover:border-accent/40 hover:bg-black transition-all text-left flex items-center justify-between group"
                      >
                         <div className="flex items-center gap-3 overflow-hidden">
                            <div className="text-[9px] font-black text-gray-700 w-4 tracking-tighter">R{m.round || 1}</div>
                            <div className="flex flex-col gap-0.5 max-w-[120px]">
                               <div className="text-[11px] font-black italic uppercase text-white truncate group-hover:text-accent transition-colors">
                                 {players[0]?.username || "TBD"}
                               </div>
                               <div className="text-[11px] font-black italic uppercase text-gray-500 truncate">
                                 {players[1]?.username || "TBD"}
                               </div>
                            </div>
                         </div>
                         <div className="text-right">
                            {m.status === 'COMPLETED' ? (
                               <div className="text-[10px] font-black text-accent italic uppercase tracking-tighter">Resolved</div>
                            ) : m.status === 'IN_PROGRESS' ? (
                               <div className="text-[10px] font-black text-blue-500 italic uppercase animate-pulse">Live</div>
                            ) : (
                               <div className="text-[11px] font-black text-gray-600 italic uppercase flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" /> Fight
                               </div>
                            )}
                         </div>
                      </button>
                    );
                  })
                )}
             </div>
          </div>

          {/* Quick Action */}
          <div className="bg-accent p-6 rounded-sm shadow-2xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer">
             <div className="absolute right-0 top-0 w-24 h-24 bg-black/10 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-black/20 transition-colors" />
             <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2 text-black">
                   <Swords className="w-4 h-4 fill-black" />
                   <span className="text-[10px] font-black uppercase tracking-widest italic">Personal Challenge</span>
                </div>
                <h4 className="text-black font-black uppercase italic leading-none text-lg">Report No-Show</h4>
                <p className="text-[10px] text-black/60 font-bold uppercase tracking-tight mt-2 leading-relaxed">
                   Opponent missed the window? Open a formal dispute for points compensation.
                </p>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
}
