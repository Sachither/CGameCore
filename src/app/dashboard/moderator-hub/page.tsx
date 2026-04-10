"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { getDisputedMatchesAction, getUserAuditHistoryAction, searchUserAction, alertPlayersOfAdminPresence, setUserRoleAction, resolveDisputeAction } from "@/app/actions/admin-actions";
import { ShieldAlert, Search, AlertTriangle, History, BarChart3, Loader2, Users, BellRing, Settings, CheckCircle2, RotateCcw, Gavel, ExternalLink, ImageIcon, XCircle } from "lucide-react";
import { db } from "@/lib/firebase";
import SafeImage from "@/components/ui/SafeImage";
import Link from "next/link";

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

  // 🔒 Role hierarchy
  const isModerator = profile?.role === 'MODERATOR';
  const isAdmin = profile?.role === 'ADMIN' || profile?.isAdmin === true;
  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  // Check if user has ANY admin access
  const hasAnyAccess = isModerator || isAdmin || isSuperAdmin;
  const roleManageView = isSuperAdmin;

  // Check if user is authorized only once the live profile is loaded
  useEffect(() => {
    if (!loading && (!profile || !hasAnyAccess)) {
      router.push('/dashboard');
    }
  }, [profile, loading, router, hasAnyAccess]);

  // Reset tab if user doesn't have access to current tab based on role
  useEffect(() => {
    if (isModerator && (activeTab === 'admin' || activeTab === 'super')) {
      setActiveTab('disputes');
    }
    if (isAdmin && !isSuperAdmin && activeTab === 'super') {
      setActiveTab('disputes');
    }
  }, [profile?.role, activeTab, isModerator, isAdmin, isSuperAdmin]);

  // Load disputes
  useEffect(() => {
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

    if (activeTab === "disputes") {
      loadDisputes();
    }
  }, [activeTab, user]);

  // Handle user search
  const handleSearch = async () => {
    if (!searchQuery.trim() || !user) return;
    
    try {
      const idToken = await user.getIdToken();
      const result = await searchUserAction(idToken, searchQuery);
      if (result.success) {
        setSearchResults(result.users || []);
      }
    } catch (error) {
      console.error("Search failed:", error);
    }
  };

  // Load user audit data
  const handleViewAudit = async (uid: string) => {
    if (!user) return;
    
    try {
      const idToken = await user.getIdToken();
      const result = await getUserAuditHistoryAction(idToken, uid);
      if (result.success) {
        setAuditData(result.audit || []);
      }
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
      const result = await alertPlayersOfAdminPresence(idToken, matchId);
      if (result.success) {
        setAlertFeedback(`Alert sent for #${matchId.slice(0, 8)}`);
        setTimeout(() => setAlertFeedback(null), 3000);
      }
    } catch (error) {
      console.error("Alert failed:", error);
    } finally {
      setAlerting(null);
    }
  };

  const handleResolve = async (matchId: string, winnerId: string, winnerName: string) => {
    const label = winnerId === "REFUND" ? "Refund Both" : `Award Win to ${winnerName}`;
    if (!window.confirm(`Are you sure you want to ${label}?\n\nThis will instantly close the match and distribute credits.`)) {
      return;
    }

    if (!idToken) return;
    setResolving(matchId);
    try {
      const res = await resolveDisputeAction(idToken, matchId, winnerId);
      if (res.success) {
        setDisputes(prev => prev.filter(m => m.id !== matchId));
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setResolving(null);
    }
  };

  const handleSetUserRole = async (targetUid: string, role: any) => {
    if (!user) return;
    setRoleLoading(targetUid);
    try {
      const idToken = await user.getIdToken();
      const result = await setUserRoleAction(idToken, targetUid, role);
      if (result.success) {
        setAlertFeedback("User clearance level updated.");
        setTimeout(() => setAlertFeedback(null), 3000);
        // Refresh search results to show new role
        handleSearch();
      }
    } catch (error) {
      console.error("Role update failed:", error);
    } finally {
      setRoleLoading(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header - Role-specific title */}
      <div className="mb-8">
        <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em] mb-1">
          {isSuperAdmin ? 'System Control' : isAdmin ? 'Admin Center' : 'Staff Center'}
        </p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : 'Moderator'} <span className="text-accent">Hub</span>
        </h1>
        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest mt-1">
          {isSuperAdmin 
            ? 'System-wide control and monitoring' 
            : isAdmin 
            ? 'Manage users, finances, and disputes' 
            : 'Manage disputes and monitor activity'}
        </p>
      </div>

      {/* Tab Navigation - Role-specific tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/5 overflow-x-auto">
        {/* Available to all roles */}
        <button
          onClick={() => setActiveTab("disputes")}
          className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === "disputes"
              ? "text-accent border-accent"
              : "text-gray-500 border-transparent hover:text-main"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Disputes
          </div>
        </button>

        <button
          onClick={() => setActiveTab("search")}
          className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === "search"
              ? "text-accent border-accent"
              : "text-gray-500 border-transparent hover:text-main"
          }`}
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            Users
          </div>
        </button>

        {/* Admin-only */}
        {(isAdmin || isSuperAdmin) && (
          <button
            onClick={() => setActiveTab("admin")}
            className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "admin"
                ? "text-accent border-accent"
                : "text-gray-500 border-transparent hover:text-main"
            }`}
          >
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4" />
              Admin Tools
            </div>
          </button>
        )}

        {/* Super Admin-only */}
        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab("super")}
            className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
              activeTab === "super"
                ? "text-accent border-accent"
                : "text-gray-500 border-transparent hover:text-main"
            }`}
          >
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4" />
              System Control
            </div>
          </button>
        )}

        {/* Alerts - available to all */}
        <button
          onClick={() => setActiveTab("alerts")}
          className={`px-4 py-3 text-sm font-black uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${
            activeTab === "alerts"
              ? "text-accent border-accent"
              : "text-gray-500 border-transparent hover:text-main"
          }`}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            Alerts
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden">
        {/* Disputes Tab */}
        {activeTab === "disputes" && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                Active Disputes Requiring Review
              </p>
              {alertFeedback && (
                <div className="bg-green-500/10 text-green-400 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-sm border border-green-500/20 animate-in fade-in slide-in-from-top-1">
                  {alertFeedback}
                </div>
              )}
            </div>
            
            {dataLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-5 h-5 text-accent animate-spin" />
              </div>
            ) : disputes.length === 0 ? (
              <div className="text-center py-12">
                <ShieldAlert className="w-8 h-8 text-gray-700 mx-auto mb-3" />
                <p className="text-gray-600 text-sm">No active disputes</p>
              </div>
            ) : (
              <div className="space-y-3">
                {disputes.map((match: any) => {
                  const players = Object.values(match.players || {}).map((p: any, idx: number) => ({
                    ...p,
                    uid: Object.keys(match.players)[idx]
                  }));

                  return (
                    <div
                      key={match.id}
                      className="w-full text-left bg-black border border-white/5 rounded-sm overflow-hidden hover:border-accent/30 transition-all"
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
                          <Link
                            href={`/match/${match.id}`}
                            target="_blank"
                            className="text-[9px] px-3 py-1.5 bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 rounded-sm font-black uppercase tracking-widest transition-all flex items-center gap-2"
                          >
                            <ExternalLink className="w-3 h-3" /> Join Room
                          </Link>
                          <button 
                            onClick={(e) => handleAlertPlayers(e, match.id)}
                            disabled={alerting === match.id}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/10 rounded-sm transition-all group/btn"
                            title="Alert Players"
                          >
                            {alerting === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <BellRing className="w-3 h-3 group-hover/btn:scale-110 transition-transform" />}
                          </button>
                        </div>
                      </div>

                      {/* Content: Players & Evidence */}
                      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {players.map((p: any) => (
                          <div key={p.uid} className="bg-white/[0.03] border border-white/5 p-3 rounded-sm">
                            <div className="flex items-center justify-between mb-2">
                              <div>
                                <p className="text-white font-black text-xs italic uppercase">{p.username}</p>
                                <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-sm border inline-block mt-1 ${p.claim === "WIN" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                                  {p.claim || "No Claim"}
                                </span>
                              </div>
                              <button
                                onClick={() => handleResolve(match.id, p.uid, p.username)}
                                disabled={!!resolving}
                                className="px-3 py-1.5 bg-green-500/10 hover:bg-green-600 hover:text-white border border-green-500/40 text-green-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-1.5 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                              >
                                {resolving === match.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <><CheckCircle2 className="w-3 h-3" /> Award Win</>}
                              </button>
                            </div>

                            {/* Evidence Thumbnail */}
                            <div className="bg-black border border-white/5 rounded-sm aspect-video overflow-hidden relative group">
                              {p.proofUrl ? (
                                <>
                                  <SafeImage src={p.proofUrl} alt="Match Proof" className="w-full h-full object-cover" />
                                  <a href={p.proofUrl} target="_blank" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                    <ImageIcon className="w-4 h-4 text-white" />
                                  </a>
                                </>
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-700 text-[8px] font-black uppercase italic">No Proof Uploaded</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Bottom Bar: Action & Footer */}
                      <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Status: <span className="text-yellow-500">DISPUTED</span></p>
                          <span className="w-1 h-1 bg-gray-700 rounded-full"></span>
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">{match.format} · {match.challengeFee}CR</p>
                        </div>
                        <button
                          onClick={() => handleResolve(match.id, "REFUND", "Refund")}
                          disabled={!!resolving}
                          className="px-3 py-1.5 bg-white/5 hover:bg-yellow-500/20 border border-white/10 hover:border-yellow-500/30 text-gray-500 hover:text-yellow-500 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center gap-1.5"
                        >
                          <RotateCcw className="w-3 h-3" /> Void Match
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Search Tab */}
        {activeTab === "search" && (
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
              Search Users by Username or UID
            </p>
            
            <div className="mb-6">
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Enter username or UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="flex-1 bg-black border border-white/10 text-white px-4 py-2 rounded-sm text-sm focus:border-accent/50 outline-none"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-accent text-black font-black rounded-sm hover:bg-accent/80 transition-all"
                >
                  Search
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((user: any) => (
                    <div
                      key={user.id}
                      className="p-3 bg-black border border-white/5 rounded-sm flex items-between justify-between hover:border-accent/30 transition-all"
                    >
                      <div>
                        <p className="text-white font-bold text-sm">{user.username}</p>
                        <p className="text-[9px] text-gray-600">{user.email} <span className="text-accent uppercase font-black ml-1">[{user.role || (user.isAdmin ? 'ADMIN' : 'USER')}]</span></p>
                      </div>
                      <div className="flex items-center gap-2">
                        {roleManageView && isSuperAdmin && (
                          <select 
                            className="text-[9px] bg-black border border-white/20 text-white p-1 rounded-sm outline-none w-24 uppercase font-bold"
                            value={user.role || (user.isAdmin ? 'ADMIN' : 'USER')}
                            disabled={roleLoading === user.id}
                            onChange={(e) => handleSetUserRole(user.id, e.target.value as any)}
                          >
                            <option value="USER">USER</option>
                            <option value="MODERATOR">MODERATOR</option>
                            <option value="ADMIN">ADMIN</option>
                            <option value="SUPER_ADMIN">SUPER ADMIN</option>
                          </select>
                        )}
                        <button
                          onClick={() => handleViewAudit(user.id)}
                          className="px-3 py-1 text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-sm hover:bg-blue-500/20 transition-all font-black"
                        >
                          View Audit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {auditData.length > 0 && (
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">
                  Audit History
                </p>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {auditData.map((log: any) => (
                    <div key={log.id} className="p-2 bg-black border border-white/5 rounded-sm text-[9px]">
                      <p className="text-gray-400">{log.type} · {new Date(log.createdAt || 0).toLocaleDateString()}</p>
                      <p className="text-white font-bold mt-1">{log.game || 'System Event'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === "alerts" && (
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
              Platform Monitoring
            </p>
            
            <div className="space-y-3">
              <div className="p-4 bg-black border border-yellow-500/20 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <p className="text-yellow-500 font-black text-sm">Dispute Activity</p>
                </div>
                <p className="text-[9px] text-gray-600">Currently {disputes.length} active disputes pending review</p>
              </div>

              <div className="p-4 bg-black border border-white/5 rounded-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-accent" />
                  <p className="text-accent font-black text-sm">System Health</p>
                </div>
                <p className="text-[9px] text-gray-600">All systems operational</p>
              </div>

              {(isAdmin || isSuperAdmin) && (
                <div className="p-4 bg-black border border-blue-500/20 rounded-sm">
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart3 className="w-4 h-4 text-blue-400" />
                    <p className="text-blue-400 font-black text-sm">Admin Activity</p>
                  </div>
                  <p className="text-[9px] text-gray-600">All admin actions are logged and audited</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Admin-Only Tab */}
        {(isAdmin || isSuperAdmin) && activeTab === "admin" && (
          <div className="p-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4">
              {isSuperAdmin ? 'Super Admin Control Panel' : 'Admin Management Tools'}
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <a
                href="/admin/users"
                className="p-4 bg-black border border-white/5 rounded-sm hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-5 h-5 text-accent" />
                  <p className="font-black text-sm text-white">User Management</p>
                </div>
                <p className="text-[9px] text-gray-600">Ban, suspend, and manage user accounts</p>
              </a>

              <a
                href="/admin/treasury"
                className="p-4 bg-black border border-white/5 rounded-sm hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="w-5 h-5 text-accent" />
                  <p className="font-black text-sm text-white">Withdrawals</p>
                </div>
                <p className="text-[9px] text-gray-600">Approve/reject withdrawal requests</p>
              </a>

              <a
                href="/admin/disputes"
                className="p-4 bg-black border border-white/5 rounded-sm hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-5 h-5 text-accent" />
                  <p className="font-black text-sm text-white">Match Disputes</p>
                </div>
                <p className="text-[9px] text-gray-600">Resolve disputed matches</p>
              </a>

              <a
                href="/admin/messages"
                className="p-4 bg-black border border-white/5 rounded-sm hover:border-accent/30 hover:bg-accent/5 transition-all"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Search className="w-5 h-5 text-accent" />
                  <p className="font-black text-sm text-white">User Messages</p>
                </div>
                <p className="text-[9px] text-gray-600">View contact and support messages</p>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}