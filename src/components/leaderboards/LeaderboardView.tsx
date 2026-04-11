"use client";
import React, { useState, useEffect } from 'react';
import ChampionPodium from "@/components/leaderboards/ChampionPodium";
import RankingTable from "@/components/leaderboards/RankingTable";
import { collection, query, onSnapshot, orderBy, limit, updateDoc, doc, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';

export default function LeaderboardView() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState<'All-Time'|'Monthly'|'CODM'|'eFootball'>('All-Time');
  const [search, setSearch] = useState('');
  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // --- LEGACY STATS AUTO-SYNC ---
  useEffect(() => {
    if (!user || !profile) return;
    
    // Attempt a deep-scan sync only once per session if counters look uninitialized
    if (profile.totalMatches === undefined || profile.totalMatches === null || (profile.totalMatches === 0 && !profile.totalWins)) {
      const performSync = async () => {
        setSyncing(true);
        console.log(`[Leaderboard] Deep-scanning legacy stats for elite sync...`);
        try {
          // Use array-contains filter to satisfy security rules
          const q = query(
            collection(db, "matches"),
            where("playerIds", "array-contains", user.uid),
            limit(400)
          );
          const snap = await getDocs(q);
          const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED'];
          
          const history = snap.docs
            .map(d => d.data())
            .filter(m => {
              const isInvolved = m.playerIds?.includes(user.uid) || !!m.players?.[user.uid] || m.creatorId === user.uid;
              const isResolved = !activeStatuses.includes(m.status);
              return isInvolved && isResolved;
            });
          
          const totalMatches = history.length;
          const totalWins = history.filter(m => m.championUid === user.uid).length;
          
          if (totalMatches > 0) {
            await updateDoc(doc(db, "users", user.uid), {
              totalMatches,
              totalWins
            });
            console.log(`[Leaderboard] Elite sync complete: ${totalWins}/${totalMatches}`);
          }
        } catch (e) {
          console.error("Deep sync protocol failure:", e);
        } finally {
          setSyncing(false);
        }
      };
      
      performSync();
    }
  }, [user, profile]);

  useEffect(() => {
    if (!user) return;

    // Rank by Skill (Total Wins) instead of Wealth (Balance)
    const q = query(
      collection(db, "users"),
      orderBy("totalWins", "desc"),
      limit(100)
    );

    const unsub = onSnapshot(q, async (snap) => {
      let users = snap.docs.map((doc, index) => ({
        id: doc.id,
        rank: index + 1,
        ...doc.data()
      }));

      // Include users with active champion badges (even if not in top 100)
      try {
        const now = new Date();
        const badgeQuery = query(
          collection(db, "users"),
          where("championBadge.expiresAt", ">", Timestamp.fromDate(now))
        );
        const badgeSnap = await getDocs(badgeQuery);

        const badgeUsers = badgeSnap.docs
          .filter(doc => !users.find(u => u.id === doc.id)) // Don't duplicate
          .map((doc, index) => ({
            id: doc.id,
            rank: users.length + index + 1,
            ...doc.data()
          }));

        // Add badge users to the list
        users = [...users, ...badgeUsers];
      } catch (error) {
        console.error("Error fetching champion badge users:", error);
      }

      setLeaderboardUsers(users);
      setLoading(false);
    }, (err) => {
      console.error("[Leaderboard] Global Sync Failure:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  if (loading) {
    return (
      <div className="w-full flex flex-col items-center justify-center min-h-[60vh]">
         <Loader2 className="w-10 h-10 text-accent animate-spin" />
         <p className="text-[10px] text-sub font-black uppercase tracking-widest mt-6 italic">Synchronizing Global Standings...</p>
      </div>
    );
  }

  const top3 = leaderboardUsers.slice(0, 3);
  const remaining = leaderboardUsers.slice(3);

  return (
    <div className="w-full max-w-6xl mx-auto pb-10 animate-in fade-in duration-700">
      <div className="mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
         <div>
           <h1 className="text-3xl md:text-5xl font-black text-main italic tracking-tighter uppercase">
             Global <span className="text-accent-aware">Rankings</span>
           </h1>
           <p className="text-sub text-xs mt-2 uppercase tracking-widest font-bold">
             The absolute elite of the CGameCore platform.
           </p>
           
           {/* Intelligence Briefing */}
           <div className="mt-6 flex items-start gap-4 p-4 bg-surface-hover/30 border border-surface-border rounded-sm max-w-xl">
              <div className="bg-accent/10 p-2 rounded-full text-accent shrink-0">
                 <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                 <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1 italic">Automated Standings Protocol</h4>
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                    Operative data is synchronized automatically. Every confirmed victory in CODM or eFootball is instantly logged to your neural profile, influencing your global rank and tactical coefficients.
                 </p>
              </div>
           </div>
         </div>

         {/* Filters & Search */}
         <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <div className="flex bg-black border border-surface-border rounded-[3px] overflow-hidden shadow-lg">
               {(['All-Time', 'Monthly', 'CODM', 'eFootball'] as const).map(f => (
                 <button 
                   key={f}
                   onClick={() => setFilter(f)}
                   className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors ${filter === f ? 'bg-accent/10 text-accent-aware border-b-2 border-accent' : 'text-gray-500 hover:bg-surface hover:text-main border-b-2 border-transparent'}`}
                 >
                   {f}
                 </button>
               ))}
            </div>
            
            <div className="relative group">
              <svg className="w-4 h-4 absolute left-3 top-3 text-gray-500 group-focus-within:text-accent transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input 
                 type="text" 
                 placeholder="Search Player..." 
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full sm:w-64 bg-black border border-surface-border focus:border-accent focus:ring-1 focus:ring-accent text-main pl-10 pr-4 py-2.5 rounded-[3px] outline-none text-xs transition-all placeholder-gray-600 shadow-inner"
              />
            </div>
         </div>
      </div>

      <ChampionPodium topUsers={top3} />
      <RankingTable users={leaderboardUsers} searchQuery={search} activeFilter={filter} />
    </div>
  );
}
