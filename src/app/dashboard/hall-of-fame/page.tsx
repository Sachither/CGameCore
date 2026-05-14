"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Trophy, Swords, Zap, Timer, Info, Trophy as TrophyIcon } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import RestrictedDashboardPrompt from '@/components/dashboard/RestrictedDashboardPrompt';
import HofVotingGrid from '@/components/hall-of-fame/HofVotingGrid';
import HofSubmissionModal from '@/components/hall-of-fame/HofSubmissionModal';
import { getHofPhase } from '@/lib/hof-service';

export default function HallOfFamePage() {
  const { user } = useAuth();
  const [isSubmitOpen, setSubmitOpen] = useState(false);
  const phase = getHofPhase();

  if (!user) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-12 pb-20">
        <div className="relative overflow-hidden p-10 md:p-16 border border-surface-border bg-surface/30 rounded-sm">
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
            <div className="space-y-4 max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                <span className="text-[10px] font-black uppercase tracking-widest text-accent">Combat Archives Active</span>
              </div>
              <h1 className="text-5xl md:text-6xl font-black text-main italic uppercase tracking-tighter leading-tight">
                THE HALL OF <span className="text-accent">FAME</span>
              </h1>
              <p className="text-sm md:text-lg text-gray-400 font-medium leading-relaxed">
                The elite standard for combat excellence. Post your best plays and let the community decide who reigns supreme.
              </p>
            </div>
          </div>
        </div>

        <RestrictedDashboardPrompt callback="/dashboard/hall-of-fame" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-12 pb-20">
      {/* Hero / Header */}
      <div className="relative overflow-hidden p-10 md:p-16 border border-surface-border bg-surface/30 rounded-sm">
         {/* Background Ambience */}
         <div className="absolute top-0 right-0 w-1/2 h-full bg-[radial-gradient(circle_at_100%_0%,rgba(0,255,102,0.05),transparent)] pointer-events-none"></div>
         <div className="absolute bottom-0 left-0 w-1/3 h-1/2 bg-[radial-gradient(circle_at_0%_100%,rgba(0,255,102,0.03),transparent)] pointer-events-none"></div>

         <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-10">
            <div className="space-y-4 max-w-2xl">
               <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-accent animate-pulse"></span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-accent">Combat Archives Active</span>
               </div>
               <h1 className="text-5xl md:text-6xl font-black text-main italic uppercase tracking-tighter leading-tight">
                 THE HALL OF <span className="text-accent">FAME</span>
               </h1>
               <p className="text-sm md:text-lg text-gray-400 font-medium leading-relaxed">
                 The elite standard for combat excellence. Post your best eFootball goals, 
                 CODM squad wipes, and tactical highlights. Let the community decide who reigns supreme.
               </p>
            </div>

            <div className="shrink-0 flex flex-col gap-4 w-full md:w-auto">
               <button 
                 onClick={() => setSubmitOpen(true)}
                 disabled={phase !== 'SUBMISSION'}
                 className="group relative px-10 py-5 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-xs italic transition-all overflow-hidden shadow-[0_10px_30px_rgba(0,255,102,0.2)] disabled:opacity-40 disabled:cursor-not-allowed"
               >
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    <Zap className="w-4 h-4 fill-current group-hover:scale-110 transition-transform" />
                    {phase === 'SUBMISSION' ? 'SUBMIT YOUR PLAY' : 'SUBMISSION CLOSED'}
                  </span>
               </button>
               
               <div className="p-4 border border-white/5 bg-black/40 rounded-sm flex items-center gap-4">
                  <Timer className="w-5 h-5 text-accent" />
                  <div className="flex flex-col">
                     <span className="text-[9px] font-black text-sub uppercase tracking-widest leading-none mb-1">Current Phase</span>
                     <span className="text-xs font-bold text-main uppercase italic">
                        {phase === 'SUBMISSION' ? 'Recruitment Window (Mon-Wed)' : 'Voting War (Wed-Sun)'}
                     </span>
                  </div>
               </div>
            </div>
         </div>
      </div>

      {/* Rules / Ticker */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="p-6 bg-surface/20 border border-surface-border rounded-sm flex items-start gap-4">
            <TrophyIcon className="w-6 h-6 text-accent shrink-0" />
            <div>
               <h4 className="text-[11px] font-black text-main uppercase italic tracking-widest mb-1">Weekly Glory</h4>
               <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Top voted plays from each category are crowned every Sunday night and featured on the Landing Page.</p>
            </div>
         </div>
         <div className="p-6 bg-surface/20 border border-surface-border rounded-sm flex items-start gap-4">
            <Swords className="w-6 h-6 text-accent shrink-0" />
            <div>
               <h4 className="text-[11px] font-black text-main uppercase italic tracking-widest mb-1">No Payouts?</h4>
               <p className="text-[10px] text-gray-500 leading-relaxed font-medium">This arena is for Status and Fame. Winners receive a permanent Champion Badge on their profile.</p>
            </div>
         </div>
         <div className="p-6 bg-surface/20 border border-surface-border rounded-sm flex items-start gap-4">
            <Info className="w-6 h-6 text-accent shrink-0" />
            <div>
               <h4 className="text-[11px] font-black text-main uppercase italic tracking-widest mb-1">Anti-Cheat</h4>
               <p className="text-[10px] text-gray-500 leading-relaxed font-medium">Suspicious voting patterns or stolen content result in immediate disqualification and platform ban.</p>
            </div>
         </div>
      </div>

      <hr className="border-surface-border" />

      {/* Main Grid */}
<HofVotingGrid userRestricted />

      {/* Submission Modal */}
      <HofSubmissionModal 
        isOpen={isSubmitOpen} 
        onClose={() => setSubmitOpen(false)} 
      />
    </div>
  );
}
