"use client";
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Match } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import MatchRoster from "@/components/match/MatchRoster";
import MatchChat from "@/components/match/MatchChat";
import MatchStatusPanel from "@/components/match/MatchStatusPanel";
import LeaveMatchModal from "../../../components/match/LeaveMatchModal";
import MatchRules from "@/components/match/MatchRules";
import { Loader2, ShieldCheck, Swords } from "lucide-react";

export default function ActiveMatchPage({ params }: { params: Promise<{ id: string }> }) {
   const { id } = use(params);
   const router = useRouter();
   const { user } = useAuth();

   const [match, setMatch] = useState<Match | null>(null);
   const [loading, setLoading] = useState(true);
   const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

   useEffect(() => {
      if (!id) return;

      // Connect to real-time Match Document in Firebase
      const matchRef = doc(db, "matches", id as string);
      const unsub = onSnapshot(matchRef, (snap) => {
         if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Match;
            setMatch(data);
         } else {
            setMatch(null);
         }
         setLoading(false);
      }, (error) => {
         // Permission Denied is common during the initial join-sync (millisecond lag)
         if (error.code === 'permission-denied') {
            console.warn("[TacticalLink] Permission denied - awaiting metadata sync...");
            // Keep loading true, but allow a retry soon
            setTimeout(() => setLoading(false), 2000);
         } else {
            console.error("Match synchronization error:", error);
            setLoading(false);
            setMatch(null);
         }
      });

      return () => unsub();
   }, [id]);

   if (loading) {
      return (
         <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-[0.4em]">Establishing Neural Link...</p>
         </div>
      );
   }

   // If match still null, show professional 'Not Found' state
   if (!match) {
      return (
         <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
            <div className="relative mb-10 group">
               <div className="absolute inset-0 bg-red-500/20 blur-3xl rounded-full scale-150 animate-pulse" />
               <div className="w-24 h-24 bg-surface border-2 border-red-500/30 rounded-sm flex items-center justify-center rotate-45 relative z-10 transition-transform group-hover:scale-110">
                  <Swords className="w-10 h-10 text-red-500 -rotate-45" />
               </div>
            </div>

            <h1 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-4">
               Combat Arena <span className="text-red-500">De-Synchronized</span>
            </h1>

            <div className="max-w-md mx-auto space-y-6">
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  The tactical link for ID <span className="text-white">#{id}</span> has expired or never existed. Secure new clearance from the High Stakes Command.
               </p>

               <div className="pt-8 flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                     onClick={() => router.push('/dashboard')}
                     className="bg-accent hover:bg-accent-hover text-black px-10 py-5 rounded-sm text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-[0_0_30px_rgba(0,255,102,0.1)]"
                  >
                     Return to Basecamp
                  </button>
               </div>
            </div>
         </div>
      );
   }

   return (
      <div className="w-full min-h-screen bg-background flex flex-col items-center">

         <div className="w-full bg-surface border-b border-surface-border py-4 px-6 flex items-center justify-between sticky top-0 z-50">
            <button
               onClick={() => setIsLeaveModalOpen(true)}
               className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest p-2 -ml-2 rounded-sm hover:bg-surface-hover"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
               </svg>
               Leave Combat
            </button>

            <div className="flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-black border border-surface-border px-3 py-1.5 rounded-[3px]">
               <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
               Live Combat Operations
            </div>
         </div>

         <div className="w-full max-w-[100rem] mx-auto p-4 sm:p-6 lg:p-8 flex-1">
            {/* Tactical Header */}
            <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface border border-surface-border p-6 rounded-sm shadow-xl relative overflow-hidden">
               {match?.game === 'CODM' && (
                  <div className="absolute inset-0 opacity-[0.05] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
               )}
               <div className="flex items-center gap-6 relative z-10">
                  <div className={`w-16 h-16 bg-black border ${match?.game === 'CODM' ? 'border-red-500/30' : 'border-accent/20'} rounded-sm flex items-center justify-center rotate-45 shrink-0`}>
                     <Swords className={`w-8 h-8 -rotate-45 ${match?.game === 'CODM' ? 'text-red-500' : 'text-accent'}`} />
                  </div>
                  <div>
                     <div className="flex items-center gap-3 mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-[2px] ${match?.game === 'CODM' ? 'bg-red-500 text-white' : 'bg-accent text-black'}`}>
                           {match?.game}
                        </span>
                        <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                           Operations Theater #{match?.id?.slice(-6).toUpperCase()}
                        </span>
                     </div>
                     <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
                        {match?.format === '1v1' ? 'Tactical Duel (15 Mins)' : 'Combat Arena'}
                        {match?.weaponClass && match?.weaponClass !== 'NONE' && (
                           <span className="text-sm bg-white text-black px-3 py-1 rounded-sm not-italic tracking-widest ml-2 shadow-[0_0_20px_rgba(255,255,255,0.1)]">
                              {match.weaponClass} ONLY
                           </span>
                        )}
                     </h1>
                  </div>
               </div>
               <div className="flex items-center gap-8 relative z-10">
                  <div className="text-right">
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 text-center">Entry Grant</p>
                     <p className="text-xl font-black text-white italic tracking-tighter">{match?.challengeFee} CR</p>
                  </div>
                  <div className="text-right border-l border-surface-border pl-8">
                     <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 text-center">Victory Pool</p>
                     <p className={`text-2xl font-black italic tracking-tighter ${match?.game === 'CODM' ? 'text-red-500' : 'text-accent'}`}>{Math.floor((match?.challengeFee || 0) * 1.8)} CR</p>
                  </div>
               </div>
            </div>

            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-stretch h-full">

               <div className="lg:col-span-3 order-3 lg:order-1 h-[600px] lg:h-[800px]">
                  <MatchRoster match={match!} currentUserUid={user?.uid} />
               </div>

               <div className="lg:col-span-6 order-2 lg:order-2 h-[600px] lg:h-[800px]">
                  <MatchChat match={match!} />
               </div>

               <div className="lg:col-span-3 order-1 lg:order-3 h-auto lg:h-[800px]">
                  <MatchStatusPanel match={match!} currentUserUid={user?.uid} />
               </div>

            </div>

            {/* Tactical Briefing & Rules */}
            <div className="mt-40 border-t border-surface-border/30 pt-12">
               <MatchRules game={match!.game} weaponClass={match!.weaponClass} />
            </div>
         </div>

         <LeaveMatchModal
            isOpen={isLeaveModalOpen}
            onClose={() => setIsLeaveModalOpen(false)}
            onConfirm={() => router.push('/dashboard')}
         />

      </div>
   );
}
