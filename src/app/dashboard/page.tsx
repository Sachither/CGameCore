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

export default function DashboardPage() {
  const { user, profile } = useAuth();

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
            Welcome back, <span className="text-main opacity-100">{profile?.username || user?.displayName || "Player"}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <NotificationTray />
          <Link
            href="/dashboard/support"
            className="flex items-center gap-2 px-4 py-2 bg-accent/10 border border-accent/20 rounded-lg hover:bg-accent/20 hover:border-accent/40 transition-all group text-sm font-bold uppercase tracking-widest text-accent"
            title="Report issues or get support"
          >
            <span className="text-lg">💬</span>
            <span className="hidden sm:inline">Support</span>
          </Link>
        </div>
      </div>

      <PromoTournamentCard />
      <WalletCard />
      <GameCategoryGrid />
      <LiveChallengeList />
      <CombatInterestHub />
        <ActiveTournamentsTable />
      </div>
    </Suspense>
  );
}
