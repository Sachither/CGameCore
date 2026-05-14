"use client";
import React, { Suspense } from "react";
import Link from "next/link";
import WalletCard from "@/components/dashboard/WalletCard";
import GameCategoryGrid from "@/components/dashboard/GameCategoryGrid";
import LiveChallengeList from "@/components/dashboard/LiveChallengeList";
import CombatInterestHub from "@/components/dashboard/CombatInterestHub";
import ActiveTournamentsTable from "@/components/dashboard/ActiveTournamentsTable";
import NotificationTray from "@/components/dashboard/NotificationTray";
import PromoTournamentCard from "@/components/promo/PromoTournamentCard";
import { useAuth } from "@/components/auth/AuthProvider";
import DepositRecoveryHeartbeat from "@/components/wallet/DepositRecoveryHeartbeat";
import RegionGate from "@/components/dashboard/RegionGate";
import CreateChallengeModal from "./CreateChallengeModal";

export default function BasecampView() {
  const { user, profile } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  return (
    <Suspense fallback={<div className="w-full max-w-6xl mx-auto h-[500px] animate-pulse bg-white/5 rounded-lg border border-white/10" />}>
      <div className="w-full max-w-6xl mx-auto">
        <RegionGate />
        <DepositRecoveryHeartbeat />
        
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase leading-none">
              Base<span className="text-accent-aware">camp</span>
            </h1>
            <p className="text-sub text-[10px] mt-2 uppercase tracking-[0.3em] font-black opacity-40">
              {user ? (
                <>Welcome back, <span className="text-main opacity-100">{profile?.username || user?.displayName || "OPERATIVE"}</span></>
              ) : (
                <>TACTICAL OVERVIEW : <span className="text-accent opacity-100">GUEST ACCESS</span></>
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {user && <NotificationTray />}
            <Link
              href={user ? "/dashboard/support" : "/login"}
              className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 hover:border-accent/40 transition-all group text-sm font-bold uppercase tracking-widest text-accent"
              title={user ? "Report issues or get support" : "Sign in to access support"}
            >
              <span className="text-lg">💬</span>
              <span className="hidden sm:inline">Support</span>
            </Link>
          </div>
        </div>

        {/* ⚡ PRIMARY TACTICAL ANCHOR: Glaring Host Match Button */}
        <div className="mb-10">
           <button 
             onClick={() => setIsCreateOpen(true)}
             className="w-full bg-accent text-black font-black uppercase tracking-[0.15em] sm:tracking-[0.3em] py-5 sm:py-7 rounded-sm text-xs sm:text-base transition-all hover:bg-accent-hover active:scale-95 shadow-[0_0_40px_rgba(0,255,102,0.5)] flex items-center justify-center gap-3 sm:gap-4 group border-2 border-white/10"
           >
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-black/10 flex items-center justify-center group-hover:rotate-90 transition-transform border border-black/20 shrink-0">
                 <span className="text-xl sm:text-2xl">+</span>
              </div>
              <span className="truncate">Host a Match & Win Credits</span>
           </button>
           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-[0.4em] text-center mt-3 animate-pulse">Standardized Tactical Deployment Enabled</p>
        </div>

        <PromoTournamentCard />
        <WalletCard />
        <GameCategoryGrid />
        <LiveChallengeList onHostClick={() => setIsCreateOpen(true)} />
        <CombatInterestHub />
        <ActiveTournamentsTable />

        <CreateChallengeModal 
          isOpen={isCreateOpen} 
          onClose={() => setIsCreateOpen(false)} 
        />
      </div>
    </Suspense>
  );
}
