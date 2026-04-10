"use client";
import React, { useState } from 'react';
import { League, Circuit, Match } from '@/lib/match-service';
import { Swords, ChevronRight, Loader2, Target, ShieldCheck, ShieldAlert, Activity, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { requestAdminInterventionAction } from '@/app/actions/match-actions';
import CompetitionChat from './CompetitionChat';
import TacticalMap from './TacticalMap';

interface Props {
   competition: League | Circuit;
   nextMatch: Match | null;
   activeMatches?: Match[];
   allMatches?: Match[];
   userUid: string | undefined;
   idToken: string | null;
   playerStatus?: { isQualified: boolean, isEliminated: boolean, played: number, max: number };
}

export default function CircuitWarRoom({
   competition,
   nextMatch,
   activeMatches,
   allMatches,
   userUid,
   idToken,
   playerStatus
}: Props) {
   const [intervening, setIntervening] = useState(false);
   const [intervened, setIntervened] = useState(false);
   const [showReportModal, setShowReportModal] = useState(false);
   const [reportingMatchId, setReportingMatchId] = useState<string | null>(null);
   const [showTacticalMap, setShowTacticalMap] = useState(false);

   // --- TACTICAL FILTERING: HIDE PHANTOM/LEGACY MISSIONS ---
   const rawActiveMatches = activeMatches && activeMatches.length > 0 ? activeMatches : (nextMatch ? [nextMatch] : []);

   // Debug: Log all matches for this tournament
   console.log("Tournament matches for user", userUid, ":", rawActiveMatches.map(m => ({
     id: m.id,
     round: m.round,
     players: Object.values(m.players || {}).map(p => ({ uid: p.uid, username: p.username })),
     status: m.status
   })));

   const displayMatches = rawActiveMatches.filter(m => {
      // 1. If circuit is in Groups, show ONLY group matches
      if (competition.status === 'GROUPS') return !m.round || m.round === 'NONE';

      // 2. If circuit is in Knockout Quarters, show ONLY Quarters or QR1
      if (competition.status === 'KNOCKOUT_Q') return m.round === 'QF' || m.round === 'QF TIE-BREAKER' || m.round === 'QR1';

      // 3. If circuit is in Knockout Semis, show ONLY Semis
      if (competition.status === 'KNOCKOUT_S') return m.round === 'SF' || m.round === 'SF TIE-BREAKER';

      // 4. If circuit is in Final, show ONLY Final
      if (competition.status === 'FINAL') return m.round === 'FINAL';

      return true;
   });

   const handleIntervention = async (mId: string) => {
      if (!idToken || intervening) return;
      const reason = prompt("Describe the tactical blockage (e.g., Opponent no-show, Score dispute):");
      if (!reason) return;

      setIntervening(true);
      try {
         const res = await requestAdminInterventionAction(idToken, mId, reason);
         if (res.success) {
            setIntervened(true);
            alert("ALPHA-1 notified. A moderator will review this match shortly.");
         } else {
            alert(res.error);
         }
      } finally {
         setIntervening(false);
      }
   };

   const renderMissionCard = (m: Match) => {
      const isHost = m.hostUid === userUid;
      
      // Get all players in the match
      const allPlayers = Object.values(m.players || {});
      
      // Find the current user in the match
      const currentPlayer = allPlayers.find((p: any) => p.uid === userUid);
      
      // Find the opponent (any other player in the match)
      const opponent = allPlayers.find((p: any) => p.uid !== userUid);
      
      // Get opponent name with better fallbacks and validation
      const opponentName = opponent?.username || opponent?.inGameName || "UNKNOWN";
      
      // Additional validation: ensure opponent is actually different from current user
      const currentUserPlayer = allPlayers.find((p: any) => p.uid === userUid);
      if (opponent && opponent.uid === userUid) {
         console.error("Opponent detection error: opponent is the same as current user", {
            matchId: m.id,
            userUid,
            allPlayers: allPlayers.map(p => ({ uid: p.uid, username: p.username }))
         });
      }

      return (
         <div key={m.id} className="p-6 bg-white/5 border border-white/10 rounded-sm hover:border-accent/40 transition-all group/card">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
               <div className="space-y-1">
                  <div className="flex items-center gap-3 mb-2">
                     <div className={`w-1.5 h-1.5 rounded-full ${m.status === 'IN_PROGRESS' ? 'bg-accent animate-pulse' : 'bg-blue-500'}`} />
                     <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">
                        {m.round === 'QR1' ? 'Round of 16 (Part 1)' : 
                         m.round === 'QR2' ? 'Round of 16 (Part 2)' : 
                         m.round || 'Tournament Match'} {m.leg && m.leg !== 'NONE' ? `· Leg ${m.leg}` : ''}
                     </span>
                  </div>
                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                     vs {opponentName.toUpperCase()}
                  </h3>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-2">
                     Role: <span className={isHost ? 'text-accent' : 'text-main'}>{isHost ? 'HOST' : opponentName.toUpperCase()}</span>
                     {' // '}
                     Arena: #{m.id?.slice(-5).toUpperCase()}
                  </p>
               </div>

               <div className="flex flex-wrap items-center gap-4">
                  <Link href={`/match/${m.id}`}>
                     <button className="px-8 py-4 bg-white text-black font-black uppercase tracking-widest text-[11px] rounded-sm hover:bg-accent transition-all italic flex items-center gap-2 shadow-xl active:translate-y-0.5">
                        Enter Arena <ChevronRight className="w-5 h-5" />
                     </button>
                  </Link>
                  <button
                     onClick={() => {
                        setReportingMatchId(m.id!);
                        setShowReportModal(true);
                     }}
                     disabled={intervened}
                     className="p-4 bg-red-600/10 border border-red-600/30 text-red-500 hover:bg-red-600/20 rounded-sm transition-all"
                     title="Report Match Issue"
                  >
                     <ShieldAlert className="w-5 h-5" />
                  </button>
               </div>
            </div>
         </div>
      );
   };

   return (
      <div className="space-y-12 pb-40 animate-in fade-in slide-in-from-bottom-4 duration-700">

         {/* 1. TOP CONTROL BAR */}
         <div className="flex flex-wrap items-center justify-between gap-6 bg-surface/20 border border-white/5 p-8 rounded-lg">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 bg-accent/20 border border-accent/40 rotate-45 flex items-center justify-center">
                  <Target className="w-6 h-6 text-accent -rotate-45" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none">Command Hub</h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] mt-1 italic">Tactical Uplink // Sector {competition.game}</p>
               </div>
            </div>

            <button
               onClick={() => setShowTacticalMap(true)}
               className="px-8 py-4 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-[11px] rounded-sm transition-all flex items-center gap-3 italic shadow-lg"
            >
               <LayoutGrid className="w-4 h-4" /> View Operational Brackets
            </button>
         </div>

         <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

            {/* LEFT: MISSION DIRECTIVES */}
            <div className="lg:col-span-7 space-y-8">
               <section className="relative">
                  <div className="active-glow absolute -inset-0.5 bg-accent/10 blur opacity-20" />
                  <div className="relative bg-black border border-white/10 p-10 rounded-sm shadow-2xl min-h-[400px]">
                     <div className="relative z-10 space-y-8 h-full">
                        <div className="flex items-center gap-3 mb-10">
                           <div className="w-2 h-2 rounded-full bg-accent animate-ping" />
                           <h2 className="text-[11px] font-black text-accent uppercase tracking-[0.5em] italic">Active Mission Directives</h2>
                        </div>

                        {displayMatches.length > 0 ? (
                           <div className="space-y-6">
                              {displayMatches.length > 1 && (
                                 <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] italic mb-6 border-l-2 border-accent pl-4">
                                    Multiple operational sectors active. Engage objectives sequentially.
                                 </p>
                              )}
                              {displayMatches.map(m => renderMissionCard(m))}
                           </div>
                        ) : playerStatus?.isEliminated ? (
                           <div className="py-12 space-y-6">
                              <div className="flex items-center gap-4">
                                 <ShieldAlert className="w-12 h-12 text-red-600" />
                                 <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Mission Terminated</h3>
                              </div>
                              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em] italic leading-loose max-w-lg">
                                 Casualty detected. You have been eliminated from this series. <br />
                                 <span className="text-red-500/40">Neural feed preserved for post-mission analysis.</span>
                              </p>
                           </div>
                        ) : playerStatus?.isQualified ? (
                           <div className="py-12 space-y-6">
                              <div className="flex items-center gap-4">
                                 <ShieldCheck className="w-12 h-12 text-accent animate-pulse" />
                                 <h3 className="text-4xl font-black text-white italic uppercase tracking-tighter">Sector Secured</h3>
                              </div>
                              <p className="text-[11px] text-gray-500 font-bold uppercase tracking-[0.3em] italic leading-loose max-w-lg">
                                 Operational goals achieved. You have qualified for the next mission cycle. <br />
                                 <span className="text-accent/40">Maintain comms silence until the bracket shifts.</span>
                              </p>
                           </div>
                        ) : (
                           <div className="py-20 text-center lg:text-left">
                              <h3 className="text-3xl font-black text-gray-800 italic uppercase tracking-tighter mb-4">Awaiting Signal</h3>
                              <p className="text-[11px] text-gray-600 font-bold uppercase tracking-[0.3em] italic">
                                 Standby for tournament progression. <br />Checking centralized command for updates...
                              </p>
                              <div className="mt-8 flex items-center gap-3 opacity-30">
                                 <Loader2 className="w-4 h-4 animate-spin text-accent" />
                                 <span className="text-[10px] font-black uppercase tracking-widest animate-pulse">Establishing Link...</span>
                              </div>
                           </div>
                        )}
                     </div>
                  </div>
               </section>

               {/* RULES GRID */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-surface/10 border border-white/5 p-8 rounded-sm space-y-4">
                     <Activity className="w-8 h-8 text-accent" />
                     <h4 className="text-[12px] font-black text-white uppercase tracking-widest italic">Absolute Victory</h4>
                     <p className="text-[11px] text-gray-500 font-bold uppercase leading-relaxed tracking-tighter italic">
                        In the case of network issues in game and the game decides a winner without the match completion, the winner given by the game should register 1-0, but if the two players agree for a replay, a replay should happen.
                     </p>
                  </div>
                  <div className="bg-surface/10 border border-white/5 p-8 rounded-sm space-y-4">
                     <ShieldAlert className="w-8 h-8 text-red-500" />
                     <h4 className="text-[12px] font-black text-white uppercase tracking-widest italic">Tactical Integrity</h4>
                     <p className="text-[11px] text-gray-500 font-bold uppercase leading-relaxed tracking-tighter italic">
                        Reported scores are cross-verified. Any mismatch triggers an immediate intervention and penalty audit.
                     </p>
                  </div>
               </div>
            </div>

            {/* RIGHT: GLOBAL CHAT */}
            <div className="lg:col-span-5 h-[750px]">
               <CompetitionChat competitionId={(competition as any).id} competitionTitle={competition.title} />
            </div>

         </div>

         <TacticalMap
            competition={competition}
            allMatches={allMatches}
            isOpen={showTacticalMap}
            onClose={() => setShowTacticalMap(false)}
         />

         {/* Report Confirmation Modal */}
         {showReportModal && (
            <div className="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-300">
               <div className="bg-surface border border-red-500/30 rounded-lg p-8 max-w-md w-full shadow-2xl animate-in zoom-in duration-300">
                  <div className="flex items-center gap-4 mb-6">
                     <ShieldAlert className="w-8 h-8 text-red-500 animate-pulse" />
                     <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Combat Incident Report</h3>
                  </div>
                  
                  <div className="space-y-4 mb-8">
                     <p className="text-[11px] text-gray-300 font-bold uppercase leading-relaxed tracking-tight">
                        ⚠️ ALERT: This will escalate the match to HQ Command for immediate investigation.
                     </p>
                     <p className="text-[10px] text-red-400 font-bold uppercase leading-relaxed tracking-tight">
                        Only use for legitimate tactical violations or system failures. False reports may result in penalties.
                     </p>
                  </div>

                  <div className="flex gap-4">
                     <button
                        onClick={() => {
                           if (reportingMatchId) {
                              handleIntervention(reportingMatchId);
                           }
                           setShowReportModal(false);
                           setReportingMatchId(null);
                        }}
                        disabled={intervening}
                        className="flex-1 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-widest text-[10px] rounded-sm transition-all flex items-center justify-center gap-2"
                     >
                        {intervening ? <Loader2 className="w-4 h-4 animate-spin" /> : 'DEPLOY REPORT'}
                     </button>
                     <button
                        onClick={() => {
                           setShowReportModal(false);
                           setReportingMatchId(null);
                        }}
                        className="flex-1 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-black uppercase tracking-widest text-[10px] rounded-sm transition-all"
                     >
                        CANCEL
                     </button>
                  </div>
               </div>
            </div>
         )}

      </div>
   );
}
