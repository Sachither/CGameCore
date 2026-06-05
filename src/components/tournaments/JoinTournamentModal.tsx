"use client";
import React, { useState } from 'react';
import Link from 'next/link';

export default function JoinTournamentModal({ isOpen, onClose, game }: { isOpen: boolean, onClose: () => void, game: 'codm' | 'efootball' }) {
  const isCODM = game === 'codm';
  
  // Workflow States
  const [selectedFormat, setSelectedFormat] = useState(isCODM ? '1v1 Duel' : '1v1 Standard');
  const [hasSavedTag, setHasSavedTag] = useState(false); // Mock condition: true = already saved, false = requires input
  const [gamerTag, setGamerTag] = useState('');
  
  // Escrow Math States
  const [mockLowBalance, setMockLowBalance] = useState(false); // Purely for demo testing
  const balance = mockLowBalance ? 50 : 1540;
  const entryFee = selectedFormat === 'Battle Royale' ? 250 : 100;
  const remaining = balance - entryFee;
  const isInsufficient = remaining < 0;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      {/* Modal Card */}
      <div className="relative w-full max-w-lg bg-surface border border-surface-border rounded-t-xl sm:rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-black border-b border-surface-border p-6 flex items-center justify-between">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(0,255,102,0.8)]"></span>
             </div>
             <div>
               <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Escrow Checkout</h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Secure Tournament Entry</p>
             </div>
           </div>
           
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors p-2 bg-surface hover:bg-surface-hover rounded-[3px]">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
           
           {/* Step 1: Format Selection */}
           <div>
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-3 flex items-center gap-2">
                 <span className="bg-black border border-surface-border px-1.5 py-0.5 rounded-sm text-white">1</span>
                 Select Tournament Format
              </label>
              <div className="grid grid-cols-2 gap-3">
                 {isCODM ? (
                   ['1v1 Duel', '5v5 S&D', 'Battle Royale'].map(f => (
                     <button key={f} onClick={() => setSelectedFormat(f)} className={`p-3 border text-xs font-bold uppercase tracking-widest transition-all rounded-[3px] ${selectedFormat === f ? 'bg-accent/10 border-accent text-accent shadow-[inset_0_2px_10px_rgba(0,255,102,0.1)]' : 'bg-black border-surface-border text-gray-500 hover:border-gray-500'}`}>
                        {f}
                     </button>
                   ))
                 ) : (
                   ['1v1 Standard', 'League Table'].map(f => (
                     <button key={f} onClick={() => setSelectedFormat(f)} className={`p-3 border text-xs font-bold uppercase tracking-widest transition-all rounded-[3px] ${selectedFormat === f ? 'bg-accent/10 border-accent text-accent shadow-[inset_0_2px_10px_rgba(0,255,102,0.1)]' : 'bg-black border-surface-border text-gray-500 hover:border-gray-500'}`}>
                        {f}
                     </button>
                   ))
                 )}
              </div>
           </div>

           {/* Step 2: Gamer Tag Verification */}
           <div className="pt-6 border-t border-surface-border">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-3 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <span className="bg-black border border-surface-border px-1.5 py-0.5 rounded-sm text-white">2</span>
                   Player Identity
                 </div>
                 
                 {/* Purely for Mockup Demo: Toggle Save State */}
                 <button onClick={() => setHasSavedTag(!hasSavedTag)} className="text-[9px] text-accent underline pointer-events-auto">Toggle New vs Saved User Demo</button>
              </label>
              
              {hasSavedTag ? (
                 <div className="bg-black border border-surface-border p-4 rounded-[3px] flex justify-between items-center group">
                    <div className="flex items-center gap-3">
                      <svg className="w-5 h-5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      <div>
                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Linked ID ({isCODM ? 'CODM' : 'eFootball'})</div>
                        <div className="text-white font-black italic text-lg uppercase tracking-tight">GhostRider99</div>
                      </div>
                    </div>
                 </div>
              ) : (
                 <div className="space-y-2">
                    <div className="flex flex-col bg-black border border-surface-border p-1 rounded-[3px] focus-within:border-accent focus-within:ring-1 focus-within:ring-accent transition-all">
                       <span className="px-3 pt-2 pb-1 text-[10px] text-accent font-bold uppercase tracking-widest">Enter Exact {isCODM ? 'In-Game Tag' : 'Username'}</span>
                       <input 
                         type="text" 
                         value={gamerTag}
                         onChange={(e) => setGamerTag(e.target.value)}
                         placeholder="e.g. Scump_2024" 
                         className="w-full bg-transparent text-white font-bold px-3 pb-2 outline-none placeholder-gray-700"
                       />
                    </div>
                    <p className="text-[10px] text-yellow-500 font-bold tracking-wide uppercase flex items-center gap-1.5">
                       <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                       Must exactly match your live game profile.
                    </p>
                 </div>
              )}
           </div>

           {/* Step 3: Math Breakdown */}
           <div className="pt-6 border-t border-surface-border">
              <label className="text-[10px] uppercase font-bold text-gray-400 tracking-widest block mb-3 flex items-center justify-between">
                 <div className="flex items-center gap-2">
                   <span className="bg-black border border-surface-border px-1.5 py-0.5 rounded-sm text-white">3</span>
                   Escrow Ledger
                 </div>
                 <button onClick={() => setMockLowBalance(!mockLowBalance)} className="text-[9px] text-gray-500 underline pointer-events-auto">Toggle Empty Wallet Demo</button>
              </label>
              
              <div className="bg-black border border-surface-border rounded-[3px] p-4 font-mono text-sm space-y-3">
                 <div className="flex justify-between items-center text-gray-400">
                    <span>Available Balance</span>
                    <span className="text-white font-bold">{balance} Coins</span>
                 </div>
                 <div className="flex justify-between items-center text-gray-400">
                    <span>Tournament Entry Fee</span>
                    <span className="text-red-400 font-bold">-{entryFee} Coins</span>
                 </div>
                 <div className="w-full h-px bg-surface-border border-dashed border-t"></div>
                 <div className="flex justify-between items-center pt-1">
                    <span className="text-white font-bold uppercase tracking-widest text-xs">Remaining After Join</span>
                    <span className={`font-black tracking-widest text-lg ${isInsufficient ? 'text-red-500' : 'text-accent'}`}>
                       {remaining} Coins
                    </span>
                 </div>
              </div>
           </div>
        </div>

        {/* Safe Actions */}
        <div className="p-6 bg-black border-t border-surface-border">
           {isInsufficient ? (
              <Link href="/dashboard/wallet" className="w-full bg-surface border border-red-500/50 hover:bg-red-500 hover:text-white text-red-500 block text-center py-4 rounded-[3px] font-black uppercase tracking-widest shadow-[inset_0_0_15px_rgba(239,68,68,0.1)] transition-colors">
                 Quick Deposit: Insufficient Funds
              </Link>
           ) : (
              <Link 
                 href={`/match/${isCODM ? 'codm' : 'efootball'}-${selectedFormat.toLowerCase().replace(' ', '-')}`}
                 className={`w-full bg-accent hover:bg-accent-hover text-center block transition-all py-4 rounded-[3px] text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,102,0.2)] ${!hasSavedTag && gamerTag.trim() === '' ? 'pointer-events-none opacity-50 saturate-0' : ''}`}
              >
                 Lock {entryFee} Coins & Enter Bracket
              </Link>
           )}
        </div>
        
      </div>
    </div>
  );
}
