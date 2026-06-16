"use client";
import React, { useState, useEffect } from 'react';
import ChampionPodium from "@/components/leaderboards/ChampionPodium";
import RankingTable from "@/components/leaderboards/RankingTable";
import { CollectionReference, collection, query, onSnapshot, orderBy, limit, updateDoc, doc, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getWeeklyEarnersAction, getGlobalLeaderboardAction } from '@/app/actions/leaderboard-actions';

export default function LeaderboardView() {
  const { user, profile } = useAuth();
  const [filter, setFilter] = useState<'All-Time'|'Monthly'|'CODM'|'eFootball'|'Weekly-Earners'>('All-Time');
  const [search, setSearch] = useState('');
  const [leaderboardUsers, setLeaderboardUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [isDataFetching, setIsDataFetching] = useState(false);

  // --- WEEKLY EARNERS FETCH ---
  useEffect(() => {
    if (filter === 'Weekly-Earners') {
      let mounted = true;
      const fetchWeekly = async () => {
        setIsDataFetching(true);
        try {
          const res = await getWeeklyEarnersAction();
          if (!mounted) return;
          if (res.success && res.earners) {
            setLeaderboardUsers(res.earners);
          }
        } catch (e) {
          console.error('[Leaderboard] Weekly fetch failed:', e);
        } finally {
          if (mounted) setIsDataFetching(false);
          if (mounted) setLoading(false);
        }
      };

      fetchWeekly();
      const intervalId = setInterval(fetchWeekly, 60000); // refresh every 60s
      return () => { mounted = false; clearInterval(intervalId); };
    }
  }, [filter]);

  // --- LEGACY STATS AUTO-SYNC ---
  useEffect(() => {
    if (!user || !profile) return;
    
    // // Attempt a deep-scan sync only once per session if counters look uninitialized
    // if (profile.totalMatches === undefined || profile.totalMatches === null || (profile.totalMatches === 0 && !profile.totalWins)) {
    //   const performSync = async () => {
    //     setSyncing(true);
    //     console.log(`[Leaderboard] Deep-scanning legacy stats for elite sync...`);
    //     try {
    //       // Use array-contains filter to satisfy security rules
    //       const q = query(
    //         collection(db, "matches"),
    //         where("playerIds", "array-contains", user.uid),
    //         limit(400)
    //       );
    //       const snap = await getDocs(q);
    //       const activeStatuses = ['WAITING', 'READY', 'IN_PROGRESS', 'RESOLVING', 'DISPUTED'];
          
    //       const history = snap.docs
    //         .map(d => d.data())
    //         .filter(m => {
    //           const isInvolved = m.playerIds?.includes(user.uid) || !!m.players?.[user.uid] || m.creatorId === user.uid;
    //           const isResolved = !activeStatuses.includes(m.status);
    //           return isInvolved && isResolved;
    //         });
          
    //       const totalMatches = history.length;
    //       const totalWins = history.filter(m => m.championUid === user.uid).length;
          
    //       // --- DEEP TACTICAL SCAN: Recover goals and kills ---
    //       const eFootballMatches = history.filter(m => m.game === 'EFOOTBALL');
    //       const eFootballWins = eFootballMatches.filter(m => m.championUid === user.uid).length;
    //       let totalGoalsFor = 0;
    //       let totalGoalsAgainst = 0;
    //       eFootballMatches.forEach(m => {
    //         const myData = m.players?.[user.uid];
    //         if (myData) {
    //           totalGoalsFor += (myData.scoreFor || 0);
    //           totalGoalsAgainst += (myData.scoreAgainst || 0);
    //         }
    //       });

    //       const codmMatches = history.filter(m => m.game === 'CODM');
    //       const codmWins = codmMatches.filter(m => m.championUid === user.uid).length;
    //       let totalKills = 0;
    //       codmMatches.forEach(m => {
    //         const myData = m.players?.[user.uid];
    //         if (myData) totalKills += (myData.kills || 0);
    //       });

    //       if (totalMatches > 0) {
    //         await updateDoc(doc(db, "users", user.uid), {
    //           totalMatches,
    //           totalWins,
    //           [`stats.EFOOTBALL.matches`]: eFootballMatches.length,
    //           [`stats.EFOOTBALL.wins`]: eFootballWins,
    //           [`stats.EFOOTBALL.goalsFor`]: totalGoalsFor,
    //           [`stats.EFOOTBALL.goalsAgainst`]: totalGoalsAgainst,
    //           [`stats.CODM.matches`]: codmMatches.length,
    //           [`stats.CODM.wins`]: codmWins,
    //           [`stats.CODM.kills`]: totalKills
    //         });
    //         console.log(`[Leaderboard] Elite sync complete: ${totalWins}/${totalMatches} matches and ${totalGoalsFor} goals recovered.`);
    //       }
    //     } catch (e) {
    //       console.error("Deep sync protocol failure:", e);
    //     } finally {
    //       setSyncing(false);
    //     }
    //   };
      
    //   performSync();
    // }
  }, [user, profile]);

  useEffect(() => {
    if (filter === 'Weekly-Earners') return;

    if (!user) {
      console.log("[Leaderboard] Guest session detected - fetching via secure server uplink...");
      const fetchGuestLeaderboard = async () => {
        const res = await getGlobalLeaderboardAction(filter);
        if (res.success && res.users) {
          setLeaderboardUsers(res.users);
        }
        setLoading(false);
      };
      fetchGuestLeaderboard();
      return;
    }

    console.log("[Leaderboard] Member session detected - initiating real-time query...");

    // Query ALL users and sort by totalWins with default 0 for missing values
    const q = query(
      collection(db, "users"),
      limit(500) 
    );

    let callbackFired = false;
    
    // Set a more generous timeout for slow networks
    const timeoutId = setTimeout(() => {
      if (!callbackFired) {
        console.error("[Leaderboard] ❌ TIMEOUT: onSnapshot callback did not fire within 15 seconds!");
        console.error("[Leaderboard] This usually means Firestore is waiting for an index, auth sync, or network is restricted.");
        setLeaderboardUsers([]);
        setLoading(false);
      }
    }, 15000);

    const unsub = onSnapshot(q, async (snap) => {
      callbackFired = true;
      clearTimeout(timeoutId);
      console.log("[Leaderboard] 🔔 Snapshot received. Count:", snap.docs.length);
      console.log(`[Leaderboard] Query returned ${snap.docs.length} documents`);
      
      if (snap.docs.length === 0) {
        console.warn("[Leaderboard] ⚠️ No users found in database!");
        setLeaderboardUsers([]);
        setLoading(false);
        return;
      }

      console.log("[Leaderboard] ✅ Processing", snap.docs.length, "users...");

      let users = snap.docs
        .map((doc, index) => {
          const data = doc.data();
          return {
            id: doc.id,
            totalWins: data.totalWins || 0,
            totalMatches: data.totalMatches || 0,
            ...data
          } as any;
        });

      // --- DYNAMIC SORTING BASED ON FILTER ---
      if (filter === 'CODM') {
        users.sort((a: any, b: any) => (b.stats?.CODM?.wins || 0) - (a.stats?.CODM?.wins || 0));
      } else if (filter === 'eFootball') {
        users.sort((a: any, b: any) => (b.stats?.EFOOTBALL?.wins || 0) - (a.stats?.EFOOTBALL?.wins || 0));
      } else {
        users.sort((a: any, b: any) => (b.totalWins || 0) - (a.totalWins || 0));
      }

      users = users.map((user: any, index: number) => ({
          ...user,
          rank: index + 1
        }))
        .slice(0, 100); // Keep top 100 after sorting

      console.log(`[Leaderboard] Top users after sorting: ${users.length}`);

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
            totalWins: doc.data().totalWins || 0,
            totalMatches: doc.data().totalMatches || 0,
            ...doc.data()
          }));

        // Add badge users to the list
        users = [...users, ...badgeUsers];
      } catch (error) {
        console.error("[Leaderboard] Error fetching champion badge users:", error);
      }

      console.log(`[Leaderboard] Final user count to display: ${users.length}`);
      setLeaderboardUsers(users);
      setLoading(false);
    }, (err) => {
      callbackFired = true;
      clearTimeout(timeoutId);
      console.error("[Leaderboard] Query error:", err);
      console.error("[Leaderboard] Error code:", err.code);
      console.error("[Leaderboard] Error message:", err.message);
      setLeaderboardUsers([]);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeoutId);
      unsub();
    };
  }, [user, filter]);

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
    <div className="w-full max-w-6xl mx-auto pb-10 animate-in fade-in duration-700 relative">
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
            <div className="flex bg-black border border-surface-border rounded-[3px] overflow-x-auto scrollbar-hide shadow-lg whitespace-nowrap">
               {(['All-Time', 'Monthly', 'CODM', 'eFootball', 'Weekly-Earners'] as const).map(f => (
                 <button 
                   key={f}
                   onClick={() => setFilter(f)}
                   className={`px-4 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors inline-flex items-center gap-2 flex-shrink-0 ${filter === f ? 'bg-accent/10 text-accent-aware border-b-2 border-accent' : 'text-gray-500 hover:bg-surface hover:text-main border-b-2 border-transparent'}`}
                 >
                   {f === 'Weekly-Earners' && (
                     isDataFetching ? <Loader2 className="w-3 h-3 text-accent animate-spin" /> : <Zap className="w-3 h-3 text-accent" />
                   )}
                   {f === 'Weekly-Earners' ? 'Weekly Top 10' : f}
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

      <ChampionPodium topUsers={top3} activeFilter={filter} />
      <RankingTable 
        users={leaderboardUsers.slice(3)} 
        searchQuery={search} 
        activeFilter={filter} 
        fullList={leaderboardUsers}
      />
    </div>
  );
}
