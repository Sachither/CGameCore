"use client";
import React, { useState } from 'react';
import JoinTournamentModal from "./JoinTournamentModal";

export default function TournamentActionBar({ game = 'efootball' }: { game?: 'codm' | 'efootball' }) {
  const [isModalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 w-full z-30 pointer-events-none md:pl-20 lg:pl-64 transition-all duration-300">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-10 pb-6 pointer-events-auto">
           {/* Glassmorphism Action Bar */}
           <div className="bg-surface/80 backdrop-blur-md border border-surface-border rounded-[5px] p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
             
             <div className="flex items-center gap-4 w-full sm:w-auto">
                <div className="hidden sm:flex flex-col">
                   <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Total Prize Pool</span>
                   <span className="text-xl font-black text-accent font-mono tracking-tighter">1,400 Coins</span>
                </div>
                <div className="h-10 w-px bg-surface-border hidden sm:block"></div>
                <div className="flex flex-col w-full sm:w-auto">
                   <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center sm:text-left">Entry Fee</span>
                   <span className="text-lg font-black text-white font-mono text-center sm:text-left">100 Coins</span>
                </div>
             </div>

             <div className="flex items-center gap-3 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none bg-black border border-surface-border hover:bg-surface-hover text-white px-6 py-3 rounded-[3px] text-sm font-bold uppercase tracking-widest transition-colors">
                   Share Bracket
                </button>
                <button 
                  onClick={() => setModalOpen(true)}
                  className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-black px-10 py-3 rounded-[3px] text-sm font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,102,0.2)] hover:shadow-[0_0_25px_rgba(0,255,102,0.4)] transition-all hover:-translate-y-1"
                >
                   Join Tournament
                </button>
             </div>
             
           </div>
        </div>
      </div>

      <JoinTournamentModal 
        isOpen={isModalOpen} 
        onClose={() => setModalOpen(false)} 
        game={game} 
      />
    </>
  );
}
