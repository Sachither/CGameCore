"use client";
import React from "react";
import WalletCard from "@/components/dashboard/WalletCard";
import GameCategoryGrid from "@/components/dashboard/GameCategoryGrid";
import LiveChallengeList from "@/components/dashboard/LiveChallengeList";
import CombatInterestHub from "@/components/dashboard/CombatInterestHub";
import ActiveTournamentsTable from "@/components/dashboard/ActiveTournamentsTable";
import NotificationTray from "@/components/dashboard/NotificationTray";
import { useAuth } from "@/components/auth/AuthProvider";
import DepositRecoveryHeartbeat from "@/components/wallet/DepositRecoveryHeartbeat";

export default function DashboardPage() {
  const { user, profile } = useAuth();
  
  return (
    <div className="w-full max-w-6xl mx-auto">
      <DepositRecoveryHeartbeat />
      <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
         <div>
            <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase leading-none">
              Base<span className="text-accent-aware">camp</span>
            </h1>
            <p className="text-sub text-[10px] mt-2 uppercase tracking-[0.3em] font-black opacity-40">
              Welcome back, <span className="text-main opacity-100">{profile?.username || user?.displayName || "Player"}</span>
            </p>
         </div>
         <div className="flex items-center gap-4">
            <NotificationTray />
         </div>
      </div>

      <WalletCard />
      <GameCategoryGrid />
      <LiveChallengeList />
      <CombatInterestHub />
      <ActiveTournamentsTable />
    </div>
  );
}
