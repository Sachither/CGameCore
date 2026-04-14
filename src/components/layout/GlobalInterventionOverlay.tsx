"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { ShieldAlert, Gavel, ExternalLink, Loader2, X, AlertOctagon } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { dismissSelfInterventionAction } from '@/app/actions/admin-actions';

export default function GlobalInterventionOverlay() {
  const { profile, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  // Derived state
  const activeIntervention = profile?.intervention?.active;
  const matchId = profile?.intervention?.matchId;

  // Synchronous initial check for Next.js Client Comp
  const getInitialHaltState = () => {
    if (typeof window === 'undefined') return false;
    const halted = sessionStorage.getItem('cgame_intervention_halted');
    if (halted === 'true') return true;
    if (matchId && sessionStorage.getItem(`match_ready_ack_${matchId}`) === 'true') return true;
    return false;
  };

  // Local/Session state to kill the loop if it flickers
  const [isHalted, setIsHalted] = useState(getInitialHaltState);
  const [isDismissing, setIsDismissing] = useState(false);

  // Check again on matchId change
  useEffect(() => {
    if (typeof window !== 'undefined') {
       const halted = sessionStorage.getItem('cgame_intervention_halted');
       if (halted === 'true') setIsHalted(true);
       if (matchId && sessionStorage.getItem(`match_ready_ack_${matchId}`) === 'true') {
          setIsHalted(true);
       }
    }
  }, [matchId]);

  // 1. handleDismiss MUST be defined before it is used in any useEffect or handler
  const handleDismiss = async () => {
    if (!user) {
        setIsHalted(true);
        return;
    }
    setIsDismissing(true);
    setIsHalted(true);
    sessionStorage.setItem('cgame_intervention_halted', 'true');
    
    try {
      const idToken = await user.getIdToken();
      await dismissSelfInterventionAction(idToken);
    } catch (e) {
      console.error("[Intervention] Dismissal failed:", e);
    }
    setIsDismissing(false);
  };

  const handleRedirect = async () => {
    if (!matchId) return;
    setIsHalted(true); // Optimistic hide
    
    try {
      if (user) {
        const idToken = await user.getIdToken();
        dismissSelfInterventionAction(idToken); // Background fire
      }
    } catch(e) {}

    try {
      router.push(`/match/${matchId}`);
    } catch (e) {
      window.location.href = `/match/${matchId}`;
    }
  };

  // 2. SELF-HEALING EFFECT: If we are already on the match page, kill the alert.
  useEffect(() => {
    if (activeIntervention && matchId && pathname.includes(matchId)) {
      console.log("[Intervention] Auto-clearing: User has arrived at target arena.");
      handleDismiss();
    }
  }, [pathname, activeIntervention, matchId]);

  // 3. EARLY RETURN: Should be the LAST thing before the main render.
  // We return null if no intervention, user halted, or they are on the match page.
  if (!activeIntervention || isHalted || (matchId && pathname.includes(matchId))) {
    return null;
  }

  const { message, adminName } = profile!.intervention!;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-red-950/95 backdrop-blur-xl p-4 animate-in fade-in zoom-in duration-300 overflow-y-auto">
      <div className="w-full max-w-xl bg-black border-4 border-red-600 p-10 rounded-sm shadow-[0_0_150px_rgba(220,38,38,0.6)] relative overflow-hidden my-auto">
        
        {/* Extreme Tactical Deco */}
        <div className="absolute top-0 left-0 w-full h-1.5 bg-red-600 animate-pulse shadow-[0_0_20px_rgba(220,38,38,1)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(220,38,38,0.15)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-center text-center">
            <div className="bg-red-600 p-5 rounded-full mb-8 shadow-[0_0_40px_rgba(220,38,38,0.5)] border-2 border-white/20">
                <ShieldAlert className="w-14 h-14 text-white animate-bounce" />
            </div>

            <h2 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter mb-4 scale-y-110">
                Admin <span className="text-red-500 underline decoration-red-600 decoration-4 underline-offset-8">Intervention</span>
            </h2>
            
            <div className="flex items-center gap-4 mb-8">
                <div className="h-px w-12 bg-red-600/50" />
                <span className="text-[11px] font-black uppercase tracking-[0.6em] text-red-500 animate-pulse">Priority Alpha Alert</span>
                <div className="h-px w-12 bg-red-600/50" />
            </div>

            <div className="bg-red-950/30 border-y border-red-600/50 p-8 w-full mb-10 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-black px-4 flex items-center gap-2">
                    <Gavel className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-500">Official Directive from {adminName}</span>
                </div>
                <p className="text-white text-lg md:text-xl font-black leading-relaxed italic tracking-tight">
                    "{message || "Condition Green: No specific intel provided. Report to Arena Headquarters immediately."}"
                </p>
            </div>

            <div className="w-full space-y-4">
                <button 
                    onClick={handleRedirect}
                    disabled={isDismissing}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] py-6 rounded-sm text-base transition-all hover:scale-[1.03] active:scale-95 flex items-center justify-center gap-4 shadow-[0_0_50px_rgba(220,38,38,0.4)] border border-white/10 group"
                >
                    <ExternalLink className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                    Secure Local Arena
                </button>
                
                <div className="flex flex-col gap-2 pt-4">
                    <button 
                       onClick={handleDismiss}
                       disabled={isDismissing}
                       className="text-[10px] text-red-500/60 hover:text-red-600 font-black uppercase tracking-[0.4em] py-3 transition-all hover:underline flex items-center justify-center gap-2"
                    >
                       {isDismissing ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                       Override & Acknowledge
                    </button>

                    <button 
                       onClick={() => { setIsHalted(true); sessionStorage.setItem('cgame_intervention_halted', 'true'); }}
                       className="text-[8px] text-gray-700 hover:text-red-500/40 font-bold uppercase tracking-[0.5em] mt-4 flex items-center justify-center gap-2 py-2"
                    >
                       <AlertOctagon className="w-2.5 h-2.5" /> Stop Loop / System Malfunction
                    </button>
                </div>
            </div>
        </div>

        {/* Tactical Overlay Data */}
        <div className="absolute top-2 right-4 text-[7px] font-mono text-red-600/30 uppercase tracking-[0.3em]">
            Stream // INTERVENE_SIG_BETA
        </div>
        <div className="absolute bottom-2 left-4 text-[7px] font-mono text-red-600/30 uppercase tracking-[0.3em]">
            Lat: {pathname.slice(0, 10).toUpperCase()} // Arena: {matchId?.slice(0, 8) || "N/A"}
        </div>
      </div>
    </div>
  );
}
