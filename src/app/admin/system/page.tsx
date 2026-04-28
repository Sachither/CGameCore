"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { getAuditLogsAction, toggleSystemLockdownAction, resetAdminSecurityPinAction, getStaffListAction, setupAdminPinAction } from "@/app/actions/admin-actions";
import { syncPlatformRatesAction } from "@/app/actions/rate-actions";
import { ShieldAlert, History, Lock, Unlock, Loader2, AlertTriangle, TrendingUp, RefreshCcw, Landmark, Trash2, Database, Eraser, ShieldCheck, Users, RotateCcw } from "lucide-react";
import { useToast } from "@/context/ToastContext";
import { resetPlatformFinancesAction, purgeFinancialLogsAction } from "@/app/actions/admin-financial-actions";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";
import AdminPinTerminal from "@/components/admin/AdminPinTerminal";

export default function SuperAdminSystemPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  
  const [lockdownActive, setLockdownActive] = useState(false);
  const [lockdownLoading, setLockdownLoading] = useState(false);
  const [globalAuditData, setGlobalAuditData] = useState<any[]>([]);
  const [globalAuditView, setGlobalAuditView] = useState(false);
  const [rates, setRates] = useState<any>(null);
  const [ratesLoading, setRatesLoading] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [staffLoading, setStaffLoading] = useState(false);
  const toast = useToast();

  // 🛡️ Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant: 'danger' | 'warning' | 'info';
    confirmText?: string;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    variant: 'danger'
  });

  // 🔒 Security PIN States
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isFirstTimePinSetup, setIsFirstTimePinSetup] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  type PendingAction = 
    | { type: 'LOCKDOWN', active: boolean }
    | { type: 'RESET_FINANCE' }
    | { type: 'PURGE_LOGS' }
    | { type: 'PURGE_PIN', targetUid: string };
  
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
      loadStaff();
    }
  }, [isSuperAdmin]);

  const loadStaff = async () => {
    const idToken = await user?.getIdToken();
    if (!idToken) return;
    setStaffLoading(true);
    try {
      const res = await getStaffListAction(idToken);
      if (res.success) setStaffList(res.staff || []);
    } catch (e) {
      console.error("Staff load failed", e);
    }
    setStaffLoading(false);
  };

  const handleToggleLockdown = () => {
    setConfirmModal({
      isOpen: true,
      title: lockdownActive ? "LIFT LOCKDOWN" : "AUTHORIZE LOCKDOWN",
      message: lockdownActive 
        ? "Lift emergency lockdown? Platform matchmaking and financial operations will resume immediately." 
        : "INITIALIZE EMERGENCY LOCKDOWN? All matchmaking and financial operations platform-wide will be suspended!",
      variant: lockdownActive ? 'info' : 'danger',
      confirmText: lockdownActive ? "Resume Operations" : "Execute Lockdown",
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setPendingAction({ type: 'LOCKDOWN', active: !lockdownActive });
        setIsPinModalOpen(true);
      }
    });
  };

  const handleResetFinances = () => {
    setConfirmModal({
      isOpen: true,
      title: "NUKE: FINANCIAL STATS",
      message: "CRITICAL PROTOCOL: This will reset all aggregate profit, deposit, and payout stats to ZERO. This action is IRREVERSIBLE. Confirm treasury reset?",
      variant: 'danger',
      confirmText: "Wipe Stats",
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setPendingAction({ type: 'RESET_FINANCE' });
        setIsPinModalOpen(true);
      }
    });
  };

  const handlePurgeLogs = () => {
    setConfirmModal({
      isOpen: true,
      title: "NUKE: TRANSACTION LEDGER",
      message: "NUKE PROTOCOL: This will PERMANENTLY DELETE current transaction ledger entries. This makes past matches un-auditable. Proceed?",
      variant: 'danger',
      confirmText: "Purge Ledger",
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setPendingAction({ type: 'PURGE_LOGS' });
        setIsPinModalOpen(true);
      }
    });
  };

  const handlePurgePin = (targetUid: string) => {
    setConfirmModal({
      isOpen: true,
      title: "PURGE SECURITY PIN",
      message: "CAUTION: This will physically wipe this admin's security PIN. They will be forced to set a NEW master key on their next action. Proceed?",
      variant: 'warning',
      confirmText: "Authorize Wipe",
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setPendingAction({ type: 'PURGE_PIN', targetUid });
        setIsPinModalOpen(true);
      }
    });
  };

  const handlePinSuccess = async (pin: string) => {
    if (!user || !pendingAction) return;

    try {
      const idToken = await user.getIdToken();
      
      // Handle PIN Setup if required
      if (isFirstTimePinSetup) {
        const setupResult = await setupAdminPinAction(idToken, pin);
        if (!setupResult.success) {
          setPinError(setupResult.error || "Setup failed");
          return;
        }
      }

      // Execute the pending action
      let actionResult;
      if (pendingAction.type === 'LOCKDOWN') {
        setLockdownLoading(true);
        actionResult = await toggleSystemLockdownAction(idToken, pendingAction.active, "Super Admin Override", pin);
      } else if (pendingAction.type === 'RESET_FINANCE') {
        setFinanceLoading(true);
        actionResult = await resetPlatformFinancesAction(idToken, pin);
      } else if (pendingAction.type === 'PURGE_LOGS') {
        setFinanceLoading(true);
        actionResult = await purgeFinancialLogsAction(idToken, pin);
      } else if (pendingAction.type === 'PURGE_PIN') {
        setStaffLoading(true);
        actionResult = await resetAdminSecurityPinAction(idToken, pendingAction.targetUid, pin);
      }

      if (actionResult?.success) {
        toast.success("ACTION AUTHORIZED", "The command has been executed successfully.");
        setIsPinModalOpen(false);
        setPendingAction(null);
        
        // Refresh UI
        if (pendingAction.type === 'LOCKDOWN') setLockdownActive(pendingAction.active);
        if (pendingAction.type === 'PURGE_PIN') loadStaff();
      } else {
        if (actionResult?.error?.includes("SECURITY_UNCONFIGURED")) {
          setIsFirstTimePinSetup(true);
        } else {
          setPinError(actionResult?.error || "Invalid Security PIN");
        }
      }
    } catch (error) {
      console.error("Action execution failed:", error);
      setPinError("System communication failure");
    } finally {
       setLockdownLoading(false);
       setFinanceLoading(false);
       setStaffLoading(false);
    }
  };

  const handleLoadGlobalAudit = async () => {
    if (!user) return;
    setGlobalAuditView(true);
    setGlobalAuditData([]);
    const idToken = await user.getIdToken();
    const res = await getAuditLogsAction(idToken, 200);
    if (res.success) setGlobalAuditData(res.logs || []);
    else toast.error("LOG DECRYPTION FAILED", res.error);
  };

  const handleSyncRates = async () => {
    if (!user) return;
    setRatesLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await syncPlatformRatesAction(idToken);
      if (res.success) {
        setRates(res.rates);
        toast.success("RATES SYNCHRONIZED", "Exchange rates updated via external API.");
      } else {
        toast.error("SYNC FAILED", res.error);
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
    <div className="max-w-4xl mx-auto pb-20">
      <div className="mb-8">
        <p className="text-[10px] text-red-500 font-black uppercase tracking-[0.3em] mb-1">Super Admin Exclusive</p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          System <span className="text-red-500">Control</span>
        </h1>
      </div>

      <div className="space-y-6">
        {/* PERSONAL SECURITY OVERRIDE */}
        <div className="p-8 bg-blue-500/[0.02] border border-blue-500/10 rounded-sm">
           <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-sm bg-blue-500/10 text-blue-500">
                 <Lock className="w-6 h-6" />
              </div>
              <div>
                 <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Personal Security Override</h2>
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Self-Service Credential Recovery</p>
              </div>
           </div>
           <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mb-6 leading-relaxed max-w-2xl">
              As the Master operative, you can purge your own security hash. You will be prompted to set a NEW 6-digit master key on your next authorized action.
           </p>
           <button 
             onClick={() => handlePurgePin(user?.uid || '')}
             disabled={staffLoading}
             className="px-6 py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
           >
             {staffLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><RotateCcw className="w-4 h-4" /> Reset My Master PIN</>}
           </button>
        </div>

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

        {/* STAFF SECURITY MANAGEMENT */}
        <div className="p-8 bg-[#0a0a0a] border border-red-500/20 rounded-sm">
           <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-sm bg-red-500/10 text-red-500">
                 <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                 <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Staff Security & Recovery</h2>
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Emergency PIN Overrides & Oversight</p>
              </div>
           </div>

           {staffLoading && staffList.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-white/5 rounded-sm">
                 <Loader2 className="w-5 h-5 text-gray-800 animate-spin mx-auto" />
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                 {staffList.map((staff) => (
                    <div key={staff.uid} className="p-4 bg-black border border-white/5 rounded-sm hover:border-red-500/20 transition-all group">
                       <div className="flex items-start justify-between mb-3">
                          <div>
                             <p className="text-white font-black text-xs uppercase italic">{staff.username}</p>
                             <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">{staff.email}</p>
                          </div>
                          <span className={`text-[7px] font-black px-1.5 py-0.5 rounded-sm border ${staff.role === 'SUPER_ADMIN' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                             {staff.role}
                          </span>
                       </div>
                       
                       <button 
                         onClick={() => handlePurgePin(staff.uid)}
                         disabled={staffLoading}
                         className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                       >
                         {staffLoading && staffList.find(s => s.uid === staff.uid) ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Lock className="w-3 h-3" /> Purge Security PIN</>}
                       </button>
                    </div>
                 ))}
              </div>
           )}

            <div className="flex justify-end mt-4">
               <button 
                 onClick={loadStaff}
                 className="text-[8px] font-black uppercase tracking-widest text-gray-600 hover:text-white flex items-center gap-2 transition-all"
               >
                 <RefreshCcw className="w-2.5 h-2.5" /> Force Staff Synchronization
               </button>
            </div>
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

         {/* NUKE PROTOCOL: FINANCE */}
         <div className="p-8 bg-[#0a0a0a] border border-red-500/20 rounded-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
               <Trash2 className="w-32 h-32 text-red-500 font-black" />
            </div>
            
            <div className="flex items-center gap-3 mb-6 relative z-10">
               <div className="p-2 rounded-sm bg-red-500/10 text-red-500">
                  <Database className="w-5 h-5" />
               </div>
               <div>
                  <h2 className="text-xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Nuke Protocol: Finance</h2>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Permanent Data Purge & Treasury Reset</p>
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 relative z-10">
               <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-sm">
                  <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Reset Financial Stats</h3>
                  <p className="text-[9px] text-gray-500 font-bold leading-relaxed mb-6 uppercase tracking-widest">
                     Zero out aggregate Profit, Deposits, and Payout stats. Use this to clear test-mode data residuals.
                  </p>
                  <button 
                    onClick={handleResetFinances}
                    disabled={financeLoading}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {financeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Eraser className="w-3.5 h-3.5" /> Wipe Platform Stats</>}
                  </button>
               </div>

               <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-sm">
                  <h3 className="text-xs font-black text-red-500 uppercase tracking-widest mb-2">Purge Transaction Ledger</h3>
                  <p className="text-[9px] text-gray-500 font-bold leading-relaxed mb-6 uppercase tracking-widest">
                     Atomically delete internal transaction records. WARNING: This makes past matches un-auditable.
                  </p>
                  <button 
                    onClick={handlePurgeLogs}
                    disabled={financeLoading}
                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                  >
                    {financeLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Trash2 className="w-3.5 h-3.5" /> Purge Logs</>}
                  </button>
               </div>
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

      {/* 🛡️ Sovereign Confirmation Terminal */}
      <AdminConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        variant={confirmModal.variant}
        confirmText={confirmModal.confirmText}
      />

      {/* 🔒 Security Terminal */}
      <AdminPinTerminal
        isOpen={isPinModalOpen}
        onClose={() => {
           setIsPinModalOpen(false);
           setPinError(null);
           setIsFirstTimePinSetup(false);
           setPendingAction(null);
        }}
        onSuccess={handlePinSuccess}
        title={isFirstTimePinSetup ? "Set Master Security PIN" : "Authorize Strategic Command"}
        error={pinError}
      />
    </div>
  );
}
