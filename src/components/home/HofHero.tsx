"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, getHofWeekKey } from '@/lib/hof-service';
import HofVideoEmbed from '@/components/hall-of-fame/HofVideoEmbed';
import { Trophy, Play, Swords, ArrowRight, Zap } from 'lucide-react';

export default function HofHero() {
  const [winner, setWinner] = useState<HofEntry | null>(null);
  const [contenders, setContenders] = useState<HofEntry[]>([]);
  const weekKey = getHofWeekKey();

  useEffect(() => {
    // 1. Fetch current winners (if any)
    const qWinner = query(
      collection(db, "hall_of_fame_entries"),
      where("status", "==", "WINNER"),
      orderBy("createdAt", "desc"),
      limit(1)
    );

    const unsubWinner = onSnapshot(qWinner, (snap) => {
      if (!snap.empty) {
        setWinner({ id: snap.docs[0].id, ...snap.docs[0].data() } as HofEntry);
      }
    });

    // 2. Fetch top contenders for the current week
    const qContenders = query(
      collection(db, "hall_of_fame_entries"),
      where("weekKey", "==", weekKey),
      where("status", "==", "ACTIVE"),
      orderBy("voteCount", "desc"),
      limit(3)
    );

    const unsubContenders = onSnapshot(qContenders, (snap) => {
      setContenders(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
    });

    return () => {
      unsubWinner();
      unsubContenders();
    };
  }, [weekKey]);

  return (
    <section className="relative w-full bg-black py-24 overflow-hidden border-b border-surface-border">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_30%,rgba(0,255,102,0.05),transparent)] pointer-events-none"></div>
      
      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row gap-16 items-center">
          
          {/* Left Side: Featured Play (The Winner) */}
          <div className="w-full lg:w-1/2 space-y-8">
             <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-accent/10 border border-accent/20 rounded-full">
                <Trophy className="w-4 h-4 text-accent" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Hall of Fame Champion</span>
             </div>

             <h2 className="text-5xl md:text-7xl font-black text-main italic uppercase tracking-tighter leading-none">
                THE ELITE <br/> <span className="text-accent">STRIKE.</span>
             </h2>

             <p className="text-gray-400 text-lg font-medium max-w-lg leading-relaxed">
                Watch the most tactical plays from across the globe. Submit your own clips, 
                rally the community, and claim your spot on the landing page.
             </p>

             <div className="pt-4 flex flex-col sm:flex-row gap-4">
                <Link 
                  href="/dashboard/hall-of-fame"
                  className="px-8 py-4 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-xs italic transition-all flex items-center justify-center gap-2 shadow-[0_10px_20px_rgba(0,255,102,0.2)]"
                >
                   <Zap className="w-4 h-4 fill-current" />
                   ENLIST NOW
                </Link>
                <Link 
                  href="/dashboard/hall-of-fame"
                  className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase tracking-widest text-xs italic transition-all flex items-center justify-center gap-2"
                >
                   VIEW ALL PLAYS
                   <ArrowRight className="w-4 h-4" />
                </Link>
             </div>

             {/* Contender Teaser (Desktop) */}
             <div className="hidden lg:block pt-12 space-y-4">
                <p className="text-[10px] font-black text-sub uppercase tracking-[0.3em] flex items-center gap-3">
                   <span className="w-8 h-[1px] bg-surface-border"></span>
                   Weekly Contenders
                </p>
                <div className="flex gap-4">
                   {contenders.map((c, i) => (
                      <div key={c.id} className="w-16 h-16 rounded-sm bg-surface-hover border border-surface-border flex items-center justify-center overflow-hidden grayscale hover:grayscale-0 transition-all cursor-pointer">
                         <div 
                            className="w-[300%] h-[300%]"
                            style={{
                              backgroundImage: `url('/avatar_collection.png')`,
                              backgroundSize: '400% 500%',
                              backgroundPosition: `${((c.avatarId || 0) % 4) * 33.33}% ${Math.floor((c.avatarId || 0) / 4) * 25}%`
                            }}
                         />
                      </div>
                   ))}
                   {contenders.length === 0 && <div className="text-[10px] text-gray-700 italic">No evidence submitted yet.</div>}
                </div>
             </div>
          </div>

          {/* Right Side: Big Video Embed */}
          <div className="w-full lg:w-1/2 relative">
             {/* Glow behind video */}
             <div className="absolute inset-0 bg-accent/20 blur-[100px] rounded-full pointer-events-none opacity-40"></div>
             
             <div className="relative bg-surface border border-surface-border p-2 rounded-sm shadow-2xl rotate-2 hover:rotate-0 transition-transform duration-500">
                {winner ? (
                  <HofVideoEmbed url={winner.videoUrl} type={winner.embedType} />
                ) : (
                  <div className="aspect-[9/16] bg-black flex flex-col items-center justify-center text-center p-10 space-y-6">
                     <Swords className="w-16 h-16 text-accent/20" />
                     <div className="space-y-2">
                        <p className="text-lg font-black text-main uppercase italic">The Throne is Empty</p>
                        <p className="text-[10px] text-sub font-bold uppercase tracking-widest">Submit your clip and claim the glory</p>
                     </div>
                  </div>
                )}

                {/* Info Overlay */}
                {winner && (
                  <div className="absolute bottom-6 left-6 right-6 p-4 bg-black/60 backdrop-blur-md border border-white/10 rounded-sm flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <div 
                          className="w-10 h-10 rounded-full border border-accent/40 bg-black"
                          style={{
                            backgroundImage: `url('/avatar_collection.png')`,
                            backgroundSize: '400% 500%',
                            backgroundPosition: `${((winner.avatarId || 0) % 4) * 33.33}% ${Math.floor((winner.avatarId || 0) / 4) * 25}%`
                          }}
                        />
                        <div className="flex flex-col">
                           <span className="text-[12px] font-black text-white uppercase italic">{winner.username}</span>
                           <span className="text-[9px] text-accent font-bold uppercase tracking-widest">Last Week's MVP</span>
                        </div>
                     </div>
                     <div className="bg-accent/10 border border-accent/30 px-3 py-1 rounded-sm">
                        <span className="text-[10px] font-mono font-bold text-accent">{winner.voteCount} VOTES</span>
                     </div>
                  </div>
                )}
             </div>
          </div>

        </div>
      </div>
    </section>
  );
}
