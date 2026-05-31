"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  getAllActiveMatchesAction,
  getExpiredMatchesAction,
  adminRunExpiredMatchSweepAction,
  adminResolveExpiredMatchAction,
  adminResolveMatchWithPinAction,
  adminForceCloseMatchAction,
  adminDeleteMatchAction,
  adminDeleteCircuitByIdAction,
} from "@/app/actions/admin-actions";
import AdminPinTerminal from "@/components/admin/AdminPinTerminal";
import { useCommandModal } from "@/context/CommandModalContext";
import {
  Loader2,
  RefreshCw,
  Swords,
  ShieldAlert,
  Shield,
  Trash2,
  XCircle,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  CheckCircle2,
  Trophy,
  Zap,
} from "lucide-react";

type ActiveMatch = {
  id: string;
  status: string;
  game: string;
  format: string;
  round?: string;
  leg?: number;
  circuitId?: string;
  leagueId?: string;
  challengeFee: number;
  playerIds: string[];
  players: Record<string, any>;
  createdAt?: string;
  expiresAt?: string;
};

const STATUS_COLORS: Record<string, string> = {
  WAITING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  READY: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  IN_PROGRESS: "bg-accent/10 text-accent border-accent/20",
  RESOLVING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  WAITING_FOR_OPPONENT: "bg-orange-500/10 text-orange-400 border-orange-500/20",
  DISPUTED: "bg-red-500/10 text-red-400 border-red-500/20",
};

function MatchRow({
  match,
  onForceClose,
  onDelete,
  onResolveExpired,
  onAwardWin,
  loading,
}: {
  match: ActiveMatch;
  onForceClose: (id: string) => void;
  onDelete: (id: string, withCircuit: boolean) => void;
  onResolveExpired?: (id: string) => void;
  onAwardWin?: (matchId: string, winnerUid: string, winnerLabel: string) => void;
  loading: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isProcessing = loading === match.id;
  const playerNames = Object.values(match.players)
    .map((p: any) => p.username || p.uid?.slice(0, 8))
    .join(" vs ");

  const isExpired = match.expiresAt ? new Date(match.expiresAt).getTime() <= Date.now() : false;
  const canAwardWin = ['WAITING_FOR_OPPONENT', 'RESOLVING'].includes(match.status);

  return (
    <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden hover:border-white/10 transition-all">
      {/* Match Header Row */}
      <div
        className="flex items-center justify-between gap-4 p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4 min-w-0 flex-1">
          {/* Status badge */}
          <span
            className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm border whitespace-nowrap ${
              STATUS_COLORS[match.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
            }`}
          >
            {match.status.replace(/_/g, " ")}
          </span>

          {/* Players */}
          <div className="min-w-0">
            <p className="text-[11px] font-black text-white uppercase italic tracking-tighter truncate">
              {playerNames}
            </p>
            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-0.5">
              {match.game} · {match.format}
              {match.round && match.round !== "NONE" ? ` · ${match.round}` : ""}
              {match.leg ? ` Leg ${match.leg}` : ""}
              {match.circuitId && (
                <span className="ml-2 text-accent/60">⚡ Circuit</span>
              )}
              {match.leagueId && (
                <span className="ml-2 text-blue-400/60">🏆 League</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Fee */}
          <span className="text-[10px] font-black text-gray-500 italic hidden md:block">
            {match.challengeFee} CR
          </span>
          {/* Match ID */}
          <span className="text-[8px] font-mono text-gray-700 hidden lg:block">
            #{match.id.slice(-8).toUpperCase()}
          </span>
          {/* Expand toggle */}
          {expanded ? (
            <ChevronUp className="w-3 h-3 text-gray-600" />
          ) : (
            <ChevronDown className="w-3 h-3 text-gray-600" />
          )}
        </div>
      </div>

      {/* Expanded Action Panel */}
      {expanded && (
        <div className="border-t border-white/5 p-4 bg-black/40 space-y-4">
          {/* Player detail */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(match.players).map(([uid, p]: any) => (
              <div
                key={uid}
                className="p-3 border border-white/5 bg-white/5 rounded-sm space-y-1"
              >
                <p className="text-[9px] font-black text-white uppercase italic truncate">
                  {p.username || "Unknown"}
                </p>
                <p className="text-[8px] font-mono text-gray-600 truncate">{uid.slice(0, 16)}…</p>
                <div className="flex items-center gap-2 flex-wrap">
                  {p.claim && (
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded-sm ${p.claim === 'WIN' ? 'bg-accent/20 text-accent' : 'bg-red-500/20 text-red-400'}`}>
                      Claimed: {p.claim}
                    </span>
                  )}
                  {p.scoreFor !== undefined && (
                    <span className="text-[7px] font-mono text-gray-400">
                      {p.scoreFor}-{p.scoreAgainst}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Match metadata */}
          <div className="flex flex-wrap gap-4 text-[8px] font-mono text-gray-600">
            <span>ID: {match.id}</span>
            {match.circuitId && <span>Circuit: {match.circuitId.slice(0, 16)}…</span>}
            {match.leagueId && <span>League: {match.leagueId.slice(0, 16)}…</span>}
            {match.createdAt && <span>Created: {new Date(match.createdAt).toLocaleString()}</span>}
            {match.expiresAt && <span>Expires: {new Date(match.expiresAt).toLocaleString()}</span>}
            {isExpired && <span className="text-[8px] uppercase font-black text-red-400">EXPIRED</span>}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5">
            {/* Run expiry resolution */}
            {isExpired && onResolveExpired && (
              <button
                id={`resolve-expired-${match.id}`}
                onClick={() => onResolveExpired(match.id)}
                disabled={!!loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 hover:bg-blue-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
              >
                {loading === match.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Shield className="w-3 h-3" />
                )}
                Resolve Expired
              </button>
            )}

            {canAwardWin && onAwardWin && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(match.players).map(([uid, player]: [string, any]) => (
                  <button
                    key={uid}
                    id={`award-win-${match.id}-${uid}`}
                    onClick={() => onAwardWin(match.id, uid, player.username || uid)}
                    disabled={!!loading}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3 h-3" />
                    )}
                    Award Win to {player.username || uid}
                  </button>
                ))}
              </div>
            )}

            {/* Force close */}
            <button
              id={`force-close-${match.id}`}
              onClick={() => onForceClose(match.id)}
              disabled={!!loading}
              className="flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 text-orange-400 hover:bg-orange-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <XCircle className="w-3 h-3" />
              )}
              Force Close
            </button>

            {/* Delete this match only */}
            <button
              id={`delete-match-${match.id}`}
              onClick={() => onDelete(match.id, false)}
              disabled={!!loading}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
            >
              {isProcessing ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Trash2 className="w-3 h-3" />
              )}
              Delete Match
            </button>

            {/* Nuke entire circuit matches */}
            {match.circuitId && (
              <button
                id={`nuke-circuit-${match.id}`}
                onClick={() => onDelete(match.id, true)}
                disabled={!!loading}
                className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
              >
                {isProcessing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <ShieldAlert className="w-3 h-3" />
                )}
                Nuke All Circuit Matches
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminMatchesPage() {
  const { user } = useAuth();
  const command = useCommandModal();
  const [matches, setMatches] = useState<ActiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterType, setFilterType] = useState("ALL");
  const [manualNukeId, setManualNukeId] = useState("");
  const [viewMode, setViewMode] = useState<'active' | 'expired'>('active');
  const [sweepLoading, setSweepLoading] = useState(false);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [pendingAward, setPendingAward] = useState<{ matchId: string; winnerUid: string; winnerLabel: string } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchMatches = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const idToken = await user.getIdToken();
      const res = viewMode === 'expired'
        ? await getExpiredMatchesAction(idToken)
        : await getAllActiveMatchesAction(idToken);
      if (res.success) {
        setMatches((res.matches as ActiveMatch[]) || []);
      } else {
        setError(res.error || "Failed to fetch matches.");
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user, viewMode]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  const handleForceClose = async (matchId: string) => {
    command.confirm({
      title: "FORCE CLOSE MATCH",
      message: `Authorize immediate closure of match #${matchId.slice(-8).toUpperCase()}? No payout will be triggered. This is a destructive action.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setActionLoading(matchId);
        const idToken = await user.getIdToken();
        const res = await adminForceCloseMatchAction(idToken, matchId);
        if (res.success) {
          showToast("Match force-closed.", true);
          setMatches(prev => prev.filter(m => m.id !== matchId));
        } else {
          showToast(res.error || "Failed.", false);
        }
        setActionLoading(null);
      }
    });
  };

  const handleDelete = async (matchId: string, withCircuit: boolean) => {
    const label = withCircuit ? "ALL CIRCUIT MATCHES (including sub-legs)" : `match #${matchId.slice(-8).toUpperCase()}`;
    command.confirm({
      title: "PERMANENT DELETION",
      message: `Permanently erase ${label}? This operation cannot be undone and will be logged in the tactical audit feed.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setActionLoading(matchId);
        const idToken = await user.getIdToken();
        const res = await adminDeleteMatchAction(idToken, matchId, withCircuit);
        if (res.success) {
          showToast(`Deleted ${(res as any).deletedCount} match(es).`, true);
          await fetchMatches(); // refresh since multiple could be gone
        } else {
          showToast((res as any).error || "Failed.", false);
        }
        setActionLoading(null);
      }
    });
  };

  const handleRunExpiredSweep = async () => {
    if (!user) return;
    command.confirm({
      title: "RUN EXPIRED MATCH SWEEP",
      message: "Execute the expired match sweep now? This will apply extraction rules to expired matches in the database.",
      variant: 'warning',
      onConfirm: async () => {
        setSweepLoading(true);
        try {
          const idToken = await user.getIdToken();
          const res = await adminRunExpiredMatchSweepAction(idToken, 200);
          if (res.success) {
            showToast(`Sweep completed. ${res.result?.processed || 0} matches processed.`, true);
            await fetchMatches();
          } else {
            showToast(res.error || "Sweep failed.", false);
          }
        } catch (err: any) {
          showToast(err.message || "Sweep failed.", false);
        } finally {
          setSweepLoading(false);
        }
      }
    });
  };

  const handleResolveExpired = async (matchId: string) => {
    if (!user) return;
    command.confirm({
      title: "RESOLVE EXPIRED MATCH",
      message: `Apply automatic expiry resolution to match #${matchId.slice(-8).toUpperCase()}?`,
      variant: 'warning',
      onConfirm: async () => {
        setActionLoading(matchId);
        try {
          const idToken = await user.getIdToken();
          const res = await adminResolveExpiredMatchAction(idToken, matchId);
          if (res.success) {
            showToast("Expired match resolved.", true);
            await fetchMatches();
          } else {
            showToast(res.error || "Failed to resolve.", false);
          }
        } catch (err: any) {
          showToast(err.message || "Failed to resolve.", false);
        } finally {
          setActionLoading(null);
        }
      }
    });
  };

  const handleAwardWin = (matchId: string, winnerUid: string, winnerLabel: string) => {
    setPendingAward({ matchId, winnerUid, winnerLabel });
    setPinError(null);
    setIsPinModalOpen(true);
  };

  const executeAwardWin = async (pin: string) => {
    if (!user || !pendingAward) return;
    setActionLoading(pendingAward.matchId);
    setPinError(null);
    try {
      const idToken = await user.getIdToken();
      const res = await adminResolveMatchWithPinAction(idToken, pendingAward.matchId, pendingAward.winnerUid, pin);
      if (res.success) {
        showToast(`Awarded win to ${pendingAward.winnerLabel}.`, true);
        setIsPinModalOpen(false);
        setPendingAward(null);
        await fetchMatches();
      } else {
        setPinError(res.error || "Failed to award win.");
      }
    } catch (err: any) {
      setPinError(err.message || "Failed to award win.");
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualNuke = async () => {
    if (!manualNukeId.trim()) return;
    command.confirm({
      title: "EXECUTE NUCLEAR PURGE",
      message: `Authorize permanent erasure of circuit/league ${manualNukeId}? ALL associated match data, scoring, and history will be wiped from the grid.`,
      variant: 'danger',
      onConfirm: async () => {
        if (!user) return;
        setActionLoading("manual-nuke");
        const idToken = await user.getIdToken();
        const res = await adminDeleteCircuitByIdAction(idToken, manualNukeId.trim());
        
        if (res.success) {
          showToast(`Successfully nuked Circuit ${manualNukeId}.`, true);
          setManualNukeId("");
        } else {
          showToast(res.error || "Failed to delete.", false);
        }
        setActionLoading(null);
      }
    });
  };

  // Filter logic
  const filtered = matches.filter(m => {
    const nameMatch = search
      ? Object.values(m.players).some((p: any) =>
          p.username?.toLowerCase().includes(search.toLowerCase())
        ) || m.id.toLowerCase().includes(search.toLowerCase())
      : true;
    const statusMatch = filterStatus === "ALL" || m.status === filterStatus;
    const typeMatch =
      filterType === "ALL" ||
      (filterType === "CIRCUIT" && !!m.circuitId) ||
      (filterType === "LEAGUE" && !!m.leagueId) ||
      (filterType === "CASUAL" && !m.circuitId && !m.leagueId);
    return nameMatch && statusMatch && typeMatch;
  });

  // Group by circuitId for visual organization
  const circuitGroups: Record<string, ActiveMatch[]> = {};
  const standaloneMatches: ActiveMatch[] = [];
  filtered.forEach(m => {
    if (m.circuitId) {
      if (!circuitGroups[m.circuitId]) circuitGroups[m.circuitId] = [];
      circuitGroups[m.circuitId].push(m);
    } else {
      standaloneMatches.push(m);
    }
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mb-1">
            Admin Command Center
          </p>
          <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter flex items-center gap-3">
            <Swords className="w-8 h-8 text-red-400" />
            Match Control Panel
          </h1>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">
            {matches.length} mission(s) in view
          </p>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            id="view-mode-toggle"
            onClick={() => setViewMode(prev => prev === 'active' ? 'expired' : 'active')}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-3 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
          >
            {viewMode === 'active' ? 'Show Expired Matches' : 'Show Active Matches'}
          </button>
          <button
            id="run-expired-sweep"
            onClick={handleRunExpiredSweep}
            disabled={loading || sweepLoading}
            className="flex items-center gap-2 px-4 py-3 bg-accent/10 border border-accent/20 hover:border-accent/30 text-accent rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
          >
            {sweepLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
            Sweep Expired Now
          </button>
          <button
            id="refresh-matches"
            onClick={fetchMatches}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 hover:border-white/20 text-white rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Refresh Feed
          </button>
        </div>
      </div>

      <AdminPinTerminal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingAward(null);
          setPinError(null);
        }}
        onSuccess={executeAwardWin}
        title={pendingAward ? `Confirm Award Win to ${pendingAward.winnerLabel}` : "Confirm Identity"}
        error={pinError}
      />

      {/* Toast */}
      {toast && (
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-sm border text-[10px] font-black uppercase tracking-widest animate-in slide-in-from-top-2 ${
            toast.ok
              ? "bg-accent/10 border-accent/30 text-accent"
              : "bg-red-500/10 border-red-500/30 text-red-400"
          }`}
        >
          {toast.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertTriangle className="w-4 h-4 shrink-0" />
          )}
          {toast.msg}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-white/[0.02] border border-white/5 rounded-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-600" />
          <input
            id="match-search"
            type="text"
            placeholder="Search by player name or match ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-black border border-white/10 focus:border-accent text-white py-2 pl-8 pr-4 rounded-sm outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-gray-700 placeholder:normal-case"
          />
        </div>

        <select
          id="filter-status"
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-black border border-white/10 text-white py-2 px-3 rounded-sm text-[10px] font-black uppercase tracking-widest outline-none"
        >
          <option value="ALL">All Statuses</option>
          <option value="WAITING">Waiting</option>
          <option value="READY">Ready</option>
          <option value="IN_PROGRESS">In Progress</option>
          <option value="WAITING_FOR_OPPONENT">Waiting for Opponent</option>
          <option value="RESOLVING">Resolving</option>
          <option value="DISPUTED">Disputed</option>
        </select>

        <select
          id="filter-type"
          value={filterType}
          onChange={e => setFilterType(e.target.value)}
          className="bg-black border border-white/10 text-white py-2 px-3 rounded-sm text-[10px] font-black uppercase tracking-widest outline-none"
        >
          <option value="ALL">All Types</option>
          <option value="CIRCUIT">Circuit Only</option>
          <option value="LEAGUE">League Only</option>
          <option value="CASUAL">Casual Only</option>
        </select>
      </div>

      {/* Manual Nuke Tool */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-red-500/5 border border-red-500/20 rounded-sm">
        <ShieldAlert className="w-4 h-4 text-red-500" />
        <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">Manual Purge:</span>
        <input
          type="text"
          placeholder="Paste Circuit / League ID to Nuke..."
          value={manualNukeId}
          onChange={e => setManualNukeId(e.target.value)}
          className="flex-1 bg-black border border-red-500/20 focus:border-red-500 text-white py-2 px-3 rounded-sm outline-none text-[10px] font-bold uppercase tracking-widest placeholder:text-red-500/40"
        />
        <button
          onClick={handleManualNuke}
          disabled={!manualNukeId.trim() || !!actionLoading}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 border border-red-700/40 text-red-300 hover:bg-red-900/50 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-30"
        >
          {actionLoading === "manual-nuke" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
          Nuke Document
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-sm text-red-400 text-[10px] font-black uppercase tracking-widest">
          <AlertTriangle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-accent animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <CheckCircle2 className="w-12 h-12 text-accent/30" />
          <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest italic">
            No active missions detected. All sectors clear.
          </p>
        </div>
      )}

      {/* Circuit Groups */}
      {!loading && Object.entries(circuitGroups).length > 0 && (
        <div className="space-y-6">
          {Object.entries(circuitGroups).map(([circuitId, circuitMatches]) => (
            <div key={circuitId} className="space-y-2">
              {/* Circuit header */}
              <div className="flex items-center gap-3 pb-2 border-b border-white/5">
                <Zap className="w-3 h-3 text-accent" />
                <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">
                  Circuit Sector
                </span>
                <span className="text-[9px] font-mono text-gray-600">
                  {circuitId.slice(0, 20)}…
                </span>
                <span className="text-[9px] text-gray-600">
                  ({circuitMatches.length} match{circuitMatches.length !== 1 ? 'es' : ''})
                </span>
              </div>
              <div className="space-y-2 pl-4 border-l border-accent/10">
                {circuitMatches.map(m => (
                  <MatchRow
                    key={m.id}
                    match={m}
                    onForceClose={handleForceClose}
                    onDelete={handleDelete}
                    onResolveExpired={handleResolveExpired}
                    onAwardWin={handleAwardWin}
                    loading={actionLoading}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Standalone / Casual Matches */}
      {!loading && standaloneMatches.length > 0 && (
        <div className="space-y-2">
          {Object.keys(circuitGroups).length > 0 && (
            <div className="flex items-center gap-3 pb-2 border-b border-white/5">
              <Trophy className="w-3 h-3 text-gray-500" />
              <span className="text-[10px] font-black text-gray-500 uppercase tracking-[0.3em]">
                Standalone / Casual Matches
              </span>
              <span className="text-[9px] text-gray-600">({standaloneMatches.length})</span>
            </div>
          )}
          {standaloneMatches.map(m => (
            <MatchRow
              key={m.id}
              match={m}
              onForceClose={handleForceClose}
              onDelete={handleDelete}
              onResolveExpired={handleResolveExpired}
              onAwardWin={handleAwardWin}
              loading={actionLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}
