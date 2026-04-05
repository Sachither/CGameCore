"use client";
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/components/auth/AuthProvider";
import { Match, leaveMatch } from "@/lib/match-service";

import MatchRoster from "@/components/match/MatchRoster";
import MatchStatusPanel from "@/components/match/MatchStatusPanel";
import MatchChat from "@/components/match/MatchChat";

export default function MatchLobbyPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;

    const unsub = onSnapshot(doc(db, "matches", id as string), (docSnap) => {
      if (docSnap.exists()) {
        const data = { id: docSnap.id, ...docSnap.data() } as Match;
        setMatch(data);
      } else {
        setError("Match room not found or has been closed.");
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setError("Failed to connect to match lobby.");
      setLoading(false);
    });

    return () => unsub();
  }, [id]);

  // SAFE REDIRECT EFFECT: Runs only on client after mount/sync
  useEffect(() => {
    if (match && id) {
      router.replace(`/match/${id}`);
    }
  }, [match, id, router]);
  const handleLeave = async () => {
    if (!user || !id) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      await leaveMatch(idToken, id as string);
      router.push('/dashboard/matches');
    } catch (err: any) {
      alert(err.message || "Failed to leave match.");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <div className="text-sub font-black uppercase tracking-widest text-xs">Syncing Match Data...</div>
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <div className="text-red-500 font-black uppercase tracking-tighter text-2xl mb-4 italic">CRITICAL ERROR</div>
        <p className="text-sub font-bold uppercase tracking-widest text-xs mb-8">{error || "Lobby Expired"}</p>
        <button onClick={() => router.push('/dashboard/matches')} className="bg-surface border border-surface-border px-8 py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] hover:border-accent transition-all">Return to Command Center</button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      
      {/* Lobby Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-surface border border-surface-border p-6 rounded-sm shadow-xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-1 h-full bg-accent"></div>
         <div>
            <div className="flex items-center gap-2 mb-1">
               <span className="text-[10px] bg-accent/10 border border-accent/20 text-accent font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
                  ID: {match.id?.slice(0, 8).toUpperCase()}
               </span>
               <span className="text-[10px] bg-white/5 border border-white/10 text-gray-400 font-black px-2 py-0.5 rounded-sm uppercase tracking-widest">
                  Escrow: {match.challengeFee} Coins
               </span>
            </div>
            <h1 className="text-3xl font-black text-main italic uppercase tracking-tighter">
               {match.game} <span className="text-accent">{match.format}</span> LOBBY
            </h1>
         </div>

         <div className="flex items-center gap-3 w-full md:w-auto">
            <button 
               onClick={handleLeave}
               className="flex-1 md:flex-none border border-surface-border hover:border-red-500/50 hover:text-red-500 text-sub px-6 py-3 rounded-sm font-bold uppercase tracking-widest text-[10px] transition-all"
            >
               Leave Match
            </button>
            <div className="hidden md:block w-px h-8 bg-surface-border mx-2"></div>
            <div className="text-right">
               <div className="text-[9px] text-sub uppercase font-bold tracking-[0.2em]">Match Status</div>
               <div className={`text-sm font-black italic uppercase tracking-tight ${match.status === 'WAITING' ? 'text-yellow-500' : 'text-accent'}`}>{match.status}</div>
            </div>
         </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-20">
         
         <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="flex-1">
               <MatchRoster match={match} currentUserUid={user?.uid} />
            </div>
            <div className="h-[400px]">
               <MatchChat match={match} />
            </div>
         </div>

         {/* Right: Status & Actions */}
         <div className="lg:col-span-4 flex flex-col gap-6">
            <MatchStatusPanel match={match} currentUserUid={user?.uid} />
         </div>

      </div>
    </div>
  );
}
