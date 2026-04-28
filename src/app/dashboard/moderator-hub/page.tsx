"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { getDisputedMatchesAction, getUserAuditHistoryAction, searchUserAction, alertPlayersOfAdminPresence, setUserRoleAction, resolveDisputeAction, setupAdminPinAction, resetAdminSecurityPinAction, getStaffListAction } from "@/app/actions/admin-actions";
import { ShieldAlert, Search, AlertTriangle, History, BarChart3, Loader2, Users, BellRing, Settings, CheckCircle2, RotateCcw, Gavel, ExternalLink, ImageIcon, XCircle, Lock, ShieldCheck, Terminal, MessageSquare, PlayCircle, Image as LucideImage } from "lucide-react";
import AdminPinTerminal from "@/components/admin/AdminPinTerminal";
import { useToast } from "@/context/ToastContext";
import { db } from "@/lib/firebase";
import SafeImage from "@/components/ui/SafeImage";
import Link from "next/link";
import AdminConfirmModal from "@/components/admin/AdminConfirmModal";

export default function ModeratorHubPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"disputes" | "search" | "alerts" | "admin" | "super">("disputes");
  const [disputes, setDisputes] = useState<any[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [alerting, setAlerting] = useState<string | null>(null);
  const [alertFeedback, setAlertFeedback] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);
  const { idToken } = useAuth();
  const [roleLoading, setRoleLoading] = useState<string | null>(null);
  const toast = useToast();
  const [staffList, setStaffList] = useState<any[]>([]);
  
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

  // 🔒 Role hierarchy
  const isModerator = profile?.role === 'MODERATOR';
  const isAdmin = profile?.role === 'ADMIN' || profile?.isAdmin === true;
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  type PendingAction = 
    | { type: 'RESOLVE', matchId: string, winnerId: string, winnerName: string }
    | { type: 'ROLE', targetUid: string, role: any }
    | { type: 'PURGE', targetUid: string };

  // Check if user has ANY admin access
  const hasAnyAccess = isModerator || isAdmin || isSuperAdmin;

  useEffect(() => {
    if (!loading && (!profile || !hasAnyAccess)) {
      router.push('/dashboard');
    }
  }, [profile, loading, router, hasAnyAccess]);

  useEffect(() => {
    if (isModerator && (activeTab === 'admin' || activeTab === 'super')) {
      setActiveTab('disputes');
    }
    if (isAdmin && !isSuperAdmin && activeTab === 'super') {
      setActiveTab('disputes');
    }
  }, [profile?.role, activeTab, isModerator, isAdmin, isSuperAdmin]);

  const loadDisputes = async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const result = await getDisputedMatchesAction(idToken);
      if (result.success) setDisputes(result.matches || []);
    } catch (error) {
      console.error("Failed to load disputes:", error);
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "disputes") {
      loadDisputes();
    }

    if (activeTab === "super" && isSuperAdmin) {
        const loadStaff = async () => {
          try {
             const idToken = await user?.getIdToken();
             if (!idToken) return;
             const result = await getStaffListAction(idToken);
             if (result.success) setStaffList(result.staff || []);
          } catch (error) {
             console.error("Failed to load staff list:", error);
          }
       };
       loadStaff();
    }
  }, [activeTab, user, isSuperAdmin]);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    try {
      const idToken = await user.getIdToken();
      const result = await searchUserAction(idToken, searchQuery);
      if (result.success) setSearchResults(result.users || []);
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  const handleViewAudit = async (uid: string) => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const result = await getUserAuditHistoryAction(idToken, uid);
      if (result.success) setAuditData(result.audit || []);
    } catch (error) {
      console.error("Audit load failed:", error);
    }
  };

  const handleAlertPlayers = async (e: React.MouseEvent, matchId: string) => {
    e.stopPropagation();
    if (!user) return;
    setAlerting(matchId);
    try {
      const idToken = await user.getIdToken();
      const res = await alertPlayersOfAdminPresence(idToken, matchId);
      if (res.success) {
        toast.success("ALERT BROADCAST", "Players have been notified of administrative oversight.");
      } else {
        toast.error("ALERT FAILED", res.error);
      }
    } catch (err: any) {
      toast.error("COMM_FAILURE", err.message);
    } finally {
      setAlerting(null);
    }
  };

  const handleResolve = (matchId: string, winnerId: string, winnerName: string) => {
     setConfirmModal({
        isOpen: true,
        title: "TRIBUNAL VERDICT",
        message: winnerId === "REFUND" 
           ? "Are you sure you want to VOID this match and REFUND all players?" 
           : `Award the victory to ${winnerName}? This will distribute all funds and advance the tournament bracket if applicable.`,
        variant: winnerId === "REFUND" ? 'warning' : 'info',
        confirmText: winnerId === "REFUND" ? "Execute Refund" : "Award Victory",
        onConfirm: () => {
           setConfirmModal(prev => ({ ...prev, isOpen: false }));
           setPendingAction({ type: 'RESOLVE', matchId, winnerId, winnerName });
           setIsPinModalOpen(true);
        }
     });
  };

  const handleSetRole = (uid: string, role: any) => {
     setConfirmModal({
        isOpen: true,
        title: "CLEARANCE MODIFICATION",
        message: `Are you sure you want to set this operator's role to ${role}? This will immediately adjust their platform permissions.`,
        variant: 'warning',
        confirmText: "Update Role",
        onConfirm: () => {
           setConfirmModal(prev => ({ ...prev, isOpen: false }));
           setPendingAction({ type: 'ROLE', targetUid: uid, role });
           setIsPinModalOpen(true);
        }
     });
  };

  const handlePurgePin = (uid: string) => {
    setConfirmModal({
      isOpen: true,
      title: "PURGE SECURITY PIN",
      message: "CAUTION: This will physically wipe this admin's security PIN. They will be forced to set a NEW master key on their next action. Proceed?",
      variant: 'danger',
      confirmText: "Authorize Wipe",
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        setPendingAction({ type: 'PURGE', targetUid: uid });
        setIsPinModalOpen(true);
      }
    });
  };

  const handlePinSuccess = async (pin: string) => {
    if (!user || !pendingAction) return;

    try {
      const idToken = await user.getIdToken();
      
      if (isFirstTimePinSetup) {
        const setupResult = await setupAdminPinAction(idToken, pin);
        if (!setupResult.success) {
          setPinError(setupResult.error || "Setup failed");
          return;
        }
      }

      let actionResult;
      if (pendingAction.type === 'RESOLVE') {
        setResolving(pendingAction.matchId);
        actionResult = await resolveDisputeAction(idToken, pendingAction.matchId, pendingAction.winnerId, pin);
      } else if (pendingAction.type === 'ROLE') {
        actionResult = await setUserRoleAction(idToken, pendingAction.targetUid, pendingAction.role, pin);
      } else if (pendingAction.type === 'PURGE') {
        actionResult = await resetAdminSecurityPinAction(idToken, pendingAction.targetUid, pin);
      }

      if (actionResult?.success) {
        toast.success("ACTION AUTHORIZED", "The command has been executed successfully.");
        setIsPinModalOpen(false);
        setPendingAction(null);
        setPinError(null);
        setIsFirstTimePinSetup(false);
        
        // Refresh local state
        if (pendingAction.type === 'RESOLVE') {
          setDisputes(prev => prev.filter(m => m.id !== pendingAction.matchId));
        } else if (pendingAction.type === 'ROLE' || pendingAction.type === 'PURGE') {
           if (activeTab === "super") {
             const staffRes = await getStaffListAction(idToken);
             if (staffRes.success) setStaffList(staffRes.staff || []);
           }
           if (activeTab === "search") handleSearch();
        }
      } else {
        if (actionResult?.error?.includes("SECURITY_UNCONFIGURED")) {
          // 🛡️ Security Cleanse: Clear errors and prep setup UI
          setPinError(null);
          setIsFirstTimePinSetup(true);
          toast.info("SECURITY INITIALIZATION", "No master key found. Please initialize your 6-digit security PIN now.");
        } else {
          setPinError(actionResult?.error || "Invalid Security PIN");
        }
      }
    } catch (error) {
      console.error("Action execution failed:", error);
      setPinError("System communication failure");
    } finally {
       setResolving(null);
    }
  };

  if (loading) return (
    <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>
  );

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em] mb-1">Command Oversight</p>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
            Staff <span className="text-accent">Command Center</span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
           <Terminal className="w-5 h-5 text-accent" />
           <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">{profile?.role} Clearance Active</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-8 border-b border-white/5 overflow-x-auto custom-scrollbar">
        <button
          onClick={() => setActiveTab("disputes")}
          className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === "disputes" ? "text-accent border-accent" : "text-gray-500 border-transparent hover:text-main"
          }`}
        >
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" />
            Active Disputes
          </div>
        </button>

        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === "search" ? "text-accent border-accent" : "text-gray-500 border-transparent hover:text-main"
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Intelligence Search
          </div>
        </button>

        {(isAdmin || isSuperAdmin) && (
          <button
            onClick={() => setActiveTab("admin")}
            className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "admin" ? "text-accent border-accent" : "text-gray-500 border-transparent hover:text-main"
            }`}
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Admin Tools
            </div>
          </button>
        )}

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("super")}
            className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "super" ? "text-accent border-accent" : "text-gray-500 border-transparent hover:text-main"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              System Control
            </div>
          </button>
        )}
      </div>

      {/* Content */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden min-h-[400px]">
        {activeTab === "disputes" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Active Disputes Requiring Review
              </p>
              <button 
                onClick={loadDisputes}
                className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-white transition-colors flex items-center gap-2"
              >
                <RotateCcw className="w-3 h-3" /> Refresh Feed
              </button>
            </div>
            
            {dataLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-white/5 rounded-sm">
                <ShieldAlert className="w-8 h-8 text-gray-800 mx-auto mb-3" />
                <p className="text-gray-600 text-xs font-black uppercase tracking-widest">No active disputes detected</p>
              </div>
            ) : (
              <div className="space-y-6">
                {disputes.map((match: any) => {
                  const players = Object.values(match.players || {}).map((p: any, idx: number) => ({
                    ...p,
                    uid: Object.keys(match.players)[idx]
                  }));

                  return (
                    <div
                      key={match.id}
                      className="w-full text-left bg-black border border-white/5 rounded-sm overflow-hidden hover:border-accent/30 transition-all group/card"
                    >
                      {/* Top Bar: ID and Alert */}
                      <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          <Gavel className="w-4 h-4 text-red-500" />
                          <div>
                            <p className="text-accent font-black text-xs">#{match.id?.slice(0, 8)}</p>
                            <p className="text-[8px] text-gray-500 uppercase tracking-widest">{new Date(match.createdAt).toLocaleDateString()} · {match.game}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                           <button
                             onClick={(e) => handleAlertPlayers(e, match.id)}
                             disabled={alerting === match.id}
                             className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 text-[8px] font-black uppercase tracking-widest rounded-sm hover:bg-yellow-500/20 transition-all"
                           >
                             {alerting === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3" />}
                             Alert Players
                           </button>
                           
                           <Link 
                             href={`/match/${match.id}`} 
                             target="_blank"
                             className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 text-blue-500 text-[8px] font-black uppercase tracking-widest rounded-sm hover:bg-blue-500/20 transition-all"
                           >
                             <MessageSquare className="w-3 h-3" /> Join Tactical Comms
                           </Link>
                        </div>
                      </div>

                      {/* Player Grid */}
                      <div className="grid grid-cols-2 divide-x divide-white/5 border-b border-white/5">
                        {players.map((player: any) => (
                          <div key={player.uid} className="p-4 flex items-center justify-between group">
                            <div className="flex items-center gap-3">
                              <div>
                                <p className="text-white font-black text-[10px] uppercase">{player.username}</p>
                                <p className="text-[8px] text-gray-500 uppercase tracking-widest">ID: {player.uid?.slice(0, 6)}</p>
                              </div>
                            </div>
                            
                            <div className="text-right">
                              <p className="text-accent font-black text-xs italic">${player.potentialWin?.toFixed(2)}</p>
                              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Potential Payout</p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* CONFLICT EVIDENCE GALLERY */}
                      <div className="p-4 bg-red-500/[0.02] border-b border-white/5">
                         <div className="flex items-center gap-2 mb-4">
                            <ImageIcon className="w-3.5 h-3.5 text-red-500" />
                            <h3 className="text-[9px] text-red-500 font-black uppercase tracking-widest italic">Conflict Evidence Recon</h3>
                         </div>
                         
                         {(!match.allEvidence || match.allEvidence.length === 0) ? (
                            <div className="py-8 text-center border border-dashed border-red-500/10 rounded-sm">
                               <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Awaiting result uploads from combatants</p>
                            </div>
                         ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                               {match.allEvidence.map((ev: any, idx: number) => (
                                  <div key={ev.id || idx} className="relative group/ev overflow-hidden rounded-sm border border-white/5 bg-black">
                                     <div className="aspect-video">
                                        {ev.type?.includes('video') ? (
                                           <div className="w-full h-full flex flex-col items-center justify-center bg-white/[0.02]">
                                              <PlayCircle className="w-8 h-8 text-white/20 mb-2" />
                                              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Video Stream Ready</p>
                                           </div>
                                        ) : (
                                           <SafeImage src={ev.url} alt="Evidence" className="w-full h-full object-cover" />
                                        )}
                                     </div>
                                     <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/ev:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center">
                                        <p className="text-[9px] text-white font-black uppercase tracking-widest mb-2">
                                           {ev.type?.includes('video') ? 'Stream Tactical Video' : 'Expand Image'}
                                        </p>
                                        <a 
                                          href={ev.url} 
                                          target="_blank" 
                                          className="px-3 py-1.5 bg-red-500 text-black text-[8px] font-black uppercase tracking-widest rounded-sm hover:scale-105 transition-all"
                                        >
                                          Examine Source
                                        </a>
                                     </div>
                                     <div className="p-2 border-t border-white/5 flex items-center justify-between bg-black/40">
                                        <div className="flex items-center gap-1.5">
                                           <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                                           <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">
                                              {match.players[ev.uid]?.username || "System Override"}
                                           </p>
                                        </div>
                                        <div className="flex items-center gap-1 text-[7px] text-gray-600 font-bold uppercase">
                                           {ev.type?.includes('video') ? <PlayCircle className="w-2 h-2" /> : <LucideImage className="w-2 h-2" />}
                                           {ev.type?.split('/')[1]?.toUpperCase() || "DATA"}
                                        </div>
                                     </div>
                                  </div>
                               ))}
                            </div>
                         )}
                      </div>

                      {/* Action Bar */}
                      <div className="p-4 flex items-center gap-3 bg-white/[0.01]">
                        <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mr-auto">Strategic Decision:</p>
                        
                        <button
                          onClick={() => handleResolve(match.id, "REFUND", "VOID")}
                          className="px-4 py-2 bg-black border border-white/10 text-gray-500 hover:border-yellow-500/50 hover:text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-2"
                        >
                          <XCircle className="w-3 h-3" /> Void & Refund
                        </button>

                        {players.map((player: any) => (
                          <button
                            key={player.uid}
                            onClick={() => handleResolve(match.id, player.uid, player.username)}
                            disabled={resolving === match.id}
                            className="px-4 py-2 bg-black border border-white/10 text-white hover:border-accent hover:text-accent text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-2 disabled:opacity-50"
                          >
                            {resolving === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            Winner: {player.username}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === "search" && (
          <div className="p-6">
             <div className="flex gap-3 mb-8">
                <div className="flex-1 relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                  <input 
                    type="text" 
                    value={searchQuery} 
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    placeholder="Search operators by username or UID..." 
                    className="w-full bg-black border border-white/10 focus:border-accent text-white pl-12 pr-4 py-3 text-sm font-bold rounded-sm outline-none transition-all placeholder-gray-700" 
                  />
                </div>
                <button onClick={handleSearch} className="px-6 py-3 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-accent/20 transition-all flex items-center gap-2">
                   <Search className="w-4 h-4" /> Execute Scan
                </button>
             </div>

             <div className="space-y-2">
                {searchResults.map((u: any) => (
                  <div key={u.id} className="p-4 bg-black border border-white/5 rounded-sm flex items-center justify-between group hover:border-accent/30 transition-all">
                     <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-sm border border-white/10 flex items-center justify-center shrink-0">
                           <Users className="w-5 h-5 text-gray-600 group-hover:text-accent transition-colors" />
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                             <p className="text-white font-black text-sm uppercase italic">{u.username}</p>
                             <span className="text-[7px] font-black px-1.5 py-0.5 rounded-sm border border-white/10 text-gray-500 uppercase tracking-widest">
                                {u.role || (u.isAdmin ? 'ADMIN' : 'USER')}
                             </span>
                           </div>
                           <p className="text-[9px] text-gray-600 font-mono tracking-widest">{u.uid}</p>
                        </div>
                     </div>
                     
                     <div className="flex items-center gap-2">
                        <button 
                           onClick={() => { setSelectedUser(u); handleViewAudit(u.uid); }}
                           className="px-4 py-2 bg-white/5 text-white text-[9px] font-black uppercase tracking-widest rounded-sm hover:bg-white/10 transition-all"
                        >
                           Examine Profile
                        </button>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === "super" && isSuperAdmin && (
           <div className="p-6">
              <div className="flex items-center justify-between mb-8">
                 <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter mb-1">Staff Security & Recovery</h2>
                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Emergency PIN Overrides & Oversight</p>
                 </div>
                 <button 
                    onClick={async () => {
                       const idToken = await user?.getIdToken();
                       if (idToken) {
                         const res = await getStaffListAction(idToken);
                         if (res.success) setStaffList(res.staff || []);
                       }
                    }}
                    className="text-[9px] font-black uppercase tracking-widest text-accent hover:text-white flex items-center gap-2"
                 >
                    <RotateCcw className="w-3 h-3" /> Force Sync
                 </button>
              </div>

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
                         className="w-full py-2 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 text-red-500 text-[8px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                       >
                         <Lock className="w-3 h-3" /> Purge Security PIN
                       </button>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </div>

      {/* 🛡️ Intelligence Terminal (User Profile & Audit) */}
      {selectedUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 animate-in fade-in duration-200">
           <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={() => { setSelectedUser(null); setAuditData([]); }} />
           
           <div className="relative w-full max-w-2xl bg-surface border border-surface-border rounded-sm shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-6 bg-black border-b border-surface-border flex justify-between items-start">
                 <div className="flex items-center gap-4">
                    <div className="w-16 h-16 bg-accent/10 border border-accent/20 rounded-sm flex items-center justify-center text-accent">
                       <Users className="w-8 h-8" />
                    </div>
                    <div>
                       <div className="flex items-center gap-3 mb-1">
                          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">{selectedUser.username}</h2>
                          <span className="text-[9px] font-black px-2 py-0.5 bg-accent/10 border border-accent/20 text-accent uppercase tracking-widest rounded-sm">
                             {selectedUser.role || (selectedUser.isAdmin ? 'ADMIN' : 'USER')}
                          </span>
                       </div>
                       <p className="text-[10px] text-gray-500 font-mono tracking-widest uppercase">Clearance ID: {selectedUser.uid}</p>
                       <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                          <History className="w-3 h-3 inline mr-1" /> Induction: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString() : 'N/A'}
                       </p>
                    </div>
                 </div>
                 <button 
                   onClick={() => { setSelectedUser(null); setAuditData([]); }}
                   className="text-gray-500 hover:text-white p-2 bg-white/5 rounded-sm transition-all"
                 >
                   <XCircle className="w-5 h-5" />
                 </button>
              </div>

              {/* Intelligence Feed */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                 <div className="flex items-center justify-between mb-4">
                    <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-2">
                       <Terminal className="w-3.5 h-3.5" /> Operative Audit Feed
                    </h3>
                    <span className="text-[9px] text-gray-700 font-bold uppercase tracking-widest">
                       {auditData.length} records retrieved
                    </span>
                 </div>

                 {auditData.length === 0 ? (
                    <div className="py-20 text-center border border-dashed border-white/5 rounded-sm">
                       <Loader2 className="w-6 h-6 text-gray-800 animate-spin mx-auto mb-3" />
                       <p className="text-gray-600 text-[9px] font-black uppercase tracking-widest">Extracting intelligence logs...</p>
                    </div>
                 ) : (
                    <div className="space-y-3">
                       {auditData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((log, idx) => (
                          <div key={log.id || idx} className="p-4 bg-black/40 border border-white/5 rounded-sm group hover:border-accent/20 transition-all">
                             <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                   <div className={`w-1.5 h-1.5 rounded-full ${
                                      log.type === 'MATCH' ? (log.isWinner ? 'bg-accent' : 'bg-red-500') :
                                      log.type === 'FINANCE_ADJUST' ? 'bg-blue-500' : 'bg-yellow-500'
                                   }`} />
                                   <p className="text-[10px] text-white font-black uppercase italic tracking-wider">
                                      {log.type === 'MATCH' ? `${log.game} Match: ${log.isWinner ? 'Victory' : 'Defeat'}` :
                                       log.type === 'FINANCE_ADJUST' ? 'Balance Adjustment' : 'Withdrawal Request'}
                                   </p>
                                </div>
                                <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                                   {new Date(log.createdAt).toLocaleString()}
                                </span>
                             </div>
                             
                             <div className="grid grid-cols-3 gap-4">
                                <div>
                                   <p className="text-[7px] text-gray-600 font-black uppercase tracking-widest mb-0.5">Reference</p>
                                   <p className="text-[9px] text-gray-400 font-mono">#{log.id.slice(0, 8)}</p>
                                </div>
                                <div>
                                   <p className="text-[7px] text-gray-600 font-black uppercase tracking-widest mb-0.5">Value</p>
                                   <p className={`text-[10px] font-black ${log.isWinner || log.fee > 0 ? 'text-accent' : 'text-red-500'}`}>
                                      {log.isWinner || log.fee > 0 ? '+' : ''}{log.fee || log.reward} CR
                                   </p>
                                </div>
                                <div>
                                   <p className="text-[7px] text-gray-600 font-black uppercase tracking-widest mb-0.5">Status/Details</p>
                                   <p className="text-[9px] text-gray-400 font-bold uppercase truncate">{log.claim || log.status}</p>
                                </div>
                             </div>
                          </div>
                       ))}
                    </div>
                 )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 bg-black border-t border-surface-border flex justify-end gap-3">
                 <button 
                   onClick={() => { setSelectedUser(null); setAuditData([]); }}
                   className="px-6 py-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
                 >
                   Close Terminal
                 </button>
                 {isSuperAdmin && (
                   <button 
                     onClick={() => {
                        handleSetRole(selectedUser.uid, selectedUser.role === 'MODERATOR' ? 'USER' : 'MODERATOR');
                        setSelectedUser(null);
                        setAuditData([]);
                     }}
                     className="px-6 py-2 bg-accent/10 border border-accent/20 text-accent text-[10px] font-black uppercase tracking-widest rounded-sm hover:bg-accent/20 transition-all"
                   >
                     Toggle Moderator Status
                   </button>
                 )}
              </div>
           </div>
        </div>
      )}

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