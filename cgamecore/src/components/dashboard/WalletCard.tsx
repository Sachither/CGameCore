"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import DepositModal from "@/components/wallet/DepositModal";

export default function WalletCard() {
  const { profile } = useAuth();
  const [isDepositOpen, setDepositOpen] = useState(false);
  const balance = profile?.balanceCoins || 0;

  return (
    <div className="bg-gradient-to-br from-surface to-[#050505] border border-surface-border rounded-sm p-6 md:p-8 shadow-2xl relative overflow-hidden group">
      {/* Background aesthetic glow */}
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/20 blur-[80px] rounded-full pointer-events-none transition-opacity group-hover:opacity-80 opacity-50" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
        <div>
          <h2 className="text-sub text-xs font-bold uppercase tracking-widest mb-1 flex items-center gap-2">
            <svg className="w-4 h-4 text-accent-aware" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Vault Balance
          </h2>
          <div className="flex items-baseline space-x-3 mt-2 text-main transition-colors">
             <span className="text-5xl md:text-6xl font-black tracking-tighter">{balance.toLocaleString()}</span>
             <span className="text-accent-aware font-bold text-xl uppercase tracking-widest italic">Credits</span>
          </div>
          <p className="text-sub text-sm mt-2 font-mono transition-colors">≈ ₦{(balance * 15).toLocaleString()}</p>
        </div>
        
        <div className="mt-8 md:mt-0 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <button 
            onClick={() => setDepositOpen(true)}
            className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider px-10 py-4 rounded-sm transition-transform hover:-translate-y-1 shadow-[0_0_15px_rgba(0,255,102,0.2)]"
          >
            Deposit
          </button>
          <button className="flex-1 sm:flex-none border border-surface-border hover:border-accent hover:text-accent bg-surface-hover text-main font-bold uppercase tracking-wider px-10 py-4 rounded-sm transition-all focus:ring-1 focus:ring-accent">
            Withdraw
          </button>
        </div>
      </div>

      <DepositModal isOpen={isDepositOpen} onClose={() => setDepositOpen(false)} />
    </div>
  );
}
