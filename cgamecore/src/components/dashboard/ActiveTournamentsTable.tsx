import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, onSnapshot, orderBy, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerChallengeInterest } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2, Trophy, Users, ShieldCheck, Flame } from "lucide-react";
import CreateChallengeModal from "@/components/dashboard/CreateChallengeModal";

interface LeagueListing {
  id: string;
  game: string;
  title: string;
  challengeFee: number;
  totalPool: number;
  playerCount: number;
  quota: number;
  status: 'FILLING' | 'ACTIVE' | 'COMPLETED';
}

export default function ActiveTournamentsTable() {
  const { user, profile } = useAuth();
  const [leagues, setLeagues] = useState<LeagueListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    // 1. Fetch Active Leagues
    const qLeagues = query(
      collection(db, "leagues"),
      orderBy("createdAt", "desc")
    );

    const unsubLeagues = onSnapshot(qLeagues, (snap) => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as LeagueListing))
        .filter(l => l.status !== 'COMPLETED'); // Client-side filter to prevent index issues
      setLeagues(docs);
      setLoading(false);
    });

    return () => unsubLeagues();
  }, []);

  if (loading) return (
    <div className="flex justify-center py-20 grayscale opacity-20">
      <Loader2 className="w-8 h-8 text-white animate-spin" />
    </div>
  );

  return (
    <div className="mt-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-main italic uppercase tracking-tighter flex items-center gap-3">
            <Trophy className="w-6 h-6 text-accent" />
            Competitive Operational Hub
          </h2>
          <p className="text-[10px] text-sub uppercase font-bold tracking-[0.2em] mt-1 italic opacity-60">Battleground Strategy & Live Results</p>
        </div>
        <div className="flex items-center gap-6">
          <Link 
            href="/dashboard/leagues" 
            className="text-[9px] font-black uppercase text-accent hover:text-white border-b border-accent/20 hover:border-white transition-all tracking-[0.2em] pb-1"
          >
            See Standings
          </Link>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent hover:bg-accent-hover text-black px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-accent/10"
          >
            Create Competition
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {leagues.length > 0 ? leagues.map((t) => {
          const progress = Math.min(((t.playerCount || 0) / (t.quota || 16)) * 100, 100);
          return (
            <LeagueCard key={t.id} league={t} progress={progress} />
          );
        }) : (
          <div className="md:col-span-2 lg:col-span-3 bg-surface border border-surface-border border-dashed p-16 rounded-sm text-center">
             <Trophy className="w-12 h-12 text-gray-800 mx-auto mb-4 opacity-20" />
             <h3 className="text-sm font-black text-main italic uppercase mb-1">No Active Operations Found</h3>
             <p className="text-[10px] text-sub uppercase font-bold tracking-widest max-w-xs mx-auto">Initiate a new circuit using the Create Competition protocol or join a high-stake queue below.</p>
          </div>
        )}
      </div>

      <CreateChallengeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

function LeagueCard({ league: t, progress }: { league: LeagueListing, progress: number }) {
  return (
    <div className="group relative bg-surface border border-surface-border hover:border-accent/40 rounded-sm transition-all overflow-hidden flex flex-col shadow-2xl">
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-20 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-6">
          <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-black border border-surface-border text-gray-400 rounded-sm">
            {t.game} CIRCUIT
          </span>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${t.status === 'FILLING' ? 'bg-accent/10 text-accent animate-pulse' : 'bg-blue-500/10 text-blue-400'}`}>
            {t.status}
          </span>
        </div>

        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1 group-hover:text-accent transition-colors">
          {t.title}
        </h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-8">Active Championship Race</p>

        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-surface-border/50 pb-4">
            <div className="text-[9px] text-sub font-black uppercase tracking-widest">Victory Pool</div>
            <div className="text-2xl font-black text-accent italic tracking-tight">{Math.floor((t.totalPool || 0) * 0.8).toLocaleString()} CR</div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Deployment Status</span>
              <span className="text-white">{t.playerCount || 0} / {t.quota || 16} PLYRs</span>
            </div>
            <div className="h-1 bg-black rounded-full overflow-hidden border border-surface-border">
              <div 
                className="h-full bg-accent shadow-[0_0_10px_rgba(0,255,102,0.5)] transition-all duration-1000" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0">
        <Link href={`/dashboard/leagues/${t.id}`}>
          <button className="w-full py-4 bg-white hover:bg-accent text-black font-black uppercase tracking-widest text-[10px] rounded-sm transition-all shadow-lg active:scale-95">
            View Rankings Standings
          </button>
        </Link>
      </div>
    </div>
  );
}
