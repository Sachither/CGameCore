"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, onSnapshot, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Circuit } from "@/lib/match-service";
import Link from "next/link";
import { Trophy, ChevronLeft, Loader2, Users, Flame, ShieldCheck } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";

export default function TournamentListingPage({ params }: { params: any }) {
  const router = useRouter();
  const { user } = useAuth();
  const [circuits, setCircuits] = useState<Circuit[]>([]);
  const [loading, setLoading] = useState(true);

  const paramsResolved = params instanceof Promise ? React.use(params) : params;
  const gameKey = paramsResolved?.id?.toUpperCase() || "EFOOTBALL";

  useEffect(() => {
    if (!user) return;

    // Fetch Circuits for this game
    const qCircuits = query(
      collection(db, "circuits"),
      where("game", "==", gameKey)
    );
    const unsubCircuits = onSnapshot(qCircuits, (snap) => {
      setCircuits(snap.docs.map(d => ({ id: d.id, ...d.data() } as Circuit)));
      setLoading(false);
    }, (err) => {
      console.error("[TournamentListing] Circuit Sync Error:", err);
      setLoading(false);
    });

    return () => { unsubCircuits(); };
  }, [gameKey, user]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] opacity-20">
      <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
      <p className="text-[10px] font-black uppercase tracking-widest">Scanning Game Brackets...</p>
    </div>
  );

  const allComps = circuits
    .filter((comp: any) => {
      // 🔒 [CLEANUP] Filter out old MASTER_CIRCUIT entries (league data)
      if (comp.title?.includes('MASTER_CIRCUIT')) return false;
      if (comp.status === 'KNOCKOUT_Q' || comp.status === 'GROUPS') return false;
      
      if (comp.status !== 'WAITING') return true;
      
      const isParticipant = comp.playerIds?.includes(user?.uid);
      const playerCount = comp.playerIds?.length || 0;
      const createdAt = comp.createdAt?.seconds ? comp.createdAt.seconds * 1000 : Date.now();
      const isFresh = (Date.now() - createdAt) < 10 * 60 * 1000; // 10 minutes

      // Show if: User is in it, OR it has momentum (3+ players), OR it is new
      return isParticipant || playerCount >= 3 || isFresh;
    })
    .sort((a: any, b: any) => 
      (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)
    );

  return (
    <div className="w-full max-w-7xl mx-auto pb-32">
       {/* Breadcrumbs */}
       <div className="mb-10 flex items-center gap-3">
         <button onClick={() => router.back()} className="p-2 bg-surface border border-surface-border rounded-sm hover:border-accent hover:text-accent transition-all group px-4">
           <ChevronLeft className="w-4 h-4" />
         </button>
         <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 italic">
           <span>Tournaments</span>
           <span className="opacity-30">/</span>
           <span className="text-accent">{gameKey} CATEGORY</span>
         </div>
       </div>

       <div className="mb-12">
          <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase leading-none mb-4">
             {gameKey} <span className="text-accent-aware">Arena</span>
          </h1>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] italic">Available Live Tournaments</p>
       </div>

       {allComps.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
             {allComps.map((comp) => (
                <div key={comp.id} className="bg-surface border border-surface-border p-6 rounded-sm group hover:border-accent/40 transition-all shadow-xl flex flex-col">
                   <div className="flex justify-between items-start mb-6 font-black uppercase tracking-widest text-[8px]">
                      <span className="bg-accent/10 text-accent px-2 py-1 rounded-sm">{(comp as any).format || 'LEAGUE'}</span>
                      <span className="text-gray-500">{comp.status}</span>
                   </div>
                   
                   <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-4 group-hover:text-accent transition-colors truncate">
                      {comp.title}
                   </h3>
                   
                   <div className="flex-1 space-y-4 mb-8">
                      <div className="flex justify-between items-center border-b border-surface-border pb-3">
                         <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Entry Fee</span>
                         <span className="text-xs font-black text-white italic">{(comp as any).challengeFee || (comp as any).fee || 0} CR</span>
                      </div>
                      <div className="flex justify-between items-center">
                         <span className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Victory Pool</span>
                         <span className="text-lg font-black text-accent italic tracking-tight">{Math.floor((comp.totalPool || 0) * 0.8).toLocaleString()} CR</span>
                      </div>
                   </div>

                   <Link href={`/dashboard/tournaments/view/${comp.id}`}>
                      <button className="w-full py-4 bg-white hover:bg-accent text-black font-black uppercase tracking-widest text-[10px] rounded-sm transition-all shadow-lg active:scale-95 italic">
                         View War Room Standings
                      </button>
                   </Link>
                </div>
             ))}
          </div>
       ) : (
          <div className="bg-black/30 border border-surface-border p-24 text-center rounded-sm">
             <Trophy className="w-16 h-16 text-gray-800 mx-auto mb-6 opacity-20" />
             <p className="text-[10px] text-gray-600 font-black uppercase tracking-[0.4em]">No Active Operations in this Sector</p>
          </div>
       )}
    </div>
  );
}
