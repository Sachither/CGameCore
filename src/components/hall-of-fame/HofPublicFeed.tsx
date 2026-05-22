"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, HofCategory, getHofWeekKey, getPrevWeekKey } from '@/lib/hof-service';
import HofVideoEmbed from './HofVideoEmbed';
import HofLightbox from './HofLightbox';
import HofIntroModal from './HofIntroModal';
import { Trophy, Play, Heart, Star, LayoutGrid, Plus, Pause, Crown, ShieldAlert, ThumbsUp } from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { voteHofEntryAction } from '@/app/actions/hof-actions';
import { useToast } from '@/context/ToastContext';
import { auth } from '@/lib/firebase';

export default function HofPublicFeed() {
  const { user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [winners, setWinners] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<{ list: HofEntry[], index: number } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEntriesRef = useRef<HofEntry[] | null>(null);
  const pendingWinnersRef = useRef<HofEntry[] | null>(null);
  
  const weekKey = getHofWeekKey();
  const lastWeekKey = getPrevWeekKey();

  useEffect(() => {
    const flushUpdates = () => {
      if (pendingEntriesRef.current !== null) {
        setEntries(pendingEntriesRef.current);
        pendingEntriesRef.current = null;
      }
      if (pendingWinnersRef.current !== null) {
        setWinners(pendingWinnersRef.current);
        pendingWinnersRef.current = null;
      }
      setLoading(false);
    };

    const scheduleFlush = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(flushUpdates, 500);
    };

    const q = query(
      collection(db, "hall_of_fame_entries"),
      where("weekKey", "==", weekKey),
      where("status", "==", "ACTIVE"),
      orderBy("voteCount", "desc")
    );

    const winnersQ = query(
      collection(db, "hall_of_fame_entries"),
      where("status", "==", "WINNER")
    );

    const unsubActive = onSnapshot(q, (snap) => {
      pendingEntriesRef.current = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry));
      scheduleFlush();
    });

    const unsubWinners = onSnapshot(winnersQ, (snap) => {
      pendingWinnersRef.current = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry));
      scheduleFlush();
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      unsubActive();
      unsubWinners();
    };
  }, [weekKey, lastWeekKey]);

  const handleVote = async (entryId: string) => {
    if (!user) {
      setIsIntroOpen(true);
      return;
    }
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      const res = await voteHofEntryAction(idToken, entryId) as any;
      if (res.success) {
        toast.success("VOTE REGISTERED", "Judgment recorded.");
      } else {
        toast.error("VOTE REJECTED", res.error);
      }
    } catch (err: any) {
      toast.error("VOTE FAILED", err.message);
    }
  };

  const handleEntryClick = (entry: HofEntry, idx: number, list: HofEntry[]) => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      
      // Stop background play before entering fullscreen
      if (playingId && videoRefs.current[playingId]) {
        videoRefs.current[playingId]?.pause();
        setPlayingId(null);
      }
      
      setSelectedEntry({ list, index: idx });
    } else {
      clickTimer.current = setTimeout(() => {
        clickTimer.current = null;
        const v = videoRefs.current[entry.id!];
        if (!v) return;

        if (playingId === entry.id) {
          v.pause();
          v.muted = true;
          setPlayingId(null);
        } else {
          if (playingId && videoRefs.current[playingId]) {
             videoRefs.current[playingId]!.pause();
             videoRefs.current[playingId]!.muted = true;
          }
          v.muted = false; 
          v.play().catch(() => {
             v.muted = true;
             v.play();
          });
          setPlayingId(entry.id!);
        }
      }, 250);
    }
  };

  const renderEntryCard = (entry: HofEntry, idx: number, list: HofEntry[], isWinner?: boolean) => (
    <div 
      key={entry.id} 
      className={`relative w-[160px] md:w-[200px] min-w-[160px] md:min-w-[200px] aspect-[9/16] bg-surface-hover rounded-xl border overflow-hidden cursor-pointer group hover:border-accent/40 transition-all hover:-translate-y-1 shadow-2xl ${isWinner ? 'border-accent/40 ring-1 ring-accent/20' : 'border-white/5'}`}
      onClick={() => handleEntryClick(entry, idx, list)}
    >
       <div className="absolute inset-0">
          <video 
              ref={el => {
                videoRefs.current[entry.id!] = el;
                if (el && el.currentTime === 0 && playingId !== entry.id) el.currentTime = 0.5;
              }}
              src={entry.videoUrl} 
              className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              preload="metadata"
              loop
              muted={playingId !== entry.id}
              playsInline
          />
       </div>

       {isWinner && (
         <div className="absolute top-2 left-2 z-10 px-2 py-0.5 bg-accent text-black text-[8px] font-black uppercase tracking-widest flex items-center gap-1 rounded-full shadow-[0_0_15px_#00FF66]">
            <Crown className="w-2.5 h-2.5 fill-current" />
            CHAMPION
         </div>
       )}

       <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className={`w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all ${playingId === entry.id ? 'opacity-0 scale-110' : 'opacity-100 group-hover:bg-accent group-hover:text-black group-hover:border-accent group-hover:scale-110 shadow-[0_0_20px_rgba(0,255,102,0.2)]'}`}>
             {playingId === entry.id ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </div>
       </div>

       <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent pointer-events-none p-3 flex flex-col justify-end z-20">
          <div className="flex items-center gap-1.5 mb-2">
             <div 
                className="w-5 h-5 rounded-full border border-white/20 bg-black"
                style={{
                  backgroundImage: `url('/avatar_collection.png')`,
                  backgroundSize: '400% 500%',
                  backgroundPosition: `${((entry.avatarId || 0) % 4) * 33.33}% ${Math.floor((entry.avatarId || 0) / 4) * 25}%`
                }}
             />
             <span className="text-[9px] font-black text-white uppercase italic truncate max-w-[80px]">{entry.username}</span>
          </div>
          
          <div className="flex items-center justify-between">
             <div className="flex gap-1.5">
                <button 
                  onClick={(e) => { e.stopPropagation(); handleVote(entry.id!); }}
                  className="p-1.5 bg-black/40 backdrop-blur-md rounded-full border border-white/10 hover:bg-accent hover:text-black transition-all pointer-events-auto shadow-lg"
                >
                   <ThumbsUp className="w-3 h-3" />
                </button>
                <div className="bg-black/40 backdrop-blur-md px-2 py-1 rounded-full border border-white/10 flex items-center">
                   <span className="text-[9px] font-mono font-bold text-white">{entry.voteCount}</span>
                </div>
             </div>
          </div>
       </div>
    </div>
  );

  const renderCategoryRow = (cat: HofCategory, title: string) => {
    const catEntries = entries.filter(e => e.category === cat);
    if (catEntries.length === 0) return null;

    return (
      <div key={cat} className="space-y-6">
        <div className="flex items-center justify-between px-6">
           <div className="flex items-center gap-3">
              <div className="w-1 h-5 bg-accent rounded-full shadow-[0_0_10px_#00FF66]"></div>
              <h2 className="text-lg md:text-xl font-black text-main italic uppercase tracking-tighter">{title}</h2>
           </div>
           <div className="text-[9px] text-sub font-black uppercase tracking-widest opacity-60">
              {catEntries.length} CLIPS
           </div>
        </div>

        <div className="flex overflow-x-auto gap-4 px-6 pb-8 scrollbar-hide scroll-smooth">
           {catEntries.map((entry, idx) => renderEntryCard(entry, idx, catEntries))}
        </div>
      </div>
    );
  };

  return (
    <div id="hof-feed" className="w-full bg-black pt-16 pb-16 space-y-16 min-h-screen">
      <div className="px-6 relative max-w-7xl mx-auto">
         <div className="absolute right-6 top-0 hidden md:block">
            <button 
              onClick={() => user ? window.location.href="/dashboard/hall-of-fame" : setIsIntroOpen(true)}
              className="bg-accent text-black px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-accent-hover transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.2)]"
            >
              <Plus className="w-4 h-4" />
              Submit Play
            </button>
         </div>

         <div className="text-center space-y-3 max-w-3xl mx-auto pt-4">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full mb-2">
                <ShieldAlert className="w-3 h-3 text-accent fill-current" />
                <span className="text-[9px] font-black uppercase tracking-widest text-accent">Combat Excellence Feed</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black text-main italic uppercase tracking-tighter leading-none">
                THINK YOU'RE <span className="text-accent">THE BEST?</span>
            </h1>
            <p className="text-sub text-xs md:text-sm font-black uppercase tracking-widest opacity-60 max-w-2xl mx-auto leading-relaxed">
                DEPLOY YOUR EVIDENCE. LET THE WORLD <span className="text-white">CROWN THE ELITE.</span>
            </p>
         </div>
      </div>

      {winners.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-12 bg-accent/5 border border-accent/10 rounded-xl relative overflow-hidden group mb-16">
           <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
              <Trophy className="w-48 h-48 text-accent" />
           </div>

           <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                 <div className="flex items-center gap-4">
                    <Trophy className="w-8 h-8 text-accent shadow-[0_0_15px_#00FF66]" />
                    <div>
                       <h2 className="text-xl md:text-2xl font-black text-main italic uppercase tracking-tighter">Hall of Champions</h2>
                       <p className="text-[9px] text-accent font-black uppercase tracking-widest italic">Last Week's Elite Operatives</p>
                    </div>
                 </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
                 {winners.map((entry, idx) => (
                       <div 
                         key={entry.id || idx}
                         className="relative aspect-[9/16] bg-surface-hover rounded-xl border border-accent overflow-hidden cursor-pointer group/card shadow-[0_0_40px_rgba(0,255,102,0.15)]"
                         onClick={() => handleEntryClick(entry, idx, winners)}
                       >
                          <div className="absolute inset-0">
                             <video 
                                 ref={el => {
                                   videoRefs.current[entry.id!] = el;
                                   if (el && el.currentTime === 0 && playingId !== entry.id) el.currentTime = 0.5;
                                 }}
                                 src={entry.videoUrl} 
                                 className="w-full h-full object-cover group-hover/card:brightness-110 transition-all"
                                loop
                                muted={playingId !== entry.id}
                                playsInline
                            />
                         </div>

                         {/* Center Play Indicator */}
                         <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                            <div className={`w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all ${playingId === entry.id ? 'opacity-0 scale-110' : 'opacity-100 group-hover/card:bg-accent group-hover/card:text-black group-hover/card:border-accent shadow-[0_0_20px_rgba(0,255,102,0.2)]'}`}>
                               {playingId === entry.id ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                            </div>
                         </div>

                         <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-transparent to-transparent p-4 flex flex-col justify-end">
                            <div className="flex items-center gap-2 mb-2">
                               <div className="w-6 h-6 rounded-full border border-accent/40 bg-black flex items-center justify-center p-0.5">
                                  <div 
                                     className="w-full h-full rounded-full"
                                     style={{
                                       backgroundImage: `url('/avatar_collection.png')`,
                                       backgroundSize: '400% 500%',
                                       backgroundPosition: `${((entry.avatarId || 0) % 4) * 33.33}% ${Math.floor((entry.avatarId || 0) / 4) * 25}%`
                                     }}
                                  />
                               </div>
                               <span className="text-[10px] font-black text-white uppercase italic tracking-wider">{entry.username}</span>
                               <div className="ml-auto bg-accent text-black px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-widest shadow-[0_0_10px_#00FF66]">CHAMPION</div>
                            </div>
                         </div>
                       </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <div className="space-y-20">
         {renderCategoryRow('eFOOTBALL_GOAL', 'eFootball Best Goal')}
         {renderCategoryRow('CODM_WIPE', 'Best CODM Wipeout')}
      </div>

      <div className="fixed bottom-8 right-6 md:hidden z-50">
          <button 
            onClick={() => user ? window.location.href="/dashboard/hall-of-fame" : setIsIntroOpen(true)}
            className="w-14 h-14 bg-accent text-black rounded-full shadow-[0_0_30px_rgba(0,255,102,0.4)] flex items-center justify-center animate-bounce"
          >
            <Plus className="w-6 h-6" />
          </button>
      </div>

      {selectedEntry && (
        <HofLightbox 
          entries={selectedEntry.list}
          initialIndex={selectedEntry.index}
          isOpen={true}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <HofIntroModal 
        isOpen={isIntroOpen} 
        onClose={() => setIsIntroOpen(false)} 
      />
    </div>
  );
}
