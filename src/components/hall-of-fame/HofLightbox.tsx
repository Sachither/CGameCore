"use client";

import React, { useState, useEffect, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, Maximize2, Minimize2, ThumbsUp } from 'lucide-react';
import { HofEntry } from '@/lib/hof-service';
import HofVideoEmbed from './HofVideoEmbed';
import { voteHofEntryAction } from '@/app/actions/hof-actions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/context/ToastContext';
import { auth } from '@/lib/firebase';
import HofIntroModal from './HofIntroModal';

interface HofLightboxProps {
  entries: HofEntry[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function HofLightbox({ entries, initialIndex, isOpen, onClose }: HofLightboxProps) {
  const { user } = useAuth();
  const toast = useToast();
  const [index, setIndex] = useState(initialIndex);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  if (!isOpen || entries.length === 0) return null;

  const current = entries[index];

  const handleNext = () => setIndex((prev) => (prev + 1) % entries.length);
  const handlePrev = () => setIndex((prev) => (prev - 1 + entries.length) % entries.length);

  const handleVote = async () => {
    if (!user) {
      setIsIntroOpen(true);
      return;
    }
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error("Sync error.");
      const res = await voteHofEntryAction(idToken, current.id!) as any;
      if (res.success) {
        toast.success("VOTE REGISTERED", "Judgment recorded.");
      } else {
        toast.error("VOTE REJECTED", res.error);
      }
    } catch (err: any) {
      toast.error("ERROR", err.message);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleNext();
      else handlePrev();
    }
    touchStartX.current = null;
  };

  return (
    <div 
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex flex-col items-center overflow-y-auto overflow-x-hidden"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      {/* Top Bar */}
      <div className="sticky top-0 w-full p-6 flex items-center justify-between z-[210] bg-gradient-to-b from-black to-transparent shrink-0">
        <div className="flex items-center gap-3">
           <div 
              className="w-10 h-10 rounded-full border border-accent/40 bg-black"
              style={{
                backgroundImage: `url('/avatar_collection.png')`,
                backgroundSize: '400% 500%',
                backgroundPosition: `${((current.avatarId || 0) % 4) * 33.33}% ${Math.floor((current.avatarId || 0) / 4) * 25}%`
              }}
           />
           <div className="flex flex-col">
              <span className="text-sm font-black text-white uppercase italic">{current.username}</span>
              <span className="text-[10px] text-accent font-black uppercase tracking-widest italic">{current.category.replace('_', ' ')}</span>
           </div>
        </div>
        
        <div className="flex items-center gap-2">
           <button 
             onClick={toggleFullscreen} 
             className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
           >
             {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
           </button>
           <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white">
             <X className="w-8 h-8" />
           </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="w-full flex-1 flex flex-col items-center justify-center relative p-4 pb-24 md:pb-4 gap-8">
         {/* Navigation Arrows (Desktop) */}
         <button 
            onClick={handlePrev}
            className="absolute left-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group hidden md:flex"
         >
            <ChevronLeft className="w-8 h-8 text-white group-hover:text-accent" />
         </button>

         {/* Video Wrapper */}
         <div className="w-full max-w-[320px] md:max-w-[400px] aspect-[9/16] bg-black shadow-2xl rounded-lg overflow-hidden relative animate-in zoom-in duration-300">
            <HofVideoEmbed key={`${current.id}-${index}`} url={current.videoUrl} type={current.embedType} autoPlay={true} muted={false} />
         </div>

         {/* Interactive Voting Bar (Pinned below video) */}
         <div className="flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <button 
               onClick={handleVote}
               className="flex items-center gap-3 px-8 py-4 bg-accent text-black rounded-full font-black uppercase tracking-widest text-[11px] italic shadow-[0_0_30px_rgba(0,255,102,0.3)] hover:scale-105 active:scale-95 transition-all group"
            >
               <ThumbsUp className="w-5 h-5 fill-current group-hover:rotate-12 transition-transform" />
               VOTE FOR OPERATIVE
            </button>
            <div className="px-6 py-4 bg-white/5 backdrop-blur-md rounded-full border border-white/10 flex flex-col items-center min-w-[70px]">
               <span className="text-[14px] font-black text-white leading-none">{current.voteCount}</span>
               <span className="text-[8px] text-sub uppercase font-bold tracking-widest mt-1">VOTES</span>
            </div>
         </div>

         <button 
            onClick={handleNext}
            className="absolute right-6 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-all group hidden md:flex"
         >
            <ChevronRight className="w-8 h-8 text-white group-hover:text-accent" />
         </button>
      </div>

      <HofIntroModal isOpen={isIntroOpen} onClose={() => setIsIntroOpen(false)} />
    </div>
  );
}
