"use client";
import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Match, leaveMatch } from "@/lib/match-service";
import { setMatchDisputedAction } from "@/app/actions/match-actions";
import Link from 'next/link';
import { useAuth } from "@/components/auth/AuthProvider";
import MatchRoster from "@/components/match/MatchRoster";
import MatchChat from "@/components/match/MatchChat";
import MatchStatusPanel from "@/components/match/MatchStatusPanel";
import LeaveMatchModal from "../../../components/match/LeaveMatchModal";
import MatchRules from "@/components/match/MatchRules";
import { Loader2, ShieldCheck, Swords, ShieldAlert, Share2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function ActiveMatchPage({ params }: { params: Promise<{ id: string }> }) {
   const { id } = use(params);
   const router = useRouter();
   const { user } = useAuth();
   const { info: showInfoToast } = useToast();

   const [match, setMatch] = useState<Match | null>(null);
   const [loading, setLoading] = useState(true);
   const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
   const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
   const [lastKnownCircuitId, setLastKnownCircuitId] = useState<string | null>(null);
   const [isDisputeModalOpen, setIsDisputeModalOpen] = useState(false);
   const [disputeReason, setDisputeReason] = useState("");
   const [isDisputing, setIsDisputing] = useState(false);
   const lastMatchRef = React.useRef<Match | null>(null);

   useEffect(() => {
      if (match?.status === 'CLOSED') {
         setRedirectCountdown(10);
      }
   }, [match?.status]);

    useEffect(() => {
       if (redirectCountdown === null) return;
       if (redirectCountdown === 0) {
          const targetId = lastKnownCircuitId || (match as any)?.leagueId;
          const targetUrl = targetId ? `/dashboard/tournaments/view/${targetId}` : "/dashboard";
          router.push(targetUrl);
          return;
       }
       const timer = setTimeout(() => setRedirectCountdown(prev => prev! - 1), 1000);
       return () => clearTimeout(timer);
    }, [redirectCountdown, router, match, lastKnownCircuitId]);

   useEffect(() => {
      if (!id) return;

      let autoRedirectTimeoutId: NodeJS.Timeout | null = null;
      let hasRedirected = false; // Prevent multiple redirects

      // Connect to real-time Match Document in Firebase
      const matchRef = doc(db, "matches", id as string);
      const unsub = onSnapshot(matchRef, (snap) => {
         // Ensure we handle the match sync cleanly
         if (snap.exists()) {
            const data = { id: snap.id, ...snap.data() } as Match;
            setMatch(data);
            lastMatchRef.current = data;
            if ((data as any).circuitId) setLastKnownCircuitId((data as any).circuitId);
            if (autoRedirectTimeoutId) clearTimeout(autoRedirectTimeoutId);
         } else {
            // Document was Nuked/Deleted
            if (lastMatchRef.current && !hasRedirected) { 
               // If we HAD a match and it disappeared, it's purged.
               // Redirect immediately back to the dashboard (only once)
               hasRedirected = true;
               if (autoRedirectTimeoutId) clearTimeout(autoRedirectTimeoutId);
               setLoading(false);
               setTimeout(() => {
                  const targetId = lastKnownCircuitId || (lastMatchRef.current as any)?.leagueId;
                  const targetUrl = targetId ? `/dashboard/tournaments/view/${targetId}` : "/dashboard";
                  router.push(targetUrl);
               }, 100);
            } else if (!lastMatchRef.current && !autoRedirectTimeoutId && !hasRedirected) {
               // Match never existed from the start - show error with manual escape button
               // Auto-redirect after 60 seconds of showing the error page as a safety net
               autoRedirectTimeoutId = setTimeout(() => {
                  if (!hasRedirected) {
                     hasRedirected = true;
                     router.push("/dashboard");
                  }
               }, 60000);
            }
            lastMatchRef.current = null;
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

      return () => {
         if (autoRedirectTimeoutId) clearTimeout(autoRedirectTimeoutId);
         unsub();
      };
   }, [id, router]);

   // --- NATIVE NAVIGATION FIX ---
   // Automatically acknowledge the match if the user leaves the page via native browser back buttons or gestures.
   // This guarantees MatchReadyDispatcher won't trap them in a loop when returning to the dashboard.
   useEffect(() => {
      return () => {
         if (typeof window !== 'undefined' && id) {
            sessionStorage.setItem(`match_ready_ack_${id}`, 'true');
         }
      };
   }, [id]);

    if (loading) {
       return (
          <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-12">
             <div className="relative mb-12">
                <div className="absolute inset-0 bg-accent/20 blur-3xl animate-pulse rounded-full" />
                <Loader2 className="w-16 h-16 text-accent animate-spin relative z-10" />
             </div>
             <div className="space-y-3 text-center">
                <p className="text-[12px] font-black uppercase text-white tracking-[0.6em] animate-pulse">Establishing Neural Link</p>
                <div className="h-1 w-64 bg-white/10 rounded-full overflow-hidden mx-auto">
                   <div className="h-full bg-accent animate-pulse w-1/2" />
                </div>
                <p className="text-[8px] font-black uppercase text-gray-600 tracking-[0.2em] mt-2 italic">Securing Operations Theater #{id.slice(-6).toUpperCase()}</p>
             </div>
          </div>
       );
    }

   // If match still null, show professional 'Not Found' state
   if (!match) {
      return (
         <div className="w-full min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center relative z-50">
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
                      onClick={async () => {
                         if (typeof window !== 'undefined') {
                            sessionStorage.setItem(`match_ready_ack_${id}`, 'true');
                         }
                         try {
                            router.push('/dashboard');
                         } catch (e) {
                            console.error("Router failed, using window.location:", e);
                            if (typeof window !== 'undefined') {
                               window.location.href = '/dashboard';
                            }
                         }
                      }}
                      className="relative z-50 bg-accent hover:bg-accent-hover text-black px-10 py-5 rounded-sm text-xs font-black uppercase tracking-widest transition-all hover:-translate-y-1 shadow-[0_0_30px_rgba(0,255,102,0.1)] cursor-pointer active:scale-95"
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

            <div className="flex items-center gap-6">
               {(match?.format === 'league' || match?.format === 'tournament' || (match as any)?.circuitId || (match as any)?.leagueId) && (
                   (() => {
                      const targetId = (match as any).circuitId || (match as any).leagueId;
                      if (!targetId) return (
                         <button 
                            onClick={() => showInfoToast("Awaiting Tournament Generation", "Brackets will be spawned instantly once all players join and the host deploys.")}
                            className="flex text-[10px] font-black uppercase text-accent hover:text-white transition-colors tracking-widest items-center gap-2 underline decoration-accent/30 underline-offset-4"
                         >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            View Group Stages & Tables
                         </button>
                      );

                      return (
                         <a 
                            href={`/dashboard/tournaments/view/${targetId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex text-[10px] font-black uppercase text-accent hover:text-white transition-colors tracking-widest items-center gap-2 underline decoration-accent/30 underline-offset-4"
                         >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            View Group Stages & Tables
                         </a>
                      );
                   })()
                )}
                <div className="hidden md:flex items-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-black border border-surface-border px-3 py-1.5 rounded-[3px]">
                   <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                   Live Combat Operations
                </div>
             </div>

             {match?.status !== 'CLOSED' && match?.status !== 'DISPUTED' && (
               <button
                  onClick={() => setIsDisputeModalOpen(true)}
                  className="bg-red-500/10 border border-red-500/20 text-red-500 px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-red-500/20 transition-all mr-6 flex items-center gap-2"
               >
                  <ShieldAlert className="w-3 h-3" />
                  Summon Judgement
               </button>
             )}
          </div>

         <div className="w-full max-w-[100rem] mx-auto p-4 sm:p-6 lg:p-8 flex-1">
            {/* TACTICAL VIEWER BANNER */}
            {match?.overseers?.[user?.uid || ''] && (
               <div className="mb-6 bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-sm flex items-center justify-between animate-in slide-in-from-top-4 duration-500">
                  <div className="flex items-center gap-4">
                     <div className="w-10 h-10 bg-yellow-500/20 border border-yellow-500/40 rounded-sm flex items-center justify-center rotate-45 shrink-0">
                        <ShieldCheck className="w-5 h-5 text-yellow-500 -rotate-45" />
                     </div>
                     <div>
                        <h4 className="text-[11px] font-black text-yellow-500 uppercase tracking-[0.2em] italic">Tactical Viewer Mode // Active</h4>
                        <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">You are monitoring this mission as an Overseer. Deployment controls restricted.</p>
                     </div>
                  </div>
                  <div className="hidden sm:block text-[9px] font-black text-yellow-500/60 uppercase tracking-widest border border-yellow-500/20 px-3 py-1 rounded-sm">
                     Observer Clearance: Alpha-1
                  </div>
               </div>
            )}

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
                     <p className={`text-2xl font-black italic tracking-tighter ${match?.game === 'CODM' ? 'text-red-500' : 'text-accent'}`}>
                        {(match as any).isPromo 
                          ? (((match as any).prizeUSD || 0) * 100).toLocaleString() 
                          : Math.floor((match?.challengeFee || 0) * (match?.maxPlayers || 2) * 0.8).toLocaleString()
                        } CR
                     </p>
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

               <div className="lg:col-span-3 order-1 lg:order-3 h-auto lg:h-[800px] lg:overflow-y-auto custom-scrollbar lg:pr-2 lg:pb-4">
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
            onConfirm={() => {
               if (typeof window !== 'undefined') {
                  sessionStorage.setItem(`match_ready_ack_${id}`, 'true');
               }
               const targetId = (match as any)?.circuitId || (match as any)?.leagueId || lastKnownCircuitId;
               if (targetId) {
                  router.push(`/dashboard/tournaments/view/${targetId}`);
               } else {
                  router.push('/dashboard');
               }
            }}
         />

         {/* EXTRACTION OVERLAY */}
         {redirectCountdown !== null && (
            <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-2xl flex flex-col items-center justify-center animate-in fade-in zoom-in duration-500 p-8 text-center">
               <div className="absolute inset-0 opacity-10 pointer-events-none overflow-hidden">
                  <div className="absolute inset-[-100%] bg-[radial-gradient(circle_at_center,_rgba(0,255,102,0.15)_0%,_transparent_70%)] animate-pulse" />
               </div>

               <div className="relative space-y-12 max-w-lg">
                  <div className="flex flex-col items-center gap-6">
                     <div className="w-24 h-24 bg-accent/20 border-2 border-accent/40 rounded-full flex items-center justify-center relative">
                        <div className="absolute inset-0 border-4 border-accent border-r-transparent rounded-full animate-spin" />
                        <span className="text-4xl font-black text-white italic">{redirectCountdown}</span>
                     </div>
                     <div className="space-y-2">
                        <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">Mission Accomplished</h2>
                        <p className="text-[10px] text-accent font-black uppercase tracking-[0.4em] animate-pulse">Neural Data Exfiltration in Progress</p>
                     </div>
                  </div>

                  <div className="h-px bg-white/10 w-full" />

                  <div className="space-y-6">
                     <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
                        The arena is being purged. Stand by for automatic extraction to the <span className="text-white">War Room Command Center</span>.
                     </p>
                     
                     <div className="flex items-center justify-center gap-3 opacity-30">
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.1s]" />
                        <div className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.2s]" />
                     </div>
                  </div>

                  <button 
                    onClick={() => {
                       const targetId = (match as any).circuitId || (match as any).leagueId;
                       if (targetId) {
                         router.push(`/dashboard/tournaments/view/${targetId}`);
                       } else {
                         router.push('/dashboard');
                       }
                    }}
                    className="px-10 py-5 bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-sm hover:bg-accent transition-all italic active:scale-95"
                  >
                     Extract Now
                  </button>
               </div>
            </div>
         )}
         {/* DISPUTE MODAL */}
         {isDisputeModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-in fade-in duration-200">
               <div className="bg-[#0a0a0a] border border-red-500/30 p-6 rounded-sm max-w-md w-full shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                     <ShieldAlert className="w-6 h-6 text-red-500 animate-pulse" />
                     <h3 className="text-xl font-black italic uppercase tracking-tighter text-white">Summon Judgement</h3>
                  </div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-6">
                     State your reason for initiating a dispute. False claims will result in severe penalties.
                  </p>
                  <textarea
                     value={disputeReason}
                     onChange={(e) => setDisputeReason(e.target.value)}
                     placeholder="E.g., Opponent disconnected, incorrect score submitted..."
                     className="w-full h-32 bg-black border border-white/10 text-white p-3 rounded-sm mb-6 text-sm resize-none focus:outline-none focus:border-red-500 transition-colors"
                  />
                  <div className="flex gap-3">
                     <button
                        onClick={() => {
                           setIsDisputeModalOpen(false);
                           setDisputeReason("");
                        }}
                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-sm transition-all"
                        disabled={isDisputing}
                     >
                        Cancel
                     </button>
                     <button
                        onClick={async () => {
                           if (!disputeReason.trim() || !user) return;
                           setIsDisputing(true);
                           const idToken = await user.getIdToken();
                           const res = await setMatchDisputedAction(idToken, id as string, disputeReason);
                           if (res.success) {
                              showInfoToast("JUDGEMENT SUMMONED", "Admin support has been alerted.");
                              setIsDisputeModalOpen(false);
                           } else {
                              showInfoToast("ERROR", "Failed to summon judgement.");
                           }
                           setIsDisputing(false);
                        }}
                        disabled={!disputeReason.trim() || isDisputing}
                        className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center"
                     >
                        {isDisputing ? <Loader2 className="w-4 h-4 animate-spin" /> : "Initiate Protocol"}
                     </button>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
}
