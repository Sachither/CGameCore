"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  searchUserAction,
  setBanStatusAction,
  adjustUserBalanceAction,
  upgradeToPartnerAction,
} from "@/app/actions/admin-actions";
import {
  Search, Users, ShieldCheck, ShieldOff, Ban, Coins,
  Loader2, CheckCircle2, AlertTriangle, Shield, X, UserCog, UserCheck, Calendar, Clock
} from "lucide-react";
import { setUserRoleAction } from "@/app/actions/admin-actions";

interface UserDoc {
  id: string;
  uid: string;
  username: string;
  email: string;
  balanceCoins: number;
  totalWins?: number;
  totalMatches?: number;
  isAdmin?: boolean;
  role?: 'USER' | 'MODERATOR' | 'ADMIN';
  isBanned?: boolean;
  banReason?: string;
  suspendedUntil?: any;
  createdAt?: any;
}

function ConfirmActionModal({ isOpen, onClose, onConfirm, title, message, confirmText, loading, showInput, inputValue, onInputChange, durationHours, onDurationChange, type }: {
  isOpen: boolean,
  onClose: () => void,
  onConfirm: () => void,
  title: string,
  message: string,
  confirmText: string,
  loading: boolean,
  showInput?: boolean,
  inputValue?: string,
  onInputChange?: (val: string) => void,
  durationHours?: number,
  onDurationChange?: (val: number) => void,
  type?: 'BAN' | 'PARTNER' | 'ROLE'
}) {
  if (!isOpen) return null;

  const isPartner = type === 'PARTNER';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className={`absolute top-0 left-0 w-full h-1 ${isPartner ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]'}`} />
        <div className="flex items-center gap-3 mb-4">
           {isPartner ? <ShieldCheck className="w-6 h-6 text-blue-500" /> : <AlertTriangle className="w-6 h-6 text-red-500" />}
           <h3 className="text-sm font-black uppercase text-white italic tracking-tighter">{title}</h3>
        </div>
        <p className="text-[11px] text-gray-400 font-bold leading-relaxed mb-4 uppercase tracking-wider">
           {message}
        </p>

        {showInput && (
           <div className="mb-6 space-y-4">
              <div>
                 <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1.5 px-1">
                   {isPartner ? "Clearance Window" : "Lockdown Duration"}
                 </p>
                 <div className="grid grid-cols-4 gap-1.5">
                    {(isPartner ? [
                      { l: '5M (TEST)', v: 0.083333 }, // 5 / 60 (Hours)
                      { l: '30D', v: 720 },
                      { l: '60D', v: 1440 },
                      { l: '90D', v: 2160 },
                    ] : [
                      { l: '24H', v: 24 },
                      { l: '48H', v: 48 },
                      { l: '7D', v: 168 },
                      { l: 'PERM', v: 0 }
                    ]).map((d) => (
                       <button
                         key={d.l}
                         type="button"
                         onClick={() => onDurationChange?.(d.v)}
                         className={`py-2 text-[9px] font-black uppercase tracking-widest border rounded-sm transition-all ${
                            durationHours === d.v 
                            ? (isPartner ? 'bg-blue-600 border-blue-600 text-white' : 'bg-red-500 border-red-500 text-black') 
                            : 'bg-black border-white/10 text-gray-500 hover:text-white'
                         }`}
                       >
                         {d.l}
                       </button>
                    ))}
                 </div>
              </div>

              <div>
                 <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1.5 px-1">
                   {isPartner ? "Operational Purpose" : "Tactical Justification"}
                 </p>
                 {isPartner ? (
                    <input 
                      type="text"
                      value={inputValue}
                      onChange={(e) => onInputChange?.(e.target.value)}
                      placeholder="Custom Code (Optional)"
                      className="w-full bg-black/50 border border-blue-500/20 focus:border-blue-500/50 text-white px-3 py-2.5 text-[11px] font-bold rounded-sm outline-none transition-all placeholder-gray-800"
                    />
                 ) : (
                    <textarea 
                      value={inputValue}
                      onChange={(e) => onInputChange?.(e.target.value)}
                      placeholder="Explain the security breach..."
                      className="w-full bg-black/50 border border-red-500/20 focus:border-red-500/50 text-white p-3 text-[11px] font-bold rounded-sm outline-none transition-all placeholder-gray-800 min-h-[80px] resize-none"
                    />
                 )}
                 <p className={`text-[8px] font-black uppercase tracking-widest mt-1 ${isPartner ? 'text-blue-500/50' : 'text-red-500/50'}`}>
                   {isPartner ? "Code auto-generates if empty" : "Audit Log Required"}
                 </p>
              </div>
           </div>
        )}

        <div className="flex gap-2">
           <button onClick={onClose} className="flex-1 py-3 bg-black border border-white/10 text-gray-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-sm transition-all text-center">
              Abort
           </button>
           <button 
              onClick={onConfirm} 
              disabled={loading || (!isPartner && showInput && !inputValue?.trim())}
              className={`flex-1 py-3 text-black text-[9px] font-black uppercase tracking-widest rounded-sm hover:translate-y-[-1px] transition-all shadow-xl disabled:opacity-50 text-center uppercase ${isPartner ? 'bg-blue-500 text-white' : 'bg-red-500'}`}
           >
              {loading ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : confirmText}
           </button>
        </div>
      </div>
    </div>
  );
}

function UserModal({ user: u, adminUser, adminProfile, onClose, onRefresh }: {
  user: UserDoc,
  adminUser: any,
  adminProfile: any,
  onClose: () => void,
  onRefresh: () => void
}) {
  const [loading, setLoading] = useState(false);
  const [balanceAmount, setBalanceAmount] = useState("");
  const [balanceNote, setBalanceNote] = useState("");
  const [banJustification, setBanJustification] = useState("");
  const [banDuration, setBanDuration] = useState(24);
  const [feedback, setFeedback] = useState("");
  const [adjustMode, setAdjustMode] = useState<'ADD' | 'DEDUCT'>('ADD');
  const [showConfirm, setShowConfirm] = useState<{ open: boolean, type: 'ROLE' | 'BAN' | 'PARTNER', payload?: any }>({ open: false, type: 'ROLE' });
  const [customPartnerCode, setCustomPartnerCode] = useState("");
  const [partnerDuration, setPartnerDuration] = useState(2160); // Default 90 days (2160 hours)

  const act = async (fn: () => Promise<{ success: boolean; error?: string }>, label: string) => {
    setLoading(true);
    setFeedback("");
    const result = await fn();
    if (result.success) {
      setFeedback(`✓ ${label} successful.`);
      onRefresh();
    } else {
      setFeedback(`✗ Error: ${result.error}`);
    }
    setLoading(false);
  };

  const handleBanCommit = async () => {
    if (!adminUser) return;
    const isActuallyBanning = !u.isBanned;
    const reason = isActuallyBanning ? (banJustification || "Breach of Tactical Protocol.") : "";
    const duration = isActuallyBanning ? banDuration : 0;
    
    const idToken = await adminUser.getIdToken();
    await act(
       () => setBanStatusAction(idToken, u.uid, isActuallyBanning, reason, duration), 
       isActuallyBanning ? (duration > 0 ? `Suspension (${duration}h)` : "Permanent Ban") : "Unban"
    );
    setShowConfirm({ open: false, type: 'BAN' });
    setBanJustification("");
  };

  const handleRoleCommit = async () => {
    if (!adminUser || !showConfirm.payload) return;
    const newRole = showConfirm.payload;
    const idToken = await adminUser.getIdToken();
    await act(() => setUserRoleAction(idToken, u.uid, newRole), `Clearance set to ${newRole}`);
    setShowConfirm({ open: false, type: 'ROLE' });
  };

  const handlePartnerCommit = async () => {
    if (!adminUser) return;
    const idToken = await adminUser.getIdToken();
    const durationDays = partnerDuration / 24;
    await act(
      () => upgradeToPartnerAction(idToken, u.uid, customPartnerCode, durationDays), 
      `Upgraded to Partner (${durationDays} Days)`
    );
    setShowConfirm({ open: false, type: 'PARTNER' });
    setCustomPartnerCode("");
    setPartnerDuration(2160);
  };

  const handleBalanceAdjust = async () => {
    const rawAmount = parseInt(balanceAmount);
    if (!rawAmount || rawAmount <= 0) {
      setFeedback("✗ Please enter a positive adjustment amount.");
      return;
    }
    
    // Add Coins: Max 1000 limit
    if (adjustMode === 'ADD' && rawAmount > 1000) {
      setFeedback("✗ Maximum addition is 1000 coins.");
      return;
    }
    
    // Deduct Coins: Cannot exceed user's current balance
    if (adjustMode === 'DEDUCT' && rawAmount > (u.balanceCoins || 0)) {
      setFeedback(`✗ Cannot deduct more than user's balance (${u.balanceCoins || 0} coins).`);
      return;
    }
    
    if (!balanceNote.trim()) {
      setFeedback("✗ Justification is required.");
      return;
    }
    const amount = adjustMode === 'ADD' ? rawAmount : -rawAmount;
    if (!adminUser) return;
    const idToken = await adminUser.getIdToken();
    await act(
      () => adjustUserBalanceAction(idToken, u.uid, amount, balanceNote),
      `Balance adjusted by ${amount > 0 ? "+" : ""}${amount}`
    );
    setBalanceAmount("");
    setBalanceNote("");
  };

  const isPermanentlyBanned = u.isBanned && !u.suspendedUntil;
  const suspensionEnd = u.suspendedUntil ? (u.suspendedUntil.toDate ? u.suspendedUntil.toDate() : new Date(u.suspendedUntil)) : null;
  const isCurrentlySuspended = suspensionEnd && suspensionEnd > new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl overflow-hidden">
        <div className="flex items-start justify-between p-6 border-b border-white/5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {u.isAdmin && (
                <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-sm">ADMIN</span>
              )}
              {isPermanentlyBanned && (
                <span className="text-[8px] font-black uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-sm">BANNED</span>
              )}
              {isCurrentlySuspended && (
                <span className="text-[8px] font-black uppercase tracking-widest text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-sm">SUSPENDED</span>
              )}
            </div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{u.username}</h2>
            <div className="flex items-center gap-3 mt-1.5">
               <p className="text-[10px] text-gray-500 font-mono italic">{u.uid}</p>
               {u.createdAt && (
                  <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold uppercase tracking-widest pl-3 border-l border-white/5">
                     <Calendar className="w-3 h-3 text-red-500" />
                     Joined: {new Date(u.createdAt).toLocaleDateString()}
                  </div>
               )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-white p-1.5 rounded-sm transition-colors"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {feedback && (
            <div className={`px-4 py-2.5 rounded-sm border text-[10px] font-black uppercase tracking-widest ${feedback.startsWith("✓") ? "bg-green-500/10 border-green-500/20 text-green-400" : "bg-red-500/10 border-red-500/20 text-red-400"}`}>{feedback}</div>
          )}

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Balance", value: `${(u.balanceCoins || 0).toLocaleString()} CR` },
              { label: "Matches", value: u.totalMatches || 0 },
              { label: "Wins", value: u.totalWins || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="bg-black/40 border border-white/5 p-3 rounded-sm text-center">
                <p className="text-lg font-black text-white italic tracking-tighter">{value}</p>
                <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{label}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-3 flex items-center gap-2"><Coins className="w-3.5 h-3.5 text-yellow-400" /> Balance Adjustment</h3>
            <div className="space-y-3">
              <div className="flex gap-1 p-1 bg-black border border-white/5 rounded-sm">
                 <button 
                   onClick={() => setAdjustMode('ADD')}
                   className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${adjustMode === 'ADD' ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'text-gray-500 hover:text-white'}`}
                 >
                    Add Coins
                 </button>
                 <button 
                   onClick={() => setAdjustMode('DEDUCT')}
                   className={`flex-1 py-2 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all ${adjustMode === 'DEDUCT' ? 'bg-red-500 text-black shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-gray-500 hover:text-white'}`}
                 >
                    Deduct Coins
                 </button>
              </div>
              <input 
                type="number" 
                min="1"
                max={adjustMode === 'ADD' ? "1000" : String(u.balanceCoins || 0)}
                value={balanceAmount} 
                onChange={(e) => {
                  const val = e.target.value;
                  const numVal = parseInt(val) || 0;
                  
                  // For ADD mode: enforce 1-1000 limit
                  if (adjustMode === 'ADD') {
                    if (numVal > 1000) {
                      setBalanceAmount('1000');
                    } else {
                      setBalanceAmount(val);
                    }
                  }
                  // For DEDUCT mode: enforce balance limit
                  else {
                    if (numVal > (u.balanceCoins || 0)) {
                      setBalanceAmount(String(u.balanceCoins || 0));
                    } else {
                      setBalanceAmount(val);
                    }
                  }
                }}
                onBlur={(e) => {
                  // Additional validation on blur to catch paste operations
                  const numVal = parseInt(e.target.value) || 0;
                  if (adjustMode === 'ADD' && numVal > 1000) {
                    setBalanceAmount('1000');
                  } else if (adjustMode === 'DEDUCT' && numVal > (u.balanceCoins || 0)) {
                    setBalanceAmount(String(u.balanceCoins || 0));
                  }
                }}
                placeholder={adjustMode === 'ADD' ? "Coins Amount (Max 1000)" : `Amount to Deduct (Max ${u.balanceCoins || 0})`}
                className="w-full bg-black border border-white/10 focus:border-accent text-white px-4 py-2.5 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-700" 
              />
              <input type="text" value={balanceNote} onChange={(e) => setBalanceNote(e.target.value)} placeholder="Reason for change (User will see this)" className="w-full bg-black border border-white/10 focus:border-accent text-white px-4 py-2.5 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-700" />
              <button onClick={handleBalanceAdjust} disabled={loading} className="w-full py-2.5 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2">{loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />} Apply Adjustment</button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setShowConfirm({ open: true, type: 'BAN' })} disabled={loading} className={`py-3 border text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 ${u.isBanned ? "bg-green-500/10 hover:bg-green-500/20 border-green-500/20 text-green-400" : "bg-red-500/10 hover:bg-red-500/20 border-red-500/20 text-red-400"}`}>{u.isBanned ? <><CheckCircle2 className="w-3 h-3" /> Unban Player</> : <><Ban className="w-3 h-3" /> Ban Player</>}</button>
            <div className="relative group/role">
               <button disabled={loading} className="w-full py-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"><UserCog className="w-3 h-3" /> Manage Role</button>
               <div className="absolute bottom-full left-0 w-full mb-2 bg-[#111] border border-white/10 rounded-sm shadow-2xl opacity-0 group-hover/role:opacity-100 pointer-events-none group-hover/role:pointer-events-auto transition-all p-1.5 z-20">
                  <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-1.5 px-2">Select Clearance level</p>
                  {((adminProfile?.role === 'SUPER_ADMIN' || adminProfile?.isSuperAdmin) 
                    ? ['USER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN', 'PARTNER'] 
                    : ['USER', 'MODERATOR', 'ADMIN', 'PARTNER']
                  ).map((role) => (
                    <button 
                      key={role} 
                      onClick={() => {
                        if (role === 'PARTNER') {
                          setShowConfirm({ open: true, type: 'PARTNER' });
                        } else {
                          setShowConfirm({ open: true, type: 'ROLE', payload: role });
                        }
                      }} 
                      className={`w-full text-left px-3 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-colors flex items-center justify-between group/item ${(u.role || (u.isAdmin ? 'ADMIN' : 'USER')) === role ? 'bg-red-500/10 text-red-400' : 'hover:bg-white/5 text-gray-400 hover:text-white'}`}
                    >
                      {role.replace('_', ' ')}
                      {(u.role || (u.isAdmin ? 'ADMIN' : 'USER')) === role && <UserCheck className="w-3 h-3" />}
                    </button>
                  ))}
               </div>
            </div>
          </div>
        </div>

        <ConfirmActionModal 
           isOpen={showConfirm.open}
           onClose={() => setShowConfirm(prev => ({ ...prev, open: false }))}
           onConfirm={showConfirm.type === 'BAN' ? handleBanCommit : (showConfirm.type === 'PARTNER' ? handlePartnerCommit : handleRoleCommit)}
           title={showConfirm.type === 'BAN' ? (u.isBanned ? "Lift Suspension" : "Security Lockdown") : (showConfirm.type === 'PARTNER' ? "Partner Induction" : "Clearance Upgrade")}
           message={showConfirm.type === 'BAN' ? (u.isBanned ? `Confirming restoration for ${u.username}.` : `Locking out ${u.username}. Audit log required.`) : (showConfirm.type === 'PARTNER' ? `Assigning ${u.username} to the Tactical Partner program.` : `Confirming clearance elevation for ${u.username}.`)}
           confirmText={showConfirm.type === 'BAN' ? (u.isBanned ? "Authorize Lift" : "Initiate Lockdown") : (showConfirm.type === 'PARTNER' ? "Authorize Partner" : "Execute")}
           loading={loading}
           showInput={(showConfirm.type === 'BAN' && !u.isBanned) || showConfirm.type === 'PARTNER'}
           inputValue={showConfirm.type === 'BAN' ? banJustification : customPartnerCode}
           onInputChange={showConfirm.type === 'BAN' ? setBanJustification : setCustomPartnerCode}
           durationHours={showConfirm.type === 'PARTNER' ? partnerDuration : banDuration}
           onDurationChange={showConfirm.type === 'PARTNER' ? setPartnerDuration : setBanDuration}
           type={showConfirm.type}
        />
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<UserDoc | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 2) {
        handleSearch();
      } else if (query.trim().length === 0) {
        setResults([]);
        setError("");
      }
    }, 400); // 400ms debounce for tactical scanning

    return () => clearTimeout(timer);
  }, [query]);

  const handleSearch = async () => {
    if (!user || !query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const result = await searchUserAction(idToken, query.trim());
      if (result.success) {
        setResults((result.users as UserDoc[]) || []);
        if (!result.users?.length) setError("No operators found.");
      } else {
        setError(result.error || "Search failed.");
      }
    } catch (err: any) {
      setError("COMM_LINK_FAILURE: Unable to reach Operator Index.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-0">
        <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mb-1">Admin Command Center</p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">Operator <span className="text-red-400">Index</span></h1>
      </div>

      <div className="bg-[#0a0a0a] border border-white/5 p-6 rounded-sm mb-6 mt-8">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSearch()} placeholder="Search by username or UID..." className="w-full bg-black border border-white/10 focus:border-accent text-white pl-12 pr-4 py-3 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-700" />
          </div>
          <button onClick={handleSearch} disabled={loading} className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50 flex items-center gap-2">{loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />} Scan</button>
        </div>
      </div>

      {error && <div className="bg-yellow-500/5 border border-yellow-500/10 px-4 py-3 rounded-sm mb-4"><p className="text-[10px] text-yellow-400/60 font-bold uppercase tracking-widest">{error}</p></div>}

      {results.length > 0 && (
        <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden">
          <div className="divide-y divide-white/5">
            {results.map((u) => {
               const isPermanentlyBanned = u.isBanned && !u.suspendedUntil;
               const suspensionEnd = u.suspendedUntil ? (u.suspendedUntil.toDate ? u.suspendedUntil.toDate() : new Date(u.suspendedUntil)) : null;
               const isCurrentlySuspended = suspensionEnd && suspensionEnd > new Date();
               
               return (
                <button key={u.id} onClick={() => setSelected(u)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-all text-left group">
                  <div className="w-10 h-10 rounded-sm bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
                    {u.isAdmin ? <Shield className="w-4 h-4 text-red-400" /> : <span className="text-white font-black text-sm italic">{u.username?.[0]?.toUpperCase()}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-white font-black italic uppercase tracking-tighter">{u.username}</p>
                      {u.isAdmin && <span className="text-[7px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Admin</span>}
                      {isPermanentlyBanned && <span className="text-[7px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">Banned</span>}
                      {isCurrentlySuspended && (
                         <div className="flex items-center gap-1 text-[7px] font-black text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 rounded-sm uppercase tracking-widest">
                            <Clock className="w-2 h-2" /> Suspended
                         </div>
                      )}
                    </div>
                    <p className="text-[9px] text-gray-600 font-mono truncate">{u.uid}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-white font-black text-sm italic tracking-tighter">{(u.balanceCoins || 0).toLocaleString()} CR</p>
                    <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">{u.totalWins || 0}W / {u.totalMatches || 0}M</p>
                  </div>
                </button>
               );
            })}
          </div>
        </div>
      )}

      {selected && (
        <UserModal user={selected} adminUser={user} adminProfile={profile} onClose={() => setSelected(null)} onRefresh={() => handleSearch()} />
      )}
    </div>
  );
}
