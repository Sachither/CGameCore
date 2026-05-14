"use client";

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { Zap, X, Swords, BellRing } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { dismissTacticalPingAction } from '@/app/actions/ping-actions';

export default function QuickPingOverlay() {
  const { user, profile } = useAuth();
  const [activePing, setActivePing] = useState<any>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    // 🛡️ INTERVENTION-STYLE SIGNALING
    // We stop listening to the notifications collection and instead
    // listen to the Profile object, which is already reactive via AuthProvider.
    if (profile?.ping?.active) {
       const pingInfo = profile.ping;
       const matchId = pingInfo.matchId;

       // 🛡️ HUD SUPPRESSION: Clear alert if user is already in the target arena
       if (matchId && pathname.includes(`/match/${matchId}`)) {
          if (activePing) setActivePing(null);
          return;
       }

       setActivePing(pingInfo);
       
       // Tactical Audio Alert
       try {
         const audio = new Audio('/sounds/sonar-ping.mp3');
         audio.volume = 0.3;
         audio.play().catch(() => {});
       } catch (e) {}
    } else {
       setActivePing(null);
    }
  }, [profile?.ping, pathname]);

  const dismissPing = async () => {
    if (!user || !activePing) return;
    try {
      setActivePing(null); // Optimistic Clear
      const idToken = await user.getIdToken();
      await dismissTacticalPingAction(idToken);
    } catch (e) {
      console.error(e);
    }
  };

  const returnToCombat = async () => {
    if (!activePing) return;
    const matchId = activePing.matchId;
    await dismissPing();
    router.push(`/match/${matchId}`);
  };

  if (!activePing) return null;

  return (
    <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[10000] w-full max-w-sm px-4 animate-in slide-in-from-top-4 duration-500">
      <div className="bg-black/80 backdrop-blur-xl border border-accent/30 rounded-sm shadow-[0_0_50px_rgba(0,255,102,0.2)] overflow-hidden">
        <div className="absolute top-0 left-0 w-1 h-full bg-accent animate-pulse shadow-[0_0_15px_rgba(0,255,102,0.8)]" />
        
        <div className="p-4 flex items-center gap-4">
           <div className="bg-accent/20 p-2.5 rounded-full ring-1 ring-accent/40">
              <BellRing className="w-5 h-5 text-accent animate-bounce" />
           </div>

           <div className="flex-1">
              <h4 className="text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-1 italic">Tactical Warning</h4>
              <p className="text-white text-xs font-black uppercase tracking-tighter leading-tight italic">
                {activePing.message}
              </p>
           </div>

           <button 
             onClick={dismissPing}
             className="text-gray-500 hover:text-white transition-colors"
           >
              <X className="w-5 h-5" />
           </button>
        </div>

        <div className="bg-accent/10 border-t border-accent/20 flex divide-x divide-accent/20">
           <button 
             onClick={dismissPing}
             className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
           >
             Ignore
           </button>
           <button 
             onClick={returnToCombat}
             className="flex-1 py-3 text-[9px] font-black uppercase tracking-widest bg-accent text-black hover:bg-white transition-colors flex items-center justify-center gap-2"
           >
             <Swords className="w-3 h-3" />
             Return to Room
           </button>
        </div>
      </div>
    </div>
  );
}
