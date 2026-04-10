"use client";
import React, { useState } from 'react';
import DepositModal from "./DepositModal";
import WithdrawModal from "./WithdrawModal";
import { useAuth } from "@/components/auth/AuthProvider";
import { RefreshCw, Loader2, Globe } from "lucide-react";

export default function WalletBalanceCard() {
  const { profile, refreshProfile } = useAuth();
  const [isDepositOpen, setDepositOpen] = useState(false);
  const [isWithdrawOpen, setWithdrawOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  
  const balance = profile?.balanceCoins || 0;

  const handleSync = async () => {
    setIsSyncing(true);
    await refreshProfile();
    // Simulate a slight delay for better UX feel
    setTimeout(() => setIsSyncing(false), 500);
  };

  return (
    <div className="bg-surface border border-surface-border rounded-[5px] p-6 lg:p-10 shadow-2xl relative overflow-hidden group">
      
      {/* Subtle Data Visualization / Graph Mockup */}
      <svg className="absolute bottom-0 left-0 w-full h-32 opacity-30 pointer-events-none transition-opacity group-hover:opacity-60" preserveAspectRatio="none" viewBox="0 0 100 100">
         <path d="M0,100 L0,80 Q10,70 20,85 T40,60 T60,75 T80,40 T100,20 L100,100 Z" fill="url(#gradWallet)" />
         <path d="M0,80 Q10,70 20,85 T40,60 T60,75 T80,40 T100,20" fill="none" stroke="#00FF66" strokeWidth="1.5" />
         <defs>
           <linearGradient id="gradWallet" x1="0" y1="0" x2="0" y2="1">
             <stop offset="0%" stopColor="#00FF66" stopOpacity="0.4" />
             <stop offset="100%" stopColor="#00FF66" stopOpacity="0" />
           </linearGradient>
         </defs>
      </svg>
      
      {/* Content */}
      <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center">
        <div>
          <h2 className="text-sub text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">
             My Wallet
          </h2>
          <h2 className="text-sub text-xs font-bold uppercase tracking-widest mb-3 flex items-center justify-between gap-2 overflow-hidden">
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4 text-accent-aware" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Available Balance
            </span>
            <button 
              onClick={handleSync}
              disabled={isSyncing}
              className={`p-1.5 rounded-full hover:bg-white/5 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-accent-aware ${isSyncing ? 'animate-spin' : ''}`} />
            </button>
          </h2>
          <div className="flex items-baseline space-x-3 text-main">
             <span className="text-5xl md:text-6xl font-black tracking-tighter drop-shadow-md">{balance.toLocaleString()}</span>
             <span className="text-accent-aware font-bold text-xl uppercase tracking-widest italic">Coins</span>
          </div>
          
          <div className="mt-2 space-y-4">
            <p className="text-sub text-sm font-mono bg-black/50 inline-block px-3 py-1 rounded-[3px] border border-surface-border">
               Asset Value ≈ ${(balance / 100).toFixed(2)} USD
            </p>

            {profile?.country && (
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 bg-accent-aware/10 border border-accent-aware/20 py-1.5 px-3 rounded-sm group/sector shadow-[0_0_15px_rgba(35,255,102,0.05)]">
                   <Globe className="w-3.5 h-3.5 text-accent-aware animate-pulse" />
                   <span className="text-[11px] font-black text-accent-aware uppercase tracking-widest">
                     {profile.country} Sector {profile.currency ? `(${profile.currency})` : ""}
                   </span>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 md:mt-0 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <button 
             onClick={() => setDepositOpen(true)}
             className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider px-10 py-4 rounded-[5px] transition-transform hover:-translate-y-1 shadow-[0_0_15px_rgba(0,255,102,0.2)]"
          >
            Deposit
          </button>
          <button 
             onClick={() => setWithdrawOpen(true)}
             className="flex-1 sm:flex-none bg-black border border-surface-border hover:border-white hover:text-main text-main font-bold uppercase tracking-wider px-10 py-4 rounded-[5px] transition-all"
          >
            Withdraw
          </button>
        </div>
      </div>

      {/* Render Modals at Root Level Component */}
      <DepositModal isOpen={isDepositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setWithdrawOpen(false)} balance={balance} />
    </div>
  );
}
