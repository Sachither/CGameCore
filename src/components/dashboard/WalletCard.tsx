"use client";
import React, { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import DepositModal from "@/components/wallet/DepositModal";
import WithdrawModal from "@/components/wallet/WithdrawModal";
import SectorChangeModal from "./SectorChangeModal";
import { Settings, Globe, ShieldCheck, Lock } from "lucide-react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import Link from "next/link";

export default function WalletCard() {
  const { user, profile } = useAuth();
  const [isDepositOpen, setDepositOpen] = useState(false);
  const [isWithdrawOpen, setWithdrawOpen] = useState(false);
  const [isSectorModalOpen, setSectorModalOpen] = useState(false);
  const balance = profile?.balanceCoins || 0;

  const handleConfirmReset = async () => {
    if (!profile?.uid) return;
    await updateDoc(doc(db, "users", profile.uid), {
      country: null,
      currency: null
    });
    window.location.reload();
  };

  return (
    <div className="bg-gradient-to-br from-surface to-[#050505] border border-surface-border rounded-sm p-6 md:p-8 shadow-2xl relative overflow-hidden group">
      {/* Restricted Access Overlay for Guests */}
      {!user && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md border border-accent/20">
          <div className="text-center px-6 max-w-md">
            <div className="w-16 h-16 bg-accent/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-accent/20 animate-pulse">
              <Lock className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-main font-black uppercase italic tracking-tighter text-xl mb-4">Identification Required</h3>
            <p className="text-sub text-[10px] font-bold uppercase tracking-[0.2em] mb-8 leading-relaxed">
              Enlist to access your tactical financial records, personal match history, and elite rank progression.
            </p>
            <Link 
              href="/register" 
              className="inline-block bg-accent text-black px-10 py-3 rounded-sm font-black uppercase tracking-widest text-[11px] shadow-[0_0_20px_rgba(0,255,102,0.4)] hover:bg-accent-hover transition-all"
            >
              Enlist Now
            </Link>
          </div>
        </div>
      )}

      {/* Background aesthetic glow */}
      <div className="absolute -right-20 -bottom-20 w-64 h-64 bg-accent/20 blur-[80px] rounded-full pointer-events-none transition-opacity group-hover:opacity-80 opacity-50" />
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center relative z-10">
        <div className="flex-1">
          <h2 className="text-sub text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-60">
             My Wallet
          </h2>
          <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-1.5">Available Balance</p>
          <div className="flex items-baseline space-x-3 text-main transition-colors">
             <span className="text-5xl md:text-6xl font-black tracking-tighter">{balance.toLocaleString()}</span>
             <span className="text-accent-aware font-bold text-xl uppercase tracking-widest italic">Credits</span>
          </div>
          <div className="mt-2 space-y-4">
            <p className="text-sub text-sm font-mono transition-colors opacity-80">Asset Value ≈ ${(balance / 100).toFixed(2)} USD</p>
            
            {profile?.country && (
              <div className="inline-flex items-center gap-3 bg-accent-aware/10 border border-accent-aware/20 py-1.5 px-3 rounded-sm group/sector shadow-[0_0_15px_rgba(35,255,102,0.05)]">
                <div className="flex items-center gap-2">
                  <Globe className="w-3.5 h-3.5 text-accent-aware animate-pulse" />
                  <span className="text-[11px] font-black text-accent-aware uppercase tracking-widest">
                    {profile.country} Sector {profile.currency ? `(${profile.currency})` : ""}
                  </span>
                </div>
                <div className="w-px h-3 bg-accent-aware/20" />
                <button 
                  onClick={() => setSectorModalOpen(true)}
                  className="text-accent-aware/60 hover:text-accent-aware transition-all hover:scale-110"
                  title="Migrate Sector"
                >
                  <Settings className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
        
        <div className="mt-8 md:mt-0 flex flex-col sm:flex-row gap-4 w-full md:w-auto">
          <button 
            onClick={() => setDepositOpen(true)}
            className="flex-1 sm:flex-none bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-wider px-10 py-4 rounded-sm transition-transform hover:-translate-y-1 shadow-[0_0_15px_rgba(0,255,102,0.2)]"
          >
            Deposit
          </button>
          <button 
            onClick={() => setWithdrawOpen(true)}
            className="flex-1 sm:flex-none border border-surface-border hover:border-accent hover:text-accent bg-surface-hover text-main font-bold uppercase tracking-wider px-10 py-4 rounded-sm transition-all focus:ring-1 focus:ring-accent"
          >
            Withdraw
          </button>
        </div>
      </div>

      <DepositModal isOpen={isDepositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal isOpen={isWithdrawOpen} onClose={() => setWithdrawOpen(false)} balance={balance} />
      
      <SectorChangeModal 
        isOpen={isSectorModalOpen} 
        onClose={() => setSectorModalOpen(false)} 
        onConfirm={handleConfirmReset}
        currentSector={`${profile?.country || "NA"} Division`}
      />
    </div>
  );
}
