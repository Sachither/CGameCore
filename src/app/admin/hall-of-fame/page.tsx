"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, HofCategory, getPrevWeekKey, getHofWeekKey, getHofCategoryTitle } from '@/lib/hof-service';
import { useAuth } from '@/components/auth/AuthProvider';
import { adminCrownWinnerAction, adminDeleteHofEntryAction, adminSetHofVotesAction } from '@/app/actions/hof-actions';
import { useToast } from '@/context/ToastContext';
import { Trophy, Crown, Trash2, Zap, AlertTriangle, Play, Pause, ShieldAlert, BarChart3, Filter, Clock } from 'lucide-react';
import { auth } from '@/lib/firebase';

export default function AdminHofPage() {
  const { user } = useAuth();
  const toast = useToast();
  
  const [currentEntries, setCurrentEntries] = useState<HofEntry[]>([]);
  const [prevEntries, setPrevEntries] = useState<HofEntry[]>([]);
  const [winners, setWinners] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'CURRENT' | 'PREVIOUS' | 'WINNERS'>('CURRENT');
  
  const currentWeekKey = getHofWeekKey();
  const prevWeekKey = getPrevWeekKey();

  useEffect(() => {
    // Current Week ACTIVE
    const qCurrent = query(
      collection(db, "hall_of_fame_entries"),
      where("weekKey", "==", currentWeekKey),
      where("status", "==", "ACTIVE"),
      orderBy("voteCount", "desc")
    );

    // Previous Week ACTIVE
    const qPrev = query(
      collection(db, "hall_of_fame_entries"),
      where("weekKey", "==", prevWeekKey),
      where("status", "==", "ACTIVE"),
      orderBy("voteCount", "desc")
    );

    // ALL WINNERS
    const qWinners = query(
      collection(db, "hall_of_fame_entries"),
      where("status", "==", "WINNER")
    );

    const unsubCurrent = onSnapshot(qCurrent, (snap) => {
      setCurrentEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
      setLoading(false);
    });

    const unsubPrev = onSnapshot(qPrev, (snap) => {
      setPrevEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
    });

    const unsubWinners = onSnapshot(qWinners, (snap) => {
      setWinners(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
    });

    return () => {
      unsubCurrent();
      unsubPrev();
      unsubWinners();
    };
  }, [currentWeekKey, prevWeekKey]);

  const handleDelete = async (entryId: string) => {
    if (!window.confirm("ARE YOU SURE? This will permanently delete this operative's submission and R2 video file.")) return;
    
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      const res = await adminDeleteHofEntryAction(idToken, entryId);
      if (res.success) {
        toast.success("TERMINATED", "Entry has been removed from the archives.");
      } else {
        toast.error("FAILURE", "Could not delete entry.");
      }
    } catch (err: any) {
      toast.error("ERROR", err.message);
    }
  };

  const handleSetVotes = async (entryId: string, currentVotes: number) => {
    const input = window.prompt("Enter new vote count (0-1000). Real user votes will be preserved, dummy votes will be added/removed:", currentVotes.toString());
    if (input === null) return;
    
    const targetVoteCount = parseInt(input);
    if (isNaN(targetVoteCount) || targetVoteCount < 0 || targetVoteCount > 1000) {
      toast.error("INVALID INPUT", "Please enter a valid number between 0 and 1000.");
      return;
    }

    if (targetVoteCount === currentVotes) return;

    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      const res = await adminSetHofVotesAction(idToken, entryId, targetVoteCount);
      if (res.success) {
        toast.success("VOTES UPDATED", `Entry vote count set to ${targetVoteCount}.`);
      } else {
        toast.error("FAILURE", (res as any).error || "Could not update votes.");
      }
    } catch (err: any) {
      toast.error("ERROR", err.message);
    }
  };

  const handleCrownWinners = async (weekToCrown: string) => {
    if (!window.confirm(`CRITICAL ACTION: This will crown winners for ${weekToCrown} and PURGE all other data from that week. Proceed?`)) return;
    
    setIsProcessing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      
      const res = await adminCrownWinnerAction(idToken, weekToCrown);
      if (res.success) {
        toast.success("CROWNED", `The elite of ${weekToCrown} have been immortalized.`);
      } else {
        toast.error("FAILURE", res.error || "Crowning sequence failed.");
      }
    } catch (err: any) {
      toast.error("ERROR", err.message || "A system error occurred.");
    } finally {
      setIsProcessing(false);
    }
  };

  const activeEntries = activeTab === 'CURRENT' 
    ? currentEntries 
    : activeTab === 'PREVIOUS' 
      ? prevEntries 
      : winners;

  const categories: HofCategory[] = ['eFOOTBALL_GOAL', 'CODM_WIPE'];

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Dashboard Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
         <div className="p-6 bg-surface/30 border border-white/5 rounded-sm">
            <Trophy className="w-5 h-5 text-accent mb-2" />
            <p className="text-[10px] text-sub font-black uppercase tracking-widest">Reigning Champions</p>
            <p className="text-3xl font-black text-main mt-1 italic">{winners.length}</p>
         </div>
         <div className="p-6 bg-surface/30 border border-white/5 rounded-sm">
            <BarChart3 className="w-5 h-5 text-accent mb-2" />
            <p className="text-[10px] text-sub font-black uppercase tracking-widest">Active Contenders</p>
            <p className="text-3xl font-black text-main mt-1 italic">{currentEntries.length}</p>
         </div>
         <div className="p-6 bg-surface/30 border border-white/5 rounded-sm">
            <Clock className="w-5 h-5 text-accent mb-2" />
            <p className="text-[10px] text-sub font-black uppercase tracking-widest">Awaiting Judgment</p>
            <p className="text-3xl font-black text-main mt-1 italic">{prevEntries.length}</p>
         </div>
         <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-sm flex items-center justify-center">
            <button 
              onClick={() => handleCrownWinners(prevWeekKey)}
              disabled={isProcessing || prevEntries.length === 0}
              className="flex items-center gap-2 text-[10px] font-black text-red-400 uppercase tracking-[0.2em] hover:text-white transition-colors disabled:opacity-30"
            >
               <Crown className="w-4 h-4" />
               Execute End-of-Week Protocol ({prevWeekKey})
            </button>
         </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-white/5 gap-8">
         <button 
           onClick={() => setActiveTab('CURRENT')}
           className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'CURRENT' ? 'text-accent' : 'text-sub'}`}
         >
            Live Contenders ({currentWeekKey})
            {activeTab === 'CURRENT' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_#00FF66]" />}
         </button>
         <button 
           onClick={() => setActiveTab('PREVIOUS')}
           className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'PREVIOUS' ? 'text-accent' : 'text-sub'}`}
         >
            Previous Deployment ({prevWeekKey})
            {activeTab === 'PREVIOUS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_#00FF66]" />}
         </button>
         <button 
           onClick={() => setActiveTab('WINNERS')}
           className={`pb-4 text-xs font-black uppercase tracking-[0.2em] transition-all relative ${activeTab === 'WINNERS' ? 'text-accent' : 'text-sub'}`}
         >
            Current Champions
            {activeTab === 'WINNERS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-accent shadow-[0_0_10px_#00FF66]" />}
         </button>
      </div>

      {/* Category Triage */}
      <div className="space-y-12">
         {categories.map((cat) => {
            const catEntries = activeEntries.filter(e => e.category === cat);
            return (
              <div key={cat} className="space-y-6">
                 <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-main uppercase italic tracking-tighter">{getHofCategoryTitle(cat)}</h3>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-[9px] font-black text-sub uppercase">
                       <Filter className="w-3 h-3" />
                       Sorted by Intelligence (Votes)
                    </div>
                 </div>

                 {catEntries.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                       {catEntries.map((entry, idx) => (
                          <div 
                            key={entry.id} 
                            className={`relative bg-surface/40 border rounded-sm overflow-hidden flex flex-col group transition-all ${idx === 0 ? 'border-accent/40 ring-1 ring-accent/20' : 'border-surface-border'}`}
                          >
                             {/* Video */}
                             <div className="relative aspect-[9/16] bg-black">
                                <video 
                                   src={entry.videoUrl} 
                                   className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity"
                                   muted
                                   playsInline
                                   id={`admin-vid-${entry.id}`}
                                />
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                     onClick={() => {
                                        const v = document.getElementById(`admin-vid-${entry.id}`) as HTMLVideoElement;
                                        if (playingId === entry.id) { v.pause(); setPlayingId(null); }
                                        else { v.play(); setPlayingId(entry.id!); }
                                     }}
                                     className="w-12 h-12 rounded-full bg-black/60 border border-white/20 flex items-center justify-center"
                                   >
                                      {playingId === entry.id ? <Pause className="w-5 h-5 text-white" /> : <Play className="w-5 h-5 text-white ml-1" />}
                                   </button>
                                </div>
                                
                                {idx === 0 && (
                                  <div className="absolute top-3 left-3 px-2 py-0.5 bg-accent text-black text-[8px] font-black uppercase tracking-widest rounded-full shadow-[0_0_10px_#00FF66]">
                                     TOP CANDIDATE
                                  </div>
                                )}

                                {/* Delete Action */}
                                <button 
                                  onClick={() => handleDelete(entry.id!)}
                                  className="absolute top-3 right-3 p-2 bg-red-500/80 hover:bg-red-500 text-white rounded-sm transition-all opacity-0 group-hover:opacity-100 scale-90 group-hover:scale-100 shadow-xl"
                                >
                                   <Trash2 className="w-3.5 h-3.5" />
                                </button>
                             </div>

                             {/* Info */}
                             <div className="p-4 bg-black/40">
                                 <div className="flex items-center justify-between mb-1">
                                    <span className="text-[11px] font-black text-main uppercase italic truncate max-w-[100px]">{entry.username}</span>
                                    <button 
                                      onClick={() => handleSetVotes(entry.id!, entry.voteCount)}
                                      className="flex items-center gap-1 text-accent hover:bg-accent/20 px-2 py-0.5 rounded transition-colors"
                                      title="Modify Votes"
                                    >
                                       <Zap className="w-3 h-3 fill-current" />
                                       <span className="text-[11px] font-mono font-black">{entry.voteCount}</span>
                                    </button>
                                 </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 ) : (
                    <div className="p-12 text-center border border-dashed border-white/5 rounded-sm">
                       <p className="text-[10px] font-black uppercase tracking-widest text-sub opacity-40">No intelligence data for this sector.</p>
                    </div>
                 )}
              </div>
            );
         })}
      </div>
    </div>
  );
}
