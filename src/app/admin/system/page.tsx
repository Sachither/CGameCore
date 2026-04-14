"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { getAuditLogsAction, toggleSystemLockdownAction } from "@/app/actions/admin-actions";
import { syncPlatformRatesAction } from "@/app/actions/rate-actions";
import { ShieldAlert, History, Lock, Unlock, Loader2, AlertTriangle, TrendingUp, RefreshCcw, Landmark } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function SuperAdminSystemPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [lockdownActive, setLockdownActive] = useState(false);
  const [lockdownLoading, setLockdownLoading] = useState(false);
  const [globalAuditData, setGlobalAuditData] = useState<any[]>([]);
  const [globalAuditView, setGlobalAuditView] = useState(false);
  const [rates, setRates] = useState<any>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  
  // Strict Super Admin Check (Supports modern role and legacy boolean)
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN' || profile?.isSuperAdmin === true;

  useEffect(() => {
    if (!loading && (!profile || !isSuperAdmin)) {
      router.push('/admin'); // Kick back non-Super Admins
    }
  }, [profile, loading, isSuperAdmin, router]);

  useEffect(() => {
    if (isSuperAdmin) {
      getDoc(doc(db, "system", "config")).then(snap => {
        if (snap.exists()) {
          const data = snap.data();
          setLockdownActive(data?.lockdownActive || false);
          setRates(data?.rates || null);
        }
      });
    }
  }, [isSuperAdmin]);

  const handleToggleLockdown = async () => {
    if (!user) return;
    const confirm = window.confirm(
      lockdownActive 
        ? "Lift emergency lockdown? Matchmaking will resume." 
        : "INITIALIZE EMERGENCY LOCKDOWN? All matchmaking and financial operations will be suspended!"
    );
    if (!confirm) return;

    setLockdownLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await toggleSystemLockdownAction(idToken, !lockdownActive, "Super Admin Override");
      if (res.success) setLockdownActive(!lockdownActive);
      else alert("Failed to toggle lockdown: " + res.error);
    } catch (e) {
      console.error("Lockdown toggle failed", e);
    }
    setLockdownLoading(false);
  };

  const handleLoadGlobalAudit = async () => {
    if (!user) return;
    setGlobalAuditView(true);
    setGlobalAuditData([]);
    const idToken = await user.getIdToken();
    const res = await getAuditLogsAction(idToken, 200);
    if (res.success) setGlobalAuditData(res.logs || []);
    else alert("Failed to fetch logs: " + res.error);
  };

  const handleSyncRates = async () => {
    if (!user) return;
    setRatesLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await syncPlatformRatesAction(idToken);
      if (res.success) {
        setRates(res.rates);
        alert("Rates synchronized successfully via external API.");
      } else {
        alert("Sync failed: " + res.error);
      }
    } catch (e) {
      console.error("Rate sync failed", e);
    }
    setRatesLoading(false);
  };

  if (loading || (!isSuperAdmin)) return (
    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-red-500 animate-spin" /></div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.3em] mb-1">Super Admin Exclusive</p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          System <span className="text-red-500">Control</span>
        </h1>
      </div>

      <div className="space-y-6">
        {/* LOCKDOWN TOGGLE */}
        <div className={`p-8 border rounded-sm transition-colors ${lockdownActive ? 'bg-red-500/10 border-red-500 shadow-[0_0_50px_rgba(239,68,68,0.15)] text-red-500' : 'bg-[#0a0a0a] border-white/5 text-gray-400'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`p-3 rounded-sm ${lockdownActive ? 'bg-red-500 text-black' : 'bg-white/5 text-red-500'}`}>
               {lockdownActive ? <Lock className="w-8 h-8" /> : <Unlock className="w-8 h-8" />}
            </div>
            <div>
               <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">
                  {lockdownActive ? "LOCKDOWN ACTIVE" : "Emergency Lockdown"}
               </h2>
               <p className="text-[10px] uppercase font-bold tracking-widest mt-1">
                 {lockdownActive ? "System matchmaking and financials are heavily restricted." : "Suspend matchmaking operations platform-wide."}
               </p>
            </div>
          </div>

          <button 
            onClick={handleToggleLockdown}
            disabled={lockdownLoading}
            className={`w-full py-4 text-xs border rounded-sm transition-all font-black uppercase tracking-[0.2em] disabled:opacity-50 flex items-center justify-center gap-2 ${
               lockdownActive 
               ? 'bg-red-500 text-black border-red-500 hover:bg-red-600' 
               : 'bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20'
            }`}
          >
            {lockdownLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : lockdownActive ? "LIFT LOCKDOWN" : "AUTHORIZE LOCKDOWN"}
          </button>
        </div>

        {/* CURRENCY MANAGEMENT */}
        <div className="p-8 bg-[#0a0a0a] border border-white/5 rounded-sm">
           <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                 <div className="p-2 rounded-sm bg-blue-500/10 text-blue-400">
                    <TrendingUp className="w-5 h-5" />
                 </div>
                 <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Currency Registry</h2>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest text-nowrap">Pegged Exchange Rates (USD Base)</p>
                 </div>
              </div>
              <button 
                onClick={handleSyncRates}
                disabled={ratesLoading}
                className="px-6 py-2 bg-white/5 border border-white/10 text-white hover:bg-white/10 rounded-sm transition-all font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
              >
                {ratesLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                Refresh Market Data
              </button>
           </div>

           <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Nigeria', cur: 'NGN', val: rates?.NGN },
                { label: 'Ghana', cur: 'GHS', val: rates?.GHS },
                { label: 'South Africa', cur: 'ZAR', val: rates?.ZAR },
                { label: 'Kenya', cur: 'KES', val: rates?.KES }
              ].map(item => (
                <div key={item.cur} className="border border-white/5 bg-black/40 p-4 rounded-sm relative group overflow-hidden">
                   <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:scale-110 transition-transform">
                      <Landmark className="w-8 h-8 text-white" />
                   </div>
                   <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mb-1">{item.label}</p>
                   <div className="flex items-baseline gap-2">
                      <span className="text-xl font-black text-white italic tracking-tighter">{item.val || '---'}</span>
                      <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">{item.cur}</span>
                   </div>
                   <div className="mt-3 pt-3 border-t border-white/5 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[7px] font-bold uppercase text-gray-600">
                         <span>Deposit Yield (-2%)</span>
                         <span className="text-red-400/80">{(item.val ? (item.val * 0.98).toFixed(2) : '--')}</span>
                      </div>
                      <div className="flex justify-between items-center text-[7px] font-bold uppercase text-gray-600">
                         <span>Payout Cost (+2%)</span>
                         <span className="text-blue-400/80">{(item.val ? (item.val * 1.02).toFixed(2) : '--')}</span>
                      </div>
                   </div>
                </div>
              ))}
           </div>
        </div>

        {/* AUDIT LOGS */}
        <div className="p-8 bg-[#0a0a0a] border border-white/5 rounded-sm">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <History className="w-6 h-6 text-blue-400" />
              <div>
                <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Tactical Intelligence</h2>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Global Audit Log · Monitor Admin Activity</p>
              </div>
            </div>
            <button 
              onClick={handleLoadGlobalAudit}
              className="px-6 py-2 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-sm hover:bg-blue-500/20 transition-all font-black text-[9px] uppercase tracking-widest flex items-center gap-2"
            >
               {globalAuditView ? "Secure Archive" : "Decrypt Logs"}
               {lockdownLoading && <Loader2 className="w-3 h-3 animate-spin" />}
            </button>
          </div>
          
          {globalAuditView && (
            <div className="mt-6 max-h-[500px] overflow-y-auto custom-scrollbar border border-white/5 bg-black p-4 space-y-1">
               {globalAuditData.length === 0 ? (
                  <p className="text-[10px] text-center text-gray-500 py-20 font-bold uppercase tracking-widest flex items-center justify-center gap-2">
                     <AlertTriangle className="w-4 h-4" /> Intercepting Data Stream...
                  </p>
               ) : (
                  <div className="divide-y divide-white/5">
                     {globalAuditData.map((log) => (
                        <div key={log.id} className="py-3 px-4 flex items-start gap-4 hover:bg-white/[0.02] transition-colors border-l-2 border-transparent hover:border-blue-500/50">
                           <div className="text-[9px] text-gray-500 font-mono shrink-0 pt-0.5 w-[140px]">
                              {new Date(log.timestamp).toLocaleString()}
                           </div>
                           <div className="flex-1">
                              <p className="text-white text-[11px] font-black uppercase tracking-widest mb-1 leading-none">
                                 <span className="text-blue-400">{log.adminUsername || log.adminUid?.slice(0, 6)}</span> executed <span className="text-accent">{log.action.replace(/_/g, ' ')}</span>
                              </p>
                              {log.targetUid && (
                                 <p className="text-[9px] text-gray-500 font-bold tracking-widest leading-none mb-1">TARGET: {log.targetUid}</p>
                              )}
                              {log.details && (
                                <div className="text-[9px] text-gray-400 italic mt-1 bg-white/5 p-2 border border-white/5 rounded-sm">
                                  {typeof log.details === 'string' ? `"${log.details}"` : JSON.stringify(log.details)}
                                </div>
                              )}
                           </div>
                           {log.severity === 'CRITICAL' && (
                             <div className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-sm">
                               Critical
                             </div>
                           )}
                        </div>
                     ))}
                  </div>
               )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
