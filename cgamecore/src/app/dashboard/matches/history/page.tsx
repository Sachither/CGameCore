"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { Match } from '@/lib/match-service';
import { ChevronLeft, Trophy, Calendar, Hash, Target } from 'lucide-react';

export default function MatchHistoryPage() {
  const { user } = useAuth();
  const [historyMatches, setHistoryMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    // Fetch a broad window of matches and filter/sort client-side 
    // to catch matches missing indices (playerIds)
    const q = query(
      collection(db, "matches"),
      where("playerIds", "array-contains", user.uid),
      limit(400)
    );

    const unsub = onSnapshot(q, (snap) => {
      const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED'];
      
      const myMatches = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Match))
        .filter(m => {
          const isPlayer = m.playerIds?.includes(user.uid) || !!m.players?.[user.uid];
          const isCreator = m.creatorId === user.uid;
          const isInactive = !activeStatuses.includes(m.status);
          return (isPlayer || isCreator) && isInactive;
        })
        .sort((a, b) => {
          const timeA = a.resolvedAt?.seconds || a.createdAt?.seconds || 0;
          const timeB = b.resolvedAt?.seconds || b.createdAt?.seconds || 0;
          return timeB - timeA;
        });

      setHistoryMatches(myMatches);
      setLoading(false);
    }, (err) => {
      console.error("Match History Sync Error:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Link 
        href="/dashboard/matches" 
        className="flex items-center gap-2 text-sub hover:text-accent transition-colors text-[10px] font-black uppercase tracking-widest group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Active Operations
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-4xl font-black text-main italic tracking-tighter uppercase mb-2">Combat <span className="text-accent">Archives</span></h1>
          <p className="text-xs text-sub uppercase tracking-widest font-bold">Comprehensive history of all resolved engagements.</p>
        </div>
        <div className="bg-surface border border-surface-border px-6 py-3 rounded-sm">
           <div className="text-[10px] text-sub font-black uppercase tracking-widest mb-1">Total Operations</div>
           <div className="text-2xl font-black text-main italic">{historyMatches.length}</div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4">
           {[1,2,3,4].map(i => (
             <div key={i} className="h-24 bg-surface animate-pulse rounded-sm border border-surface-border" />
           ))}
        </div>
      ) : historyMatches.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
           {historyMatches.map((match) => {
             const opponent = match.players ? Object.values(match.players).find(p => p.uid !== user?.uid) : null;
             const isWinner = match.championUid === user?.uid;
             const isDraw = !match.championUid && match.status === 'CLOSED'; // Simplified
             const date = match.createdAt?.seconds 
               ? new Date(match.createdAt.seconds * 1000).toLocaleDateString(undefined, {
                   year: 'numeric', month: 'short', day: 'numeric'
                 })
               : 'Recently';

             return (
               <div key={match.id} className="bg-surface border border-surface-border hover:border-accent/30 transition-all p-6 rounded-sm flex flex-col md:flex-row items-center gap-6 group">
                  {/* Status Indicator */}
                  <div className={`w-12 h-12 shrink-0 rounded-sm rotate-45 border flex items-center justify-center ${isWinner ? 'bg-accent/10 border-accent text-accent' : 'bg-red-500/10 border-red-500/30 text-red-500'}`}>
                     <Trophy className={`w-6 h-6 -rotate-45 ${!isWinner && 'opacity-30'}`} />
                  </div>

                  <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-6 w-full md:w-auto">
                     <div>
                        <div className="text-[9px] text-sub font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Hash className="w-3 h-3" /> Operation</div>
                        <div className="text-sm font-black text-white italic uppercase tracking-tight">{match.game} {match.format}</div>
                     </div>
                     <div>
                        <div className="text-[9px] text-sub font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Target className="w-3 h-3" /> Opponent</div>
                        <div className="text-sm font-bold text-white uppercase tracking-widest">{opponent ? opponent.username : 'Unknown'}</div>
                     </div>
                     <div>
                        <div className="text-[9px] text-sub font-black uppercase tracking-widest mb-1 flex items-center gap-1"><Calendar className="w-3 h-3" /> Date</div>
                        <div className="text-xs font-mono text-gray-400">{date}</div>
                     </div>
                     <div>
                        <div className="text-[9px] text-sub font-black uppercase tracking-widest mb-1">Result / Payout</div>
                        <div className="flex items-center gap-2">
                           <span className={`text-sm font-black uppercase italic ${isWinner ? 'text-accent' : 'text-red-500'}`}>
                             {isWinner ? 'Victory' : 'Defeat'}
                           </span>
                           <span className="text-xs font-mono text-gray-500">
                             {isWinner ? `(+${Math.floor(match.challengeFee * 1.8)})` : `(-${match.challengeFee})`}
                           </span>
                        </div>
                     </div>
                  </div>

                  <button 
                    disabled 
                    className="w-full md:w-auto px-8 py-3 bg-gray-800 text-gray-500 border border-gray-700 rounded-sm text-[10px] font-black uppercase tracking-[0.2em] cursor-not-allowed italic"
                  >
                    Archive Locked
                  </button>
               </div>
             );
           })}
        </div>
      ) : (
        <div className="bg-surface border border-surface-border p-20 rounded-sm text-center">
           <h3 className="text-lg font-black text-main italic uppercase mb-2">No Combat History</h3>
           <p className="text-xs text-sub uppercase font-bold tracking-widest">Enlist in a challenge to begin recording your legacy.</p>
        </div>
      )}
    </div>
  );
}
