"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy, limit, getDocs, writeBatch, arrayUnion, doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import RestrictedDashboardPrompt from '@/components/dashboard/RestrictedDashboardPrompt';
import { Match } from '@/lib/match-service';
import { RefreshCw, ShieldAlert, Target, Table as TableIcon } from 'lucide-react';
import { useCommandModal } from '@/context/CommandModalContext';
import LeagueStandingsModal from '@/components/dashboard/LeagueStandingsModal';

export default function MyMatchesPage() {
  const { user } = useAuth();
  const command = useCommandModal();
  const [activeMatches, setActiveMatches] = useState<Match[]>([]);
  const [historyMatches, setHistoryMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshotData, setSnapshotData] = useState<{ title: string, standings: any } | null>(null);
  const [snapshotOpen, setSnapshotOpen] = useState(false);
  const [fetchingSnapshot, setFetchingSnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;

    // Fetch matches using single-field query to avoid index requirement. Filter/Sort on client.
    const q = query(
      collection(db, "matches"),
      where("playerIds", "array-contains", user!.uid),
      limit(500)
    );

    const unsub = onSnapshot(q, (snap) => {
      const allMatches = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));
      const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED', 'WAITING_FOR_OPPONENT', 'SCHEDULED'];
      
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const myInvolved = allMatches.filter(m => {
        const involved = m.playerIds?.includes(user!.uid) || m.players[user!.uid];
        return involved && (isLocal || !m.isTestMode);
      });
      
      const active = myInvolved
        .filter(m => activeStatuses.includes(m.status))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

      // History: CLOSED (finished matches) or COMPLETED (finalized tournament lobbies)
      const history = myInvolved
        .filter(m => m.status === 'CLOSED' || m.status === 'COMPLETED')
        .sort((a, b) => {
          const aTime = (b as any).resolvedAt?.seconds || b.createdAt?.seconds || 0;
          const bTime = (a as any).resolvedAt?.seconds || a.createdAt?.seconds || 0;
          return aTime - bTime;
        });
      
      setActiveMatches(active);
      setHistoryMatches(history);
      setLoading(false);
    }, (err: any) => {
      console.error("Firestore Listen Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  const handleViewSnapshot = async (circuitId: string, title: string) => {
    if (fetchingSnapshot) return;
    setFetchingSnapshot(circuitId);
    try {
      // Deterministic check: Leagues first
      let snap = await getDoc(doc(db, "leagues", circuitId));
      if (!snap.exists()) {
        snap = await getDoc(doc(db, "circuits", circuitId));
      }

      if (snap.exists()) {
        const data = snap.data();
        setSnapshotData({
          title: data.title || title,
          standings: data.standings || {}
        });
        setSnapshotOpen(true);
      } else {
        command.alert({
          title: "ARCHIVE UNAVAILABLE",
          message: "Tactical snapshot lost or purged from archives. Metadata may have been scrubbed.",
          variant: 'warning'
        });
      }
    } catch (err) {
      console.error("Snapshot Fetch Error:", err);
    } finally {
      setFetchingSnapshot(null);
    }
  };

  if (!user) {
    return (
      <div className="w-full max-w-6xl mx-auto space-y-12 pb-10">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-main italic tracking-tighter uppercase mb-2">My <span className="text-accent">Matches</span></h1>
            <p className="text-xs text-sub uppercase tracking-widest font-bold">Manage your active rooms and track past earnings.</p>
          </div>
          <Link
            href="/login?callback=/dashboard/matches"
            className="bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest px-8 py-4 rounded-sm text-xs transition-all shadow-[0_10px_20px_rgba(0,255,102,0.2)] hover:-translate-y-1 italic"
          >
            Enlist Now
          </Link>
        </div>
        <RestrictedDashboardPrompt callback="/dashboard/matches" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-6xl mx-auto space-y-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-4xl font-black text-main italic tracking-tighter uppercase mb-2">My <span className="text-accent">Matches</span></h1>
          <p className="text-xs text-sub uppercase tracking-widest font-bold">Manage your active rooms and track past earnings.</p>
        </div>
        <Link 
          href="/dashboard/matches/new"
          className="bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest px-8 py-4 rounded-sm text-xs transition-all shadow-[0_10px_20px_rgba(0,255,102,0.2)] hover:-translate-y-1 italic"
        >
          + Host New Match
        </Link>
      </div>

      {/* Active Matches Section */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-accent flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(0,255,102,0.5)]"></span>
            Live Match Rooms
          </h2>
        </div>
        
        {loading ? (
          <div className="bg-surface border border-surface-border p-12 rounded-sm text-center animate-pulse">
             <p className="text-sub uppercase font-bold tracking-widest text-[10px]">Synchronizing with Orbit...</p>
          </div>
        ) : activeMatches.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {activeMatches.map((match) => {
              const playersCount = Object.keys(match.players).length;
              return (
                <div key={match.id} className="bg-surface border border-accent/20 hover:border-accent/40 p-6 rounded-sm relative overflow-hidden group transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                         <div className="text-[10px] text-sub font-bold uppercase tracking-widest">{match.game} • {match.format}</div>
                         <div className="text-xl font-black text-main italic uppercase tracking-tight mt-1 items-center flex gap-3">
                            Lobby {match.id?.slice(0, 5)}
                            <span className={`text-[8px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest ${match.status === 'WAITING' ? 'bg-yellow-500/10 text-yellow-500' : (match.status === 'READY' || match.status === 'IN_PROGRESS') ? 'bg-accent/10 text-accent' : match.status === 'SCHEDULED' ? 'bg-white/10 text-gray-500' : 'bg-blue-500/10 text-blue-400'}`}>
                               {match.status === 'WAITING' ? 'OPEN' : (match.status === 'READY' || match.status === 'IN_PROGRESS') ? 'ACTIVE' : match.status === 'SCHEDULED' ? 'LOCKED' : match.status}
                            </span>
                         </div>
                         <div className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                            {playersCount} / {match.maxPlayers || 2} Operators Deployed
                         </div>
                      </div>
                   </div>

                    <div className="flex items-center gap-4 mt-6 pt-6 border-t border-surface-border">
                       <div className="flex-1">
                          <span className="text-[10px] text-sub uppercase font-bold tracking-widest block">Pot Size</span>
                          <span className="text-accent font-mono font-bold tracking-tighter">{(match.challengeFee || 0) * 2} Credits</span>
                       </div>
                       
                       {['RESOLVED', 'CLOSED', 'COMPLETED'].includes(match.status) ? (
                         <button 
                           disabled
                           className="bg-gray-800 text-gray-500 font-black uppercase tracking-widest px-6 py-3 rounded-sm text-xs cursor-not-allowed italic"
                         >
                           Lobby Locked
                         </button>
                       ) : (
                         <Link 
                           href={`/match/${match.id}`}
                           className="bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest px-6 py-3 rounded-sm text-xs transition-all shadow-[0_5px_15px_rgba(0,255,102,0.1)] hover:-translate-y-0.5"
                         >
                           Enter Lobby
                         </Link>
                       )}
                    </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-surface-hover border border-surface-border p-12 rounded-sm text-center">
             <p className="text-sub uppercase font-bold tracking-widest text-xs">No active matches found.</p>
             <button 
               onClick={() => (window as any).openCreateModal?.()}
               className="text-accent text-[10px] uppercase font-bold tracking-widest mt-4 inline-block hover:underline"
             >
               Host a New Match
             </button>
          </div>
        )}
      </section>

      {/* Match History Table */}
      <section>
        <div className="flex justify-between items-end mb-6">
          <div className="flex items-center gap-4">
            <h2 className="text-sm font-bold uppercase tracking-widest text-sub">Recent History</h2>
          </div>
          <div className="flex items-center gap-4">
             <Link href="/dashboard/matches/history" className="text-[10px] font-black uppercase text-sub hover:text-white transition-colors tracking-widest">See All History</Link>
          </div>
        </div>
        <div className="bg-surface border border-surface-border overflow-hidden rounded-sm">
           <table className="w-full text-left">
              <thead className="bg-surface-hover border-b border-surface-border">
                 <tr>
                    <th className="px-6 py-4 text-[10px] font-bold text-sub uppercase tracking-widest">Match Details</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-sub uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-sub uppercase tracking-widest">Result</th>
                    <th className="px-6 py-4 text-[10px] font-bold text-sub uppercase tracking-widest">Prize</th>
                 </tr>
              </thead>
               <tbody className="divide-y divide-surface-border/50">
                  {historyMatches.map((match) => {
                     const opponent = match.players
                       ? Object.values(match.players).find(p => p.uid !== user?.uid)
                       : null;
                     const isWinner = match.championUid === user?.uid;
                     const resolvedSec = (match as any).resolvedAt?.seconds;
                     const createdSec = match.createdAt?.seconds;
                     const date = resolvedSec
                       ? new Date(resolvedSec * 1000).toLocaleDateString()
                       : createdSec
                         ? new Date(createdSec * 1000).toLocaleDateString()
                         : 'Recently';
                     // Prize: display 'Advanced/Qualifier' only if it's a circuit match
                     let prizeString = '--';
                     const isCircuitMatch = !!match.circuitId;
                     if (isCircuitMatch) {
                        const reward = (match as any).rewardAmount || 0;
                        prizeString = isWinner ? (match.round === 'FINAL' ? (reward > 0 ? `+${reward}` : '🏆 Champion') : 'Advanced') : '--';
                     } else {
                        prizeString = isWinner ? `+${(match as any).rewardAmount || 0}` : '--';
                     }
                     // Opponent: handle ghost, tournament round, and missing cases
                     const opponentName = opponent?.username === 'GHOST'
                       ? 'Ghost (Auto-Win)'
                       : opponent?.username
                         ? `vs ${opponent.username}`
                         : (match as any).circuitId
                           ? `${(match as any).round || 'Tournament'} Match`
                           : 'Solo / Waitlist';
                     
                    return (
                      <tr key={match.id} className="hover:bg-surface-hover/30 transition-colors group">
                        <td className="px-6 py-4">
                           <div className="text-main font-bold text-sm uppercase tracking-tight italic">{match.game} {match.format}</div>
                           <div className="text-[10px] text-sub uppercase font-bold tracking-widest">
                             {opponentName}
                           </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-sub font-mono">{date}</td>
                        <td className="px-6 py-4">
                           <span className={`${isWinner ? 'text-accent' : 'text-red-500'} font-black italic uppercase text-xs tracking-tighter`}>
                             {isWinner ? 'Victory' : 'Defeat'}
                           </span>
                        </td>
                          <td className="px-6 py-4 text-right">
                             <div className="flex flex-col items-end gap-1">
                                <span className={`text-main font-mono font-bold ${isWinner ? 'text-accent' : 'text-sub'}`}>
                                   {prizeString}
                                </span>
                                {match.circuitId && (
                                   <button 
                                      onClick={() => handleViewSnapshot(match.circuitId!, match.game + " " + match.format)}
                                      disabled={!!fetchingSnapshot}
                                      className="text-[8px] font-black text-accent hover:underline uppercase tracking-widest italic flex items-center gap-1"
                                   >
                                      {fetchingSnapshot === match.circuitId ? 'Fetching...' : 'View Table Snapshot'}
                                   </button>
                                )}
                             </div>
                          </td>
                      </tr>
                    );
                  })}
                  {historyMatches.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-sub uppercase text-[10px] font-bold tracking-[0.2em]">No historical data found.</td>
                    </tr>
                  )}
               </tbody>
           </table>
        </div>
      </section>

      <LeagueStandingsModal 
        isOpen={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        title={snapshotData?.title || "League Results"}
        standings={snapshotData?.standings || {}}
      />

    </div>
  );
}
