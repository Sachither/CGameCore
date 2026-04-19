import React, { Suspense } from "react";
import WalletBalanceCard from "@/components/wallet/WalletBalanceCard";
import TransactionHistoryTable from "@/components/wallet/TransactionHistoryTable";
import DepositRecoveryHeartbeat from "@/components/wallet/DepositRecoveryHeartbeat";

export default function WalletPage() {
  return (
    <Suspense fallback={<div className="w-full max-w-6xl mx-auto h-[300px] animate-pulse bg-white/5 rounded-lg border border-white/10" />}>
      <div className="w-full max-w-6xl mx-auto pb-10">
      <DepositRecoveryHeartbeat />
      <div className="mb-8">
         <h1 className="text-3xl md:text-4xl font-black text-main italic tracking-tighter uppercase">
           My <span className="text-accent-aware">Wallet</span>
         </h1>
      </div>

      <WalletBalanceCard />
      <TransactionHistoryTable />
      </div>
    </Suspense>
  );
}
