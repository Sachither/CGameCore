"use client";

import React, { useState, useEffect, useRef } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, HofCategory, getHofWeekKey, getHofPhase } from '@/lib/hof-service';
import { useAuth } from '@/components/auth/AuthProvider';
import { voteHofEntryAction, deleteMyHofEntryAction } from '@/app/actions/hof-actions';
import { useToast } from '@/context/ToastContext';
import { Trophy, Play, Heart, Star, LayoutGrid, Plus, Pause, Crown, ShieldAlert, ThumbsUp, Loader2, Target, Swords, Timer, Trash2 } from 'lucide-react';
import HofLightbox from './HofLightbox';
import { auth } from '@/lib/firebase';

interface HofVotingGridProps {
  userRestricted?: boolean;
}

export default function HofVotingGrid({ userRestricted = false }: HofVotingGridProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [winners, setWinners] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<{ list: HofEntry[], index: number } | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<HofCategory | 'ALL'>('ALL');
  const [processingId, setProcessingId] = useState<string | null>(null);
  
  const clickTimer = useRef<NodeJS.Timeout | null>(null);
  const videoRefs = useRef<{ [key: string]: HTMLVideoElement | null }>({});
  
  const phase = getHofPhase();
  const weekKey = getHofWeekKey();

  useEffect(() => {
    if (userRestricted && !user) {
      setEntries([]);
      setWinners([]);
      setLoading(false);
      return;
    }

    const activeConstraints: any[] = [
      where("weekKey", "==", weekKey),
      where("status", "==", "ACTIVE"),
    ];

    if (userRestricted && user) {
      activeConstraints.push(where("uid", "==", user.uid));
    }

    const activeQuery = query(
      collection(db, "hall_of_fame_entries"),
      ...activeConstraints,
      orderBy(userRestricted ? "createdAt" : "voteCount", userRestricted ? "desc" : "desc")
    );

    const unsubActive = onSnapshot(activeQuery, (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
      setLoading(false);
    });

    let unsubWinners = () => {};
    if (!userRestricted) {
      const winnersQ = query(
        collection(db, "hall_of_fame_entries"),
        where("status", "==", "WINNER")
      );
      unsubWinners = onSnapshot(winnersQ, (snap) => {
        setWinners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
      });
    } else {
      setWinners([]);
    }

    return () => {
      unsubActive();
      unsubWinners();
    };
  }, [weekKey, userRestricted, user]);

  const handleVote = async (entryId: string) => {
    if (!user) {
      window.location.href = '/login?callback=/';
      return;
    }
    if (processingId) return;
    
    setProcessingId(entryId);
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
    } finally {
      setProcessingId(null);
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

  const handleDelete = async (entryId: string) => {
    if (!window.confirm("Delete your submission? You can post a new one afterwards.") || processingId) return;
    
    setProcessingId(entryId);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      const res = await deleteMyHofEntryAction(idToken, entryId);
      if (res.success) {
        toast.success("REMOVED", "Your entry has been deleted.");
      } else {
        toast.error("ERROR", res.error);
      }
    } catch (err: any) {
      toast.error("ERROR", err.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filteredEntries = activeFilter === 'ALL' 
    ? entries 
    : entries.filter(e => e.category === activeFilter);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
         <Loader2 className="w-10 h-10 text-accent animate-spin" />
         <p className="text-[10px] font-black uppercase tracking-[0.3em] text-sub">Syncing Global Combat Records...</p>
      </div>
    );
  }

  return (
    <div className="space-y-16">
      {/* Hall of Champions */}
      {!userRestricted && winners.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 py-12 bg-accent/5 border border-accent/10 rounded-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Trophy className="w-32 h-32 text-accent" />
          </div>
          
          <div className="flex items-center gap-4 mb-8">
             <Trophy className="w-8 h-8 text-accent shadow-[0_0_15px_#00FF66]" />
             <div>
                <h2 className="text-xl md:text-2xl font-black text-main italic uppercase tracking-tighter">Hall of Champions</h2>
                <p className="text-[9px] text-accent font-black uppercase tracking-widest italic">Current Reigning Elite</p>
             </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 justify-center">
             {winners.map((entry, idx) => (
                <div 
                  key={entry.id}
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
                         <div className="ml-auto bg-accent text-black px-2 py-0.5 rounded-full text-[8px] font-bold uppercase">WINNER</div>
                      </div>
                   </div>
                </div>
             ))}
          </div>
        </div>
      )}

      <div className="space-y-12">
      {/* Category Toggles */}
      <div className="flex flex-wrap items-center justify-center gap-3">
         {(['ALL', 'eFOOTBALL_GOAL', 'CODM_WIPE'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-sm border transition-all flex items-center gap-2 ${
                activeFilter === f 
                  ? 'bg-accent text-black border-accent' 
                  : 'bg-white/5 text-sub border-white/10 hover:bg-white/10'
              }`}
            >
              {f === 'ALL' && <Swords className="w-3 h-3" />}
              {f === 'eFOOTBALL_GOAL' && <Target className="w-3 h-3" />}
              {f === 'CODM_WIPE' && <Trophy className="w-3 h-3" />}
              {f === 'ALL' ? 'ALL' : (f === 'eFOOTBALL_GOAL' ? "eFootball Best Goal" : "Best CODM Wipeout")}
            </button>
         ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-8">
         {filteredEntries.map((entry, idx) => {
            const hasVoted = user && entry.voterUids?.includes(user.uid);
            return (
              <div 
                key={entry.id} 
                className={`relative aspect-[9/16] bg-surface-hover rounded-xl border overflow-hidden cursor-pointer group hover:border-accent/40 transition-all hover:-translate-y-1 shadow-2xl ${hasVoted ? 'border-accent/40 ring-1 ring-accent/20' : 'border-white/5'}`}
                onClick={() => handleEntryClick(entry, idx, filteredEntries)}
              >
                 {/* Video Player */}
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

                 {/* Center Play Indicator */}
                 <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                    <div className={`w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/20 flex items-center justify-center transition-all ${playingId === entry.id ? 'opacity-0 scale-110' : 'opacity-100 group-hover:bg-accent group-hover:text-black group-hover:border-accent group-hover:scale-110 shadow-[0_0_20px_rgba(0,255,102,0.2)]'}`}>
                       {playingId === entry.id ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
                    </div>
                 </div>

                 {/* Overlay Info */}
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

                    {/* User's own delete button */}
                    {user?.uid === entry.uid && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id!); }}
                        className="absolute top-3 right-3 p-1.5 bg-red-500/80 hover:bg-red-500 text-white rounded-sm transition-all pointer-events-auto z-30"
                      >
                         <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                    
                    <div className="flex items-center justify-between">
                       <div className="flex gap-1.5">
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleVote(entry.id!); }}
                            className={`p-1.5 backdrop-blur-md rounded-full border transition-all pointer-events-auto shadow-lg ${hasVoted ? 'bg-accent text-black border-accent' : 'bg-black/40 text-white border-white/10 hover:bg-accent hover:text-black'}`}
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
         })}
      </div>

      {filteredEntries.length === 0 && (
         <div className="text-center p-20 border border-dashed border-surface-border rounded-sm">
            <p className="text-sub text-xs font-black uppercase tracking-widest">No entries in this theatre yet.</p>
            <p className="text-[10px] text-gray-600 mt-2">Be the first to submit evidence of your dominance!</p>
         </div>
      )}

      </div>

      {selectedEntry && (
        <HofLightbox 
          entries={selectedEntry.list}
          initialIndex={selectedEntry.index}
          isOpen={true}
          onClose={() => setSelectedEntry(null)}
        />
      )}
    </div>
  );
}
