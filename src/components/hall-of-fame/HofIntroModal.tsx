"use client";

import React from 'react';
import { X, Trophy, Zap, ShieldAlert, Target, TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface HofIntroModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HofIntroModal({ isOpen, onClose }: HofIntroModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl overflow-y-auto">
      <div className="relative w-full max-w-xl bg-surface border border-white/10 rounded-sm shadow-2xl overflow-hidden animate-in zoom-in duration-300 my-auto">
        {/* Decorative Background */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -mr-32 -mt-32"></div>
        
        {/* Header */}
        <div className="p-8 pb-4 relative">
          <button onClick={onClose} className="absolute top-6 right-6 text-sub hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex items-center gap-3 mb-4">
             <div className="w-12 h-12 rounded-sm bg-accent/10 border border-accent/20 flex items-center justify-center">
                <Trophy className="w-6 h-6 text-accent shadow-[0_0_10px_#00FF66]" />
             </div>
             <div>
                <h2 className="text-2xl md:text-3xl font-black text-main italic uppercase tracking-tighter">THE ARENA OF <span className="text-accent">ELITES</span></h2>
                <p className="text-[10px] text-accent font-black uppercase tracking-widest italic">Hall of Fame Operational Briefing</p>
             </div>
          </div>

          <h3 className="text-lg font-black text-white uppercase italic tracking-tighter mb-4">
            Think you're the best? <span className="text-sub">Prove it or stay in the shadows.</span>
          </h3>
        </div>

        {/* Content Section */}
        <div className="px-8 py-2 space-y-6">
           {/* Timeline */}
           <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-2">
                 <div className="flex items-center gap-2 text-accent">
                    <Target className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Deployment Phase</span>
                 </div>
                 <p className="text-[11px] text-gray-400 font-bold leading-tight">
                    <span className="text-white">MON - WED:</span> Upload your most tactical gameplay evidence.
                 </p>
              </div>
              <div className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-2">
                 <div className="flex items-center gap-2 text-accent">
                    <Zap className="w-4 h-4" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Judgment Phase</span>
                 </div>
                 <p className="text-[11px] text-gray-400 font-bold leading-tight">
                    <span className="text-white">WED - SUN:</span> The community decides who reigns supreme.
                 </p>
              </div>
           </div>

           {/* Reward */}
           <div className="p-5 bg-accent/10 border border-accent/20 rounded-sm flex gap-4">
              <TrendingUp className="w-8 h-8 text-accent shrink-0 mt-1" />
              <div>
                 <h4 className="text-xs font-black text-white uppercase tracking-widest mb-1">THE VICTOR'S SPOILS</h4>
                 <p className="text-[11px] text-gray-400 leading-relaxed">
                    Weekly winners are immortalized on the <span className="text-accent font-bold">CGameCore Home Page Hero</span>. Your combat footage will be the first thing every operative sees.
                 </p>
              </div>
           </div>

           {/* Site Purpose */}
           <div className="py-4 border-t border-white/5 text-center">
              <p className="text-[10px] text-sub font-black uppercase tracking-[0.2em] italic mb-2">Operational Foundation</p>
              <p className="text-xs font-medium text-gray-400 max-w-sm mx-auto leading-relaxed italic">
                 <span className="text-white font-black">CGameCore</span> is the global theatre for high-stakes competition. No amateurs. No excuses. Only tactical excellence.
              </p>
           </div>
        </div>

        {/* CTA Footer */}
        <div className="p-8 pt-4">
           <Link 
             href="/register" 
             className="w-full py-5 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-[0.2em] text-xs italic transition-all flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(0,255,102,0.2)] group"
           >
              ENLIST & DEPLOY FOOTAGE
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
           </Link>
           <p className="text-center mt-4 text-[9px] text-sub font-bold uppercase tracking-widest">
              Already a veteran? <Link href="/login" className="text-white hover:text-accent underline underline-offset-4">Login to uplink</Link>
           </p>
        </div>
      </div>
    </div>
  );
}
