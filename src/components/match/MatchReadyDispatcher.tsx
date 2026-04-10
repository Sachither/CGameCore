"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { subscribeToUserActiveMatch, Match } from '@/lib/match-service';
import { Swords, Zap, ExternalLink, ShieldCheck, Trophy } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function MatchReadyDispatcher() {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    if (!user) {
      setActiveMatch(null);
      setIsVisible(false);
      return;
    }

    let timeoutId: any = null;

    // Subscribe to real-time match updates
    const unsubscribe = subscribeToUserActiveMatch(user.uid, (match) => {
      // --- THE ELITE SHIELD (PRIMARY) ---
      // Hard-Termination: If this is NOT a High-Stake match (500+ CR), 
      // we immediately kill all alerts and exit. No timers, no flashes.
      const isHighStake = (match?.challengeFee || 0) >= 450;
      
      if (!match || !isHighStake) {
        if (timeoutId) clearTimeout(timeoutId);
        setIsVisible(false);
        setActiveMatch(null);
        return;
      }

      // Logic: Only alert for High Stakes that are READY or WAITING_FOR_OPPONENT
      // and if the user is NOT already on the match page.
      if (match.status === 'READY' || match.status === 'WAITING_FOR_OPPONENT') {
        const matchId = match.id || "";
        const matchPath = `/match/${matchId}`;
        
        // Check if we are already there
        if (pathname === matchPath) {
          setIsVisible(false);
          return;
        }

        // Check if we already acknowledged this match in this session
        const acknowledged = sessionStorage.getItem(`match_ready_ack_${matchId}`);
        if (!acknowledged) {
          setActiveMatch(match);
          
          // --- TACTICAL GRACE PERIOD ---
          // Prevent "flashing" during redirects: Wait 1.5 seconds.
          // If the user navigates to the match page in this time, the effect 
          // cleans up and the notification never appears.
          if (timeoutId) clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            setIsVisible(true);
          }, 1500);
        }
      } else {
        // Match exists and is High Stake, but not in a 'Ready' state
        if (timeoutId) clearTimeout(timeoutId);
        setIsVisible(false);
      }
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [user, pathname]);

  const handleEnterArena = () => {
    if (!activeMatch?.id) return;
    
    // Acknowledge this match ID so it doesn't pop up again for this session
    sessionStorage.setItem(`match_ready_ack_${activeMatch.id}`, 'true');
    setIsVisible(false);
    router.push(`/match/${activeMatch.id}`);
  };

  const handleDismiss = () => {
    if (activeMatch?.id) {
       sessionStorage.setItem(`match_ready_ack_${activeMatch.id}`, 'true');
    }
    setIsVisible(false);
  };

  if (!isVisible || !activeMatch) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-start md:items-center justify-center p-4 py-12 md:py-8 overflow-y-auto custom-scrollbar animate-in fade-in duration-500">
      {/* Heavy Back-drop Overlay - FIXED to viewport */}
      <div className="fixed inset-0 bg-black/95 backdrop-blur-3xl z-[-1]" />
      
      {/* Animated Combat Aura Background - FIXED to viewport */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,rgba(0,255,102,0.15)_0%,transparent_70%)] animate-pulse pointer-events-none z-[-1]" />
      
      <div className="relative w-full max-w-2xl bg-surface border-x-4 border-t-8 border-b-2 border-accent rounded-sm shadow-[0_0_100px_rgba(0,255,102,0.4)] flex flex-col p-8 md:p-12 animate-in slide-in-from-bottom-10 duration-700 my-auto">
        
        {/* Tactical UI Data Overlay */}
        <div className="absolute top-2 right-4 flex items-center gap-2">
            <span className="text-[7px] font-black uppercase tracking-widest text-accent/40">Secure Stream // P-AX-79</span>
        </div>
        
        <div className="flex flex-col items-center text-center">
            {/* Pulsing Combat Icon */}
            <div className="relative mb-10">
                <div className="absolute inset-0 rounded-full bg-accent blur-3xl opacity-20 animate-pulse"></div>
                <div className="w-24 h-24 rounded-full bg-black border-4 border-accent flex items-center justify-center shadow-[0_0_40px_rgba(0,255,102,0.5)] relative z-10">
                    <Swords className="w-12 h-12 text-accent" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-red-600 border-2 border-white flex items-center justify-center animate-bounce z-20">
                    <Zap className="w-4 h-4 text-white fill-white" />
                </div>
            </div>

            <h2 className="text-4xl md:text-7xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none scale-y-110">
                COMBAT <span className="text-accent underline decoration-accent/30 decoration-8 underline-offset-8">READY</span>
            </h2>
            
            <div className="flex items-center gap-6 mb-10">
                <div className="h-px w-16 bg-accent/30" />
                <span className="text-sm font-black uppercase tracking-[0.4em] text-accent animate-pulse">Engage Order Confirmed</span>
                <div className="h-px w-16 bg-accent/30" />
            </div>

            <div className="bg-black/50 border border-accent/20 p-8 w-full mb-12 rounded-sm relative group">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-surface px-4 flex items-center gap-2 border border-accent/30">
                    <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-main">Arena Parameters Secure</span>
                </div>
                
                <div className="grid grid-cols-2 gap-8">
                    <div className="text-right border-r border-accent/20 pr-8">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 leading-none">Competition</p>
                        <p className="text-xl font-black italic text-white uppercase tracking-tighter">{activeMatch.game}</p>
                    </div>
                    <div className="text-left">
                        <p className="text-[9px] font-black uppercase tracking-widest text-gray-400 mb-1 leading-none">Combat Stake</p>
                        <p className="text-xl font-black italic text-main uppercase tracking-tighter">{activeMatch.challengeFee} CR</p>
                    </div>
                </div>
            </div>

            <div className="w-full space-y-4">
                <button 
                    onClick={handleEnterArena}
                    className="w-full bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-[0.2em] py-7 rounded-sm text-lg transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-4 shadow-[0_0_60px_rgba(0,255,102,0.35)] border border-white/20 group"
                >
                    <ExternalLink className="w-7 h-7 group-hover:rotate-12 transition-transform" />
                    ENTER ARENA IMMEDIATELY
                </button>
                
                <div className="flex flex-col items-center gap-2 pt-6">
                    <button 
                       onClick={handleDismiss}
                       className="text-[11px] text-gray-500 hover:text-white font-black uppercase tracking-[0.3em] py-3 transition-all hover:underline"
                    >
                       Acknowledge & Minimise
                    </button>
                    
                    <div className="flex items-center gap-3 mt-4 opacity-50">
                        <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                        <span className="text-[8px] font-bold text-gray-600 uppercase tracking-widest">Awaiting Player Synchronization...</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Tactical Scroll Borders */}
        <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0" />
        <div className="absolute top-0 right-0 w-1.5 h-full bg-gradient-to-b from-accent/0 via-accent/40 to-accent/0" />
      </div>
    </div>
  );
}
