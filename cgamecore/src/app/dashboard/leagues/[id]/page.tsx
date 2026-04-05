"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Match } from '@/lib/match-service';
import { Loader2, Trophy, ChevronLeft, Target, Shield, Zap, History, LayoutGrid } from 'lucide-react';
import Link from 'next/link';

interface LeaguePlayer {
  uid: string;
  username: string;
  avatarId: string;
  points: number;
  played: number;
  wins: number;
  draws?: number;
  losses: number;
  gd?: number; // Goal Difference
}

interface League {
  id: string;
  title: string;
  game: string;
  status: string;
  totalPool: number;
  playerCount: number;
  quota: number;
  players: Record<string, LeaguePlayer>;
  createdAt: any;
}

export default function LeagueDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [league, setLeague] = useState<League | null>(null);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    // 1. Listen to League Data
    const leagueRef = doc(db, "leagues", id as string);
    const unsubLeague = onSnapshot(leagueRef, (snap) => {
      if (snap.exists()) {
        setLeague({ id: snap.id, ...snap.data() } as League);
      } else {
        router.push('/dashboard/leagues');
      }
      setLoading(false);
    });

    // 2. Listen to Recent Matches in this League
    // Use single-field query to avoid index requirement. Sort/Filter client-side.
    const qMatches = query(
      collection(db, "matches"),
      where("leagueId", "==", id),
      limit(50)
    );

    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(m => m.status === 'CLOSED')
        .sort((a, b) => (b.resolvedAt?.seconds || 0) - (a.resolvedAt?.seconds || 0))
        .slice(0, 10);
      setRecentMatches(docs);
    });

    return () => {
      unsubLeague();
      unsubMatches();
    };
  }, [id, router]);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40 gap-4">
      <Loader2 className="w-10 h-10 text-accent animate-spin" />
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-500 animate-pulse">Synchronizing Standings...</span>
    </div>
  );

  if (!league) return null;

  // Sort players by points, then wins, then username
  const sortedPlayers = Object.values(league.players || {}).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.username.localeCompare(b.username);
  });

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      {/* Header Navigation */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
         <Link 
            href="/dashboard/leagues" 
            className="flex items-center gap-2 text-sub hover:text-accent transition-colors text-[10px] font-black uppercase tracking-widest group"
          >
            <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            Back to Circuits
          </Link>
          <div className="flex items-center gap-3">
             <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-accent/10 text-accent rounded-sm border border-accent/20">
                ACTIVE PHASE
             </span>
             <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-black text-gray-500 rounded-sm">
                ID: {league.id.slice(0, 8)}
             </span>
          </div>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
         <div className="lg:col-span-2 bg-surface border border-surface-border p-8 rounded-sm relative overflow-hidden group shadow-2xl">
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
               <Trophy className="w-40 h-40 text-accent" />
            </div>
            <div className="relative z-10">
               <h1 className="text-4xl md:text-5xl font-black text-white italic uppercase tracking-tighter mb-2">
                 {league.title || `${league.game} Elite`}
               </h1>
               <p className="text-xs text-accent font-bold uppercase tracking-[0.2em] mb-8">{league.game} Competitive Circuit</p>
               
               <div className="flex flex-wrap gap-8">
                  <div className="space-y-1">
                     <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Victory Pool</p>
                     <p className="text-2xl font-black text-white italic">{Math.floor(league.totalPool * 0.8).toLocaleString()} <span className="text-accent text-sm">CR</span></p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Deployment</p>
                     <p className="text-2xl font-black text-white italic">{league.playerCount} / {league.quota} <span className="text-gray-500 text-sm">PLYRS</span></p>
                  </div>
                  <div className="space-y-1">
                     <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Round Progress</p>
                     <p className="text-2xl font-black text-white italic">03 / 16 <span className="text-gray-500 text-sm">STRTS</span></p>
                  </div>
               </div>
            </div>
         </div>

         <div className="bg-black border border-surface-border p-8 rounded-sm flex flex-col justify-center shadow-xl">
            <div className="flex items-center gap-3 mb-6">
               <Shield className="w-5 h-5 text-accent" />
               <h3 className="text-xs font-black uppercase tracking-widest text-white italic">Rule of Engagement</h3>
            </div>
            <ul className="space-y-4">
               {[
                 "Double Round Robin format",
                 "3 Points for decisive victory",
                 "1 Point for reported draw",
                 "Top 2 advance to Grand Final"
               ].map((rule, i) => (
                 <li key={i} className="flex items-start gap-3 text-[10px] text-gray-400 font-bold uppercase tracking-tight">
                    <span className="w-1.5 h-1.5 bg-accent rounded-full mt-1 shrink-0" />
                    {rule}
                 </li>
               ))}
            </ul>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
         {/* Standings Table */}
         <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center gap-3 px-2">
               <LayoutGrid className="w-4 h-4 text-accent" />
               <h2 className="text-xs font-black uppercase tracking-widest text-white italic">Current Rank Standings</h2>
            </div>
            <div className="bg-surface border border-surface-border rounded-sm overflow-hidden shadow-2xl">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="bg-black/50 border-b border-surface-border">
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Rank</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Operative</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-center">P</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-center">W</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-center">D</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-center">L</th>
                        <th className="px-6 py-4 text-[9px] font-black uppercase tracking-widest text-accent text-center">PTS</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border">
                     {sortedPlayers.map((p, idx) => (
                        <tr key={p.uid} className="hover:bg-white/5 transition-colors group">
                           <td className="px-6 py-5">
                              <span className={`text-sm font-black italic ${idx < 2 ? 'text-accent' : 'text-white'}`}>#{idx + 1}</span>
                           </td>
                           <td className="px-6 py-5">
                              <div className="flex items-center gap-3">
                                 <img 
                                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.avatarId || p.username}`} 
                                    className="w-8 h-8 rounded-full bg-black border border-surface-border group-hover:border-accent transition-colors" 
                                    alt="" 
                                 />
                                 <span className="text-xs font-black uppercase italic text-white group-hover:text-accent transition-colors">{p.username}</span>
                              </div>
                           </td>
                           <td className="px-6 py-5 text-center text-xs font-bold text-gray-400">{p.played}</td>
                           <td className="px-6 py-5 text-center text-xs font-bold text-gray-400">{p.wins}</td>
                           <td className="px-6 py-5 text-center text-xs font-bold text-gray-400">{p.draws || 0}</td>
                           <td className="px-6 py-5 text-center text-xs font-bold text-gray-400">{p.losses}</td>
                           <td className="px-6 py-5 text-center">
                              <span className="text-sm font-black text-accent italic">{p.points}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         {/* Match History */}
         <div className="space-y-4">
            <div className="flex items-center gap-3 px-2">
               <History className="w-4 h-4 text-accent" />
               <h2 className="text-xs font-black uppercase tracking-widest text-white italic">Recent Combat Logs</h2>
            </div>
            <div className="space-y-3">
               {recentMatches.length > 0 ? recentMatches.map((m) => (
                  <div key={m.id} className="bg-surface border border-surface-border p-4 rounded-sm flex items-center justify-between group hover:border-accent/40 transition-colors">
                     <div className="flex items-center gap-4">
                        <div className="flex -space-x-2">
                           {Object.values(m.players || {}).slice(0, 2).map((p, i) => (
                              <img key={i} src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${p.avatarId}`} className="w-6 h-6 rounded-full border-2 border-surface bg-black" />
                           ))}
                        </div>
                        <div>
                           <p className="text-[10px] font-black uppercase text-white truncate max-w-[120px]">
                              {Object.values(m.players)[0]?.username} vs {Object.values(m.players)[1]?.username}
                           </p>
                           <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Finalized Result</p>
                        </div>
                     </div>
                     <span className="text-[9px] font-black text-accent italic">VIEW LOG</span>
                  </div>
               )) : (
                  <div className="bg-surface border border-surface-border border-dashed p-10 rounded-sm text-center">
                     <Zap className="w-6 h-6 text-gray-800 mx-auto mb-2 opacity-20" />
                     <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">No match data synced yet</p>
                  </div>
               )}
            </div>
         </div>
      </div>
    </div>
  );
}
