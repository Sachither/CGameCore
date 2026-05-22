"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, getPrevWeekKey } from '@/lib/hof-service';
import { Crown, Trophy, Play, Pause, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function HofHeroCarousel() {
  const [winners, setWinners] = useState<HofEntry[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const updateTimer = useRef<NodeJS.Timeout | null>(null);
  const pendingWinners = useRef<HofEntry[] | null>(null);
  const prevWeekKey = getPrevWeekKey();

  useEffect(() => {
    // Fetch winners from the previous week
    const q = query(
      collection(db, "hall_of_fame_entries"),
      where("status", "==", "WINNER"),
      limit(5) // Show up to 5 recent winners
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry));
      pendingWinners.current = docs;

      // Debounce updates (500ms throttle)
      if (updateTimer.current) clearTimeout(updateTimer.current);
      updateTimer.current = setTimeout(() => {
        if (pendingWinners.current) {
          setWinners(pendingWinners.current);
        }
        updateTimer.current = null;
      }, 500);
    });

    return () => {
      unsub();
      if (updateTimer.current) clearTimeout(updateTimer.current);
    };
  }, [prevWeekKey]);

  useEffect(() => {
    if (winners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % winners.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [winners]);

  if (winners.length === 0) {
    // Sample placeholder if no winners yet
    return (
      <div className="w-full max-w-sm aspect-[9/16] bg-surface-hover rounded-xl border border-white/5 overflow-hidden relative group">
         <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center space-y-4">
            <Trophy className="w-12 h-12 text-accent/20" />
            <p className="text-[10px] font-black uppercase tracking-widest text-sub">Combat Champions Area</p>
            <p className="text-xs text-gray-500 font-bold italic">Winners of the Weekly War Room will be immortalized here.</p>
         </div>
      </div>
    );
  }

  const current = winners[activeIndex];

  return (
    <div className="relative w-full max-w-[280px] md:max-w-[320px] aspect-[9/16] bg-black rounded-2xl border border-accent/30 overflow-hidden shadow-[0_0_50px_rgba(0,255,102,0.15)] group animate-in fade-in zoom-in duration-700">
       {/* Background Video */}
       <video 
         key={current.id}
         src={current.videoUrl}
         className="absolute inset-0 w-full h-full object-cover opacity-60"
         autoPlay
         muted
         loop
         playsInline
       />

       {/* Glass Overlay */}
       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent p-6 flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <div className="px-3 py-1 bg-accent text-black text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 rounded-full shadow-[0_0_20px_#00FF66]">
                <Crown className="w-3 h-3 fill-current" />
                WEEKLY CHAMPION
             </div>
             
             <div className="flex gap-1">
                {winners.map((_, i) => (
                   <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === activeIndex ? 'w-4 bg-accent' : 'w-1 bg-white/20'}`} />
                ))}
             </div>
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-3">
                <div 
                   className="w-10 h-10 rounded-full border border-white/20 bg-black shadow-xl"
                   style={{
                     backgroundImage: `url('/avatar_collection.png')`,
                     backgroundSize: '400% 500%',
                     backgroundPosition: `${((current.avatarId || 0) % 4) * 33.33}% ${Math.floor((current.avatarId || 0) / 4) * 25}%`
                   }}
                />
                <div className="flex flex-col">
                   <span className="text-xs font-black text-white uppercase italic tracking-tighter">{current.username}</span>
                   <span className="text-[9px] text-accent font-black uppercase tracking-widest leading-none mt-1">
                      {current.category === 'eFOOTBALL_GOAL' ? 'ELITE STRIKER' : 'SQUAD WIPE MASTER'}
                   </span>
                </div>
             </div>

             <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <Link 
                   href="/" 
                   className="flex items-center gap-2 text-white hover:text-accent transition-colors text-[10px] font-black uppercase tracking-widest"
                >
                   View Hall of Fame
                   <ChevronRight className="w-3 h-3" />
                </Link>
             </div>
          </div>
       </div>

       {/* Progress Bar */}
       <div className="absolute bottom-0 left-0 h-1 bg-accent/30 w-full overflow-hidden">
          <div className="h-full bg-accent animate-progress duration-[8000ms] origin-left" />
       </div>
    </div>
  );
}
