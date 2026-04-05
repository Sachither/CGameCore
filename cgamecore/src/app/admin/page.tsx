"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getPlatformStatsAction } from "@/app/actions/admin-actions";
import { Gavel, Users, Swords, Activity, TrendingUp, ShieldCheck, AlertTriangle, Flame, Wallet, PiggyBank, Briefcase, Landmark, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Stats {
  totalUsers: number;
  totalMatches: number;
  openDisputes: number;
  activeMatches: number;
  codmMatches: number;
  efootballMatches: number;
  financeDeposits: number;
  financePayouts: number;
  financeRevenue: number;
  financeWithdrawals: number;
}

function StatCard({
  label, value, icon: Icon, color, urgent
}: {
  label: string; value: number | string; icon: any; color: string; urgent?: boolean;
}) {
  return (
    <div className={`bg-[#0a0a0a] border ${urgent && (value as number) > 0 ? "border-red-500/40 shadow-[0_0_20px_rgba(239,68,68,0.1)]" : "border-white/5"} p-6 rounded-sm relative overflow-hidden group`}>
      <div className={`absolute top-0 left-0 w-1 h-full ${color}`} />
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2 rounded-sm bg-white/5 ${color.replace("bg-", "text-")}`}>
          <Icon className="w-4 h-4" />
        </div>
        {urgent && (value as number) > 0 && (
          <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-sm animate-pulse">
            Action Required
          </span>
        )}
      </div>
      <p className="text-3xl font-black text-white italic tracking-tighter mb-1">{value}</p>
      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{label}</p>
    </div>
  );
}

export default function AdminOverviewPage() {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const result = await getPlatformStatsAction(idToken);
      if (result.success && result.stats) setStats(result.stats);
      setLoading(false);
    };
    fetch();
  }, [user]);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mb-2">
          Admin Command Center
        </p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Platform <span className="text-red-400">Overview</span>
        </h1>
        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest mt-2">
          Real-time intelligence feed · Operator: {profile?.username}
        </p>
      </div>

      {/* Stats Grid */}
      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-sm h-32 animate-pulse" />
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          <StatCard label="Total Users" value={stats.totalUsers} icon={Users} color="bg-blue-500" />
          <StatCard label="Total Matches" value={stats.totalMatches} icon={Swords} color="bg-accent" />
          <StatCard label="Active Matches" value={stats.activeMatches} icon={Activity} color="bg-yellow-500" />
          <StatCard label="Open Disputes" value={stats.openDisputes} icon={Gavel} color="bg-red-500" urgent />
        </div>
      ) : (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-sm mb-10">
          <p className="text-red-400 text-xs font-bold uppercase tracking-widest">Failed to load platform stats. Check Firebase Admin SDK.</p>
        </div>
      )}

      {/* FINANCIAL INTELLIGENCE SECTION */}
      {stats && (
        <div className="bg-[#0a0a0a] border border-white/5 p-8 rounded-sm mb-10 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5">
            <Landmark className="w-32 h-32 text-white" />
          </div>
          
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <div>
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Financial Intelligence</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Real-time Treasury Feed · Coins (CR)</p>
              </div>
            </div>
            <Link 
              href="/admin/treasury"
              className="bg-white/5 hover:bg-white/10 border border-white/10 px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white transition-all flex items-center gap-2"
            >
              View Full Ledger <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {/* Total Deposits (In) */}
             <div className="relative group">
                <div className="flex items-center gap-3 mb-2">
                   <Wallet className="w-3.5 h-3.5 text-blue-400" />
                   <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Gross Deposits (In)</span>
                </div>
                <div className="text-3xl font-black text-white italic tracking-tighter mb-1">
                   {stats.financeDeposits.toLocaleString()} <span className="text-xs opacity-30 text-white italic">CR</span>
                </div>
                <div className="text-[11px] font-black text-blue-400/80 uppercase tracking-widest mb-2">
                   ₦ {(stats.financeDeposits * 15).toLocaleString()}
                </div>
                <p className="text-[10px] text-gray-600 font-bold leading-relaxed uppercase tracking-widest">
                   Total funds injected into the system.
                </p>
             </div>

             {/* Total Payouts (Out) */}
             <div className="relative group">
                <div className="flex items-center gap-3 mb-2">
                   <PiggyBank className="w-3.5 h-3.5 text-red-400" />
                   <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Gross Payouts (Out)</span>
                </div>
                <div className="text-3xl font-black text-white italic tracking-tighter mb-1">
                   {(stats.financePayouts + stats.financeWithdrawals).toLocaleString()} <span className="text-xs opacity-30 text-white italic">CR</span>
                </div>
                <div className="text-[11px] font-black text-red-400/80 uppercase tracking-widest mb-2">
                   ₦ {((stats.financePayouts + stats.financeWithdrawals) * 15).toLocaleString()}
                </div>
                <p className="text-[10px] text-gray-600 font-bold leading-relaxed uppercase tracking-widest">
                   Winner rewards + bank withdrawals.
                </p>
             </div>

             {/* Platform Revenue (Your Cut) */}
             <div className="relative group p-6 bg-green-500/5 rounded-sm border border-green-500/10 border-dashed">
                <div className="flex items-center gap-3 mb-2">
                   <Briefcase className="w-3.5 h-3.5 text-green-400" />
                   <span className="text-[9px] font-black text-green-400 uppercase tracking-widest">Platform Net Profit</span>
                </div>
                <div className="text-4xl font-black text-green-400 italic tracking-tighter mb-1">
                   {stats.financeRevenue.toLocaleString()} <span className="text-xs opacity-30 italic">CR</span>
                </div>
                <div className="text-sm font-black text-green-500 uppercase tracking-widest mb-2">
                   ₦ {(stats.financeRevenue * 15).toLocaleString()}
                </div>
                <p className="text-[10px] text-green-900 font-black leading-relaxed uppercase tracking-widest">
                   Secured 20% commission on resolved matches.
                </p>
             </div>
          </div>
        </div>
      )}

      {/* GAME POPULARITY SECTION */}
      {stats && (
        <div className="bg-[#0a0a0a] border border-white/5 p-8 rounded-sm mb-10">
          <div className="flex items-center gap-3 mb-8">
            <Flame className="w-5 h-5 text-accent animate-pulse" />
            <div>
              <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Game Popularity</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Historical Volume Breakdown</p>
            </div>
          </div>

          <div className="flex w-full h-8 rounded-[3px] overflow-hidden mb-6">
             <div 
               className="bg-red-500 transition-all duration-1000 flex items-center justify-center overflow-hidden" 
               style={{ width: `${(stats.codmMatches / (stats.totalMatches || 1)) * 100}%` }}
             >
                <span className="text-[8px] font-black text-black uppercase tracking-widest px-2 truncate">CODM: {stats.codmMatches}</span>
             </div>
             <div 
               className="bg-blue-500 transition-all duration-1000 flex items-center justify-center overflow-hidden" 
               style={{ width: `${(stats.efootballMatches / (stats.totalMatches || 1)) * 100}%` }}
             >
                <span className="text-[8px] font-black text-black uppercase tracking-widest px-2 truncate">eFootball: {stats.efootballMatches}</span>
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div className="bg-white/5 border border-white/5 p-4 rounded-sm">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Call of Duty: Mobile</p>
                   <span className="text-lg font-black text-white italic tracking-tighter">{stats.codmMatches} <span className="text-[8px] opacity-40 italic">matches</span></span>
                </div>
             </div>
             <div className="bg-white/5 border border-white/5 p-4 rounded-sm">
                <div className="flex items-center justify-between">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">eFootball Pro Evolution</p>
                   <span className="text-lg font-black text-white italic tracking-tighter">{stats.efootballMatches} <span className="text-[8px] opacity-40 italic">matches</span></span>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/admin/disputes"
          className="bg-[#0a0a0a] border border-red-500/20 hover:border-red-500/50 p-6 rounded-sm group transition-all"
        >
          <Gavel className="w-6 h-6 text-red-400 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-white font-black italic uppercase tracking-tighter text-lg mb-1">Tribunal</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed mb-4">
            Review & resolve disputed matches. Award wins or refund players.
          </p>
          <div className="bg-red-500/10 border border-red-500/20 py-2 rounded-sm text-center text-[10px] font-black uppercase tracking-widest text-red-400 group-hover:bg-red-500/20 transition-all">
             Go to Full Tribunal
          </div>
          {stats && stats.openDisputes > 0 && (
            <div className="mt-4 flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-3 h-3 animate-pulse" />
              <span className="text-[9px] font-black uppercase tracking-widest">{stats.openDisputes} awaiting review</span>
            </div>
          )}
        </Link>

        <Link
          href="/admin/users"
          className="bg-[#0a0a0a] border border-white/5 hover:border-white/20 p-6 rounded-sm group transition-all"
        >
          <Users className="w-6 h-6 text-blue-400 mb-4 group-hover:scale-110 transition-transform" />
          <h3 className="text-white font-black italic uppercase tracking-tighter text-lg mb-1">Operator Index</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
            Search users, adjust balances, apply bans & grant admin roles.
          </p>
        </Link>

        <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-sm">
          <TrendingUp className="w-6 h-6 text-green-400 mb-4" />
          <h3 className="text-white font-black italic uppercase tracking-tighter text-lg mb-1">Platform Health</h3>
          <div className="space-y-3 mt-4">
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Server Actions</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-green-400" />
                <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">Secure</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Firestore Rules</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-green-400" />
                <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">Active</span>
              </div>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Admin Audit Log</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 text-green-400" />
                <span className="text-[9px] text-green-400 font-black uppercase tracking-widest">Recording</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
