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

import BasecampView from "@/components/dashboard/BasecampView";

export default function DashboardPage() {
  return <BasecampView />;
}
