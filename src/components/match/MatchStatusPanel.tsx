"use client";
import React, { useState } from 'react';
import { Match, setReadyStatus, keepWaiting, respondToHostRole, executeMatchClosure, updateRoomCode } from "@/lib/match-service";
import { adminResolveMatchAction, pingOpponentAction } from "@/app/actions/match-actions";
import { useAuth } from "@/components/auth/AuthProvider";
import { 
  UserCheck, UserX, Copy, Loader2, CheckCircle2, 
  Clock, Flame, ShieldAlert, Server, Shield,
  Gavel, Trophy,
  Zap, Lock, Activity, Crown,
} from "lucide-react";

import { useToast } from "@/context/ToastContext";
import SubmitResultModal from "./SubmitResultModal";
import DisputeModal from "./DisputeModal";
import RulesModal from "./RulesModal";

interface MatchStatusPanelProps {
  match: Match;
  currentUserUid?: string;
  isCircuit?: boolean;
}

export default function MatchStatusPanel({ match, currentUserUid }: MatchStatusPanelProps) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [isSubmitOpen, setSubmitOpen] = useState(false);
  const [isDisputeOpen, setDisputeOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [roomCode, setRoomCode] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  const hasGhostOpponent = match?.players ? Object.values(match.players).some(p => p.username === 'GHOST' && p.uid !== currentUserUid) : false;
  const isDisputed = match?.status === 'DISPUTED';
  const isTournamentOrLeague = (match.format === 'tournament' || match.format === 'league' || !!match.circuitId || !!match.leagueId);

  React.useEffect(() => {
    const hasReadyTimer = (match as any)?.readyDeadline && !['CLOSED', 'COMPLETED', 'IN_PROGRESS'].includes(match.status);
    const hasResolutionTimer = !hasReadyTimer && (match?.status === 'RESOLVING' || match?.status === 'WAITING_FOR_OPPONENT') && match?.resolutionEndTime;
    const hasExtractionTimer = match?.expiresAt && !['CLOSED', 'COMPLETED', 'SCHEDULED'].includes(match.status) && !isDisputed;
    // Always show the 24-hour room deadline for league/tournament/circuit matches when expiresAt exists
    const showExtractionTimerAlways = isTournamentOrLeague && !!match?.expiresAt && !['CLOSED', 'COMPLETED', 'SCHEDULED'].includes(match.status);

    if (!hasReadyTimer && !hasResolutionTimer && !hasExtractionTimer && !showExtractionTimerAlways) {
      setTimerSeconds(null);
      return;
    }

    const extractDate = (val: any) => {
      if (!val) return null;
      if (typeof val.toDate === 'function') return val.toDate();
      if (val.seconds) return new Date(val.seconds * 1000);
      return new Date(val);
    };

    const targetTimeSrc = isResolutionTimer
      ? match.resolutionEndTime
      : hasReadyTimer
        ? (match as any).readyDeadline
        : match.expiresAt;
    const dateObj = extractDate(targetTimeSrc);
    if (!dateObj) {
      setTimerSeconds(null);
      return;
    }
    const targetTime = dateObj.getTime();
    
    const updateTimer = async () => {
      const now = Date.now();
      const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
      setTimerSeconds(diff);

      if (diff <= 0 && hasResolutionTimer) {
        if (currentUserUid && match.players[currentUserUid] && !loading && user) {
          try {
            setLoading(true);
            const idToken = await user.getIdToken();
            await executeMatchClosure(idToken, match.id!);
          } catch (err) {
            console.error("Auto-closure failed:", err);
          } finally {
            setLoading(false);
          }
        }
      }
    };
    updateTimer();
    const intv = setInterval(updateTimer, 1000);
    return () => clearInterval(intv);
  }, [match?.status, match?.resolutionEndTime, match?.expiresAt, (match as any)?.readyDeadline, currentUserUid, user]);
  React.useEffect(() => {
    if (timerSeconds !== 0 || match?.status === 'CLOSED' || match?.status === 'COMPLETED') return;

    // GHOST MATCH: Auto-claim immediately at t=0, no button, no delay
    if (hasGhostOpponent && currentUserUid && match.players[currentUserUid] && user && match.id) {
      const autoClaimGhost = async () => {
        if (loading) return;
        setLoading(true);
        try {
          const idToken = await user.getIdToken();
          const { claimTechnicalWinAction } = await import("@/app/actions/match-actions");
          const res = await claimTechnicalWinAction(idToken, match.id!);
          if (res.success) {
            toast.success("TOURNAMENT VICTORY", "You advance — Ghost opponent auto-eliminated.");
            setTimeout(() => { window.location.href = "/dashboard"; }, 2000);
          } else {
            console.warn("[Ghost Auto-Claim]", (res as any).error);
          }
        } catch (err: any) {
          console.error("Ghost auto-claim failed:", err);
        } finally {
          setLoading(false);
        }
      };
      autoClaimGhost();
      return;
    }

    // STANDARD: Wait 20 seconds after expiry then auto-resolve
    const timeout = setTimeout(async () => {
      if (!match.id || !user || loading) return;
      const allPlayers = Object.values(match.players);
      const readyCount = allPlayers.filter(p => p.ready).length;
      const claimCount = allPlayers.filter(p => (p as any).claim).length;
      const me = match.players[currentUserUid || ''];
      const myReady = me?.ready;

      try {
        setLoading(true);
        const idToken = await user.getIdToken();
        if (myReady && readyCount === 1) {
          const { claimTechnicalWinAction } = await import("@/app/actions/match-actions");
          await claimTechnicalWinAction(idToken, match.id!);
          toast.success("VICTORY SECURED", "Opponent forfeited by no-show (Auto-Resolved).");
        } else if (readyCount === 0 || (readyCount === allPlayers.length && claimCount === 0)) {
          const { applyExpirationExtractionAction } = await import("@/app/actions/match-actions");
          await applyExpirationExtractionAction(idToken, match.id!);
          toast.error("MUTUAL FORFEIT", "Extraction protocol initiated (Auto-Resolved).");
        } else {
          // If consensus hasn't been reached yet but we are timed out, we can't auto-resolve blindly.
          // The background listeners will handle any late incoming results.
        }
      } catch (err: any) {
        console.error("Auto-resolve failed", err);
      } finally {
        setLoading(false);
      }
    }, 20000); // 20 second grace window

    return () => clearTimeout(timeout);
  }, [timerSeconds, match?.status, match?.id, user, currentUserUid, loading, hasGhostOpponent]);


  // Auto-redirect ALL users when match closes
  React.useEffect(() => {
    if ((match?.status === 'CLOSED' || match?.status === 'COMPLETED') && currentUserUid && match.players[currentUserUid]) {
      const isGathering = (match.format === 'tournament' || match.format === 'league') && (match.maxPlayers || 2) > 2;
      
      const timer = setTimeout(() => {
        if (match.status === 'COMPLETED' && isGathering) {
           const targetId = match.circuitId || match.id;
           window.location.href = `/dashboard/tournaments/view/${targetId}`;
        } else {
           window.location.href = "/dashboard";
        }
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [match?.status, currentUserUid, match.players, match.format, match.maxPlayers, match.circuitId, match.id]);

  if (!match) return null;

  const me = match.players[currentUserUid || ''];
  const isPlayerInMatch = !!me;
  const isStaff = profile?.role === 'MODERATOR' || profile?.role === 'ADMIN' || !!profile?.isAdmin;
  const isMonitoring = isStaff && !isPlayerInMatch;
  const isReady = me?.ready || false;
  const isHostCandidate = (me?.isHostCandidate || false) && !match.hostUid;
  const isHost = match?.hostUid === currentUserUid;
  const isCreator = (match as any)?.creatorId === currentUserUid;
  const allPlayers = Object.values(match.players);
  const targetPlayers = match.maxPlayers || 2;
  const isGatheringLobby = (match.format === 'tournament' || match.format === 'league') && (match.maxPlayers || 2) > 2;
  const readyCount = allPlayers.filter(p => p.ready).length;
  const hasReadyDeadline = !!(match as any).readyDeadline;
  const isFinalTimeout = timerSeconds !== null && timerSeconds <= 0;
  const showAwaitingOpponentReadyText = hasReadyDeadline && readyCount === 1 && !isFinalTimeout;

  // Check if current user is facing a ghost opponent (in tournament finals)

  const handleHostResponse = async (action: 'ACCEPT' | 'PASS') => {
    if (!currentUserUid || !match.id || !user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      await respondToHostRole(idToken, match.id, action);
    } catch (err: any) {
      toast.error("Host Protocol Error", err.message || "Action failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleReadyUp = async () => {
    if (!currentUserUid || !match.id || !user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      await setReadyStatus(idToken, match.id, !isReady);
    } catch (err: any) {
      toast.error("Deployment Error", err.message || "Ready up failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = (textToCopy: string) => {
    if (!textToCopy) return;
    navigator.clipboard.writeText(textToCopy);
    toast.success("CODE COPIED", "Credentials saved to clipboard.");
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  };

  const handleBroadcastCode = async () => {
    if (!currentUserUid || !match.id || !user || !roomCode) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      await updateRoomCode(idToken, match.id, roomCode);
      toast.success("MISSION UPLINK ACTIVE", "Room credentials have been broadcast to all deployed operatives.");
    } catch (err: any) {
      toast.error("Transmission Failure", err.message || "Broadcast failed.");
    } finally {
      setLoading(false);
    }
  };

  const step1Done = !['WAITING'].includes(match.status);
  const step2Done = ['IN_PROGRESS', 'COMPLETED', 'DISPUTED'].includes(match.status);
  const step3Done = ['COMPLETED', 'DISPUTED'].includes(match.status);

  const trackerSteps = [
    { id: 'waiting', label: 'Lobby Formation', sub: step1Done ? 'Deployment Complete' : `${allPlayers.length}/${targetPlayers} operators`, active: match.status === 'WAITING', done: step1Done },
    { id: 'host', label: 'Host Assigned', sub: match.hostUid ? 'Host confirmed — share room code' : match.status === 'READY' ? 'Awaiting host acceptance...' : 'Pending room fill', active: match.status === 'READY' && !match.hostUid, done: step2Done || !!match.hostUid },
    { id: 'progress', label: 'Match In Progress', sub: 'Recording gameplay...', active: match.status === 'IN_PROGRESS', done: step3Done },
    { id: 'completed', label: 'Resolution', sub: match.status === 'DISPUTED' ? 'Tribunal Investigation Active' : match.status === 'RESOLVING' || match.status === 'WAITING_FOR_OPPONENT' ? 'Countdown active...' : match.status === 'CLOSED' ? 'Match Finalized' : 'Awaiting result upload', active: ['COMPLETED', 'DISPUTED', 'RESOLVING', 'WAITING_FOR_OPPONENT'].includes(match.status), done: match.status === 'CLOSED' },
  ];

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const isResolutionTimer = (match?.status === 'RESOLVING' || match?.status === 'WAITING_FOR_OPPONENT') && match?.resolutionEndTime;
  const isUrgent = timerSeconds !== null && timerSeconds < 3600; // Under 1 hour

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Tactical Header: Round & Group Info */}
      {match.circuitId && (
        <div className="bg-black border-l-4 border-accent p-4 rounded-sm mb-2 flex justify-between items-center">
           <div>
              <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mb-1">Combat Theater</div>
              <h3 className="text-white font-black uppercase italic tracking-tighter text-lg">
              {match.round !== 'NONE' ? (match.format === 'league' ? `LEAGUE • ROUND ${(match as any).roundNumber || 1}` : match.round) : 'GROUP PHASE'} 
              {match.group && match.group !== 'NONE' && ` • SECTOR ${match.group}`}
              </h3>
           </div>
           {match.leg !== 'NONE' && (
             <div className="bg-accent/10 border border-accent/20 px-3 py-1 rounded-[2px]">
                <span className="text-accent text-[10px] font-black uppercase tracking-widest">Leg {match.leg}</span>
             </div>
           )}
        </div>
      )}

      {/* Absolute Victory Directive (Circuit Only) */}
      {match.circuitId && (
        <div className="bg-accent/10 border-2 border-accent/40 p-4 rounded-sm animate-in zoom-in duration-500 shadow-[0_0_20px_rgba(0,255,102,0.1)]">
           <div className="flex items-center gap-3 mb-2">
              <Zap className="w-5 h-5 text-accent animate-pulse" />
              <h3 className="text-accent font-black uppercase tracking-widest text-xs italic">Absolute Victory Directive</h3>
           </div>
           <p className="text-[10px] text-gray-300 font-bold uppercase leading-relaxed tracking-tight">
              Tactical Requirement: <span className="text-white">Extra Time & Penalties MUST be enabled</span> in settings. 
              Combat stalamates are prohibited. In the case of network issues in game and the game decides a winner without the match completion, the winner given by the game should register 1-0, but if the two players agree for a replay, a replay should happen.
           </p>
        </div>
      )}
      {isMonitoring && (
        <div className="bg-red-500/10 border-2 border-red-500/30 p-5 rounded-sm shadow-[0_0_30px_rgba(239,68,68,0.15)] animate-in fade-in slide-in-from-top-4">
          <div className="flex items-center gap-3 mb-2">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <h3 className="text-red-500 font-black uppercase tracking-tighter text-xl italic">Watchtower Active</h3>
          </div>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
            Staff identification verified. You are monitoring this combat session with full oversight permissions.
          </p>
        </div>
      )}

      {match.status === 'DISPUTED' && (
        <div className="bg-red-600 border-2 border-red-400 p-5 rounded-sm shadow-[0_0_40px_rgba(220,38,38,0.3)] animate-pulse mb-6">
          <div className="flex items-center gap-3 mb-2">
            <Gavel className="w-6 h-6 text-white" />
            <h3 className="text-white font-black uppercase tracking-tighter text-xl italic">Arena Frozen: Match Disputed</h3>
          </div>
          <p className="text-[11px] text-white font-bold uppercase tracking-widest leading-relaxed">
            A conflict in results has been detected or a manual dispute was filed. This match is now under **Tribunal Review**. All funds are safe but locked until Command delivers a verdict.
          </p>
        </div>
      )}

      {isHostCandidate && (
        <div className="bg-accent border-2 border-accent p-5 rounded-sm shadow-[0_0_30px_rgba(0,255,102,0.3)] animate-in fade-in zoom-in-95">
          <div className="flex items-center gap-3 mb-3">
            <Server className="w-6 h-6 text-black" />
            <h3 className="text-black font-black uppercase tracking-tighter text-xl italic">Host Designation</h3>
          </div>
          <p className="text-[11px] text-black font-bold uppercase leading-relaxed mb-4">
            You have been nominated to host the {match.game} match room. 
            Accept this role to proceed.
          </p>
          <div className="flex gap-2">
            <button onClick={() => handleHostResponse('PASS')} disabled={loading} className="flex-1 bg-black/20 hover:bg-black/30 text-black border border-black/20 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all">
              <UserX className="w-3 h-3" /> Pass Role
            </button>
            <button onClick={() => handleHostResponse('ACCEPT')} disabled={loading} className="flex-1 bg-black text-accent py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-black/80 transition-all">
              {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <><UserCheck className="w-3 h-3" /> Accept</>}
            </button>
          </div>
        </div>
      )}

      {isHost && (match.status === 'READY' || match.status === 'IN_PROGRESS') && !isGatheringLobby && (
        <div className="bg-white p-5 rounded-sm shadow-2xl animate-in slide-in-from-top-4 border-l-4 border-accent">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-black font-black tracking-tighter uppercase text-lg italic">Uplink Console</h3>
            <span className={`text-[8px] font-black px-2 py-1 rounded-full uppercase tracking-widest ${match.roomCode ? 'bg-accent text-black animate-pulse' : 'bg-black text-white'}`}>
              {match.roomCode ? 'Broadcast Active' : 'Offline'}
            </span>
          </div>
          <h4 className="text-sm font-black uppercase text-black mb-1">Broadcast Room Credentials</h4>
          <p className="text-[10px] text-black/50 mb-4 font-bold uppercase tracking-tight">Enter your {match.game} room code to sync with all operatives.</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Paste Game ID..." 
                value={roomCode} 
                onChange={(e) => setRoomCode(e.target.value)} 
                className="flex-1 bg-gray-100 border-2 border-transparent focus:border-accent outline-none px-4 py-3 rounded-sm text-sm font-black text-black placeholder:text-gray-400 transition-all font-mono" 
              />
              <button 
                onClick={() => handleCopyCode(match.roomCode || roomCode)} 
                className={`px-4 py-3 rounded-sm transition-all shadow-lg ${codeCopied ? 'bg-accent text-black' : 'bg-black text-accent'}`}
              >
                {codeCopied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <button 
              disabled={loading || !roomCode}
              onClick={handleBroadcastCode}
              className="w-full bg-black text-accent hover:bg-accent hover:text-black py-4 rounded-sm text-xs font-black uppercase tracking-[0.2em] transition-all shadow-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-accent" /> : <><Flame className="w-4 h-4" /> BROADCAST TO ARENA</>}
            </button>
          </div>
        </div>
      )}

      {/* Player Room Code View */}
      {!isHost && !isHostCandidate && match.hostUid && (match.status === 'READY' || match.status === 'IN_PROGRESS') && !isGatheringLobby && (
        <>
          {match.roomCode ? (
            <div className="bg-accent border-2 border-accent p-5 rounded-sm shadow-[0_0_40px_rgba(0,255,102,0.2)] animate-in zoom-in-95">
              <div className="flex items-center justify-between mb-4">
                 <div className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-black" />
                    <h3 className="text-black font-black uppercase tracking-tighter text-lg italic tracking-wider">Uplink Established</h3>
                 </div>
                 <span className="text-[8px] bg-black text-accent px-2 py-0.5 rounded-full font-black uppercase">Encrypted Link</span>
              </div>
              
              <div className="bg-black/90 p-4 rounded-sm flex items-center justify-between border border-black/20 mb-3 group">
                 <span className="text-2xl font-mono font-black text-accent tracking-[.25em] pl-2 drop-shadow-[0_0_10px_rgba(0,255,102,0.5)]">
                    {match.roomCode}
                 </span>
                 <button 
                   onClick={() => handleCopyCode(match.roomCode!)}
                   className={`p-3 rounded-sm transition-all ${codeCopied ? 'bg-accent text-black' : 'bg-white/10 text-white hover:bg-accent hover:text-black'}`}
                 >
                    {codeCopied ? <CheckCircle2 className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                 </button>
              </div>
              
              <p className="text-[10px] text-black font-bold uppercase tracking-widest text-center">
                 Copy this code and join the lobby in **{match.game}** immediately.
              </p>
            </div>
          ) : (
            <div className="bg-surface border border-surface-border p-4 rounded-sm flex items-center gap-4">
              <Loader2 className="w-5 h-5 text-accent animate-spin shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-black text-white uppercase tracking-widest">Awaiting Room Code</p>
                <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">The host is establishing a secure match entry point.</p>
              </div>
            </div>
          )}
        </>
      )}

      <div className="bg-surface border border-surface-border rounded-sm p-4 md:p-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-border pb-2 md:pb-3 mb-4 md:mb-5">
           <h4 className="text-xs font-black uppercase tracking-widest text-gray-300">Live Match Tracker</h4>
           <button
              onClick={() => {
                 const url = window.location.origin + `/dashboard?join=${match.id}`;
                 navigator.clipboard.writeText(url);
                 toast.success("INVITE LINK COPIED", "Share this URL with squad members to invite them to this mission.");
              }}
              className="text-[10px] font-black uppercase tracking-widest text-accent hover:text-white flex items-center gap-1 transition-colors"
           >
              <Copy className="w-3 h-3" /> Share Mission
           </button>
        </div>
        <div className="space-y-3.5 md:space-y-5">
          {trackerSteps.map((step) => (
            <div key={step.id} className={`flex items-start gap-2.5 md:gap-3 transition-all duration-300 ${step.done || step.active ? 'opacity-100' : 'opacity-25'}`}>
              <div className={`w-4.5 h-4.5 md:w-5 md:h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${step.done ? 'bg-accent border-accent text-black' : step.active ? 'bg-accent/10 border-accent text-accent' : 'bg-black border-surface-border'}`}>
                {step.done ? (
                  <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                ) : step.active ? (
                  <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                ) : null}
              </div>
              <div>
                <div className={`text-[11px] md:text-xs font-black uppercase tracking-widest ${step.done ? 'text-accent' : step.active ? 'text-white' : 'text-gray-600'}`}>{step.label}</div>
                <div className="text-[9px] md:text-[10px] text-gray-500 uppercase tracking-widest font-mono mt-0.5">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {['IN_PROGRESS', 'RESOLVING', 'WAITING_FOR_OPPONENT', 'DISPUTED'].includes(match.status) && !isGatheringLobby && (
        <div className="bg-surface border border-surface-border rounded-sm p-4">
          <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3">Data Uplink Status</h4>
          <div className="space-y-3">
            {Object.entries(match.players).map(([uid, p], idx) => {
               const hasClaimed = !!(p as any).claim;
               const isMe = uid === currentUserUid;
               return (
                 <div key={uid} className="flex items-center justify-between border-b border-surface-border/50 pb-2 last:border-0 last:pb-0">
                   <span className={`text-xs font-black uppercase italic ${isMe ? 'text-accent' : 'text-white'}`}>{p.username} {isMe && '(You)'}</span>
                   <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm ${hasClaimed ? (isMe ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20') : 'bg-surface-hover text-gray-500 border border-surface-border'}`}>
                     {hasClaimed ? (isMe ? 'DATA UPLOADED' : 'OPPONENT HAS SUBMITTED - URGENT') : 'AWAITING UPLOAD'}
                   </span>
                 </div>
               );
            })}
          </div>
        </div>
      )}

      {/* Tournament/League Rules Info (for gathering lobbies) */}
      {isTournamentOrLeague && (
        <div className="bg-blue-950/30 border border-blue-500/40 p-4 rounded-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 text-xs font-black uppercase tracking-widest">Tournament Rules & Regulations</span>
          </div>
          <button
            onClick={() => setIsRulesOpen(true)}
            className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-500/60 text-blue-400 font-black uppercase tracking-widest text-[10px] rounded-sm transition-all"
          >
            View Rules
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {(match.status === 'WAITING' || match.status === 'READY') && isPlayerInMatch && !hasGhostOpponent && (() => {
           // Distinguish: main gathering lobby (12/16 players) vs spawned 2-player circuit duel
           
           if (isGatheringLobby) {
              // GATHERING LOBBY: Any player can deploy once room is full
              if (allPlayers.length >= targetPlayers) {
                 // Room is full - allow any player to deploy
                 return (
                    <button 
                      onClick={handleReadyUp} 
                      disabled={loading} 
                      className="w-full font-black uppercase tracking-widest py-5 rounded-sm text-sm shadow-xl transition-all flex items-center justify-center gap-2 group bg-accent hover:bg-accent-hover text-black hover:-translate-y-0.5"
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>DEPLOY BRACKETS & START <Flame className="w-5 h-5" /></>}
                    </button>
                 );
              }
              
              // Room not full yet
              if (isHost || isCreator) {
                 return (
                    <button 
                      onClick={handleReadyUp} 
                      disabled={loading || allPlayers.length < targetPlayers} 
                      className={`w-full font-black uppercase tracking-widest py-5 rounded-sm text-sm shadow-xl transition-all flex items-center justify-center gap-2 group ${allPlayers.length >= targetPlayers ? 'bg-accent hover:bg-accent-hover text-black hover:-translate-y-0.5' : 'bg-surface-hover text-gray-500 border border-surface-border cursor-not-allowed'}`}
                    >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                         allPlayers.length >= targetPlayers ? <>DEPLOY BRACKETS & START <Flame className="w-5 h-5" /></> : `AWAITING OPERATIVES (${allPlayers.length}/${targetPlayers})`
                      )}
                    </button>
                 );
              } else {
                 return (
                    <div className="bg-surface-hover border border-surface-border p-5 rounded-sm text-center">
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1 italic">Awaiting Tournament Deployment</p>
                       <p className="text-xs font-black text-white uppercase tracking-tighter italic">
                         {allPlayers.length}/{targetPlayers} Operatives assembled. Awaiting Host deployment command.
                       </p>
                    </div>
                 );
              }
           }
           
           // INDIVIDUAL DUEL (1v1 circuit match, or regular 1v1): Show READY UP
           return (
              <button 
                onClick={handleReadyUp} 
                disabled={loading} 
                className={`w-full font-black uppercase tracking-widest py-5 rounded-sm text-sm shadow-xl transition-all flex items-center justify-center gap-2 group ${isReady ? 'bg-surface border-2 border-accent text-accent hover:bg-accent/5' : 'bg-accent hover:bg-accent-hover text-black hover:-translate-y-0.5'}`}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{isReady ? <><CheckCircle2 className="w-5 h-5" /> READY — Click to Unready</> : <>READY UP <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>}</>}
              </button>
           );
        })()}
        {hasGhostOpponent && match.status !== 'CLOSED' && match.status !== 'COMPLETED' && (
          <div className="bg-accent/10 border-2 border-accent p-5 rounded-sm shadow-[0_0_30px_rgba(0,255,102,0.15)] animate-in fade-in zoom-in">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="w-5 h-5 text-accent" />
              <h3 className="text-accent font-black uppercase tracking-tighter text-lg italic">Auto-Victory Pending</h3>
            </div>
            <p className="text-[10px] text-gray-300 font-bold uppercase leading-relaxed tracking-tight">
              Your opponent is a Ghost placeholder. You will be awarded the victory automatically when the countdown reaches zero — no action required.
            </p>
          </div>
        )}

        {(() => {
           const targetId = (match as any).circuitId || (match as any).leagueId;
           if (isGatheringLobby && (match.status === 'IN_PROGRESS' || match.status === 'CLOSED' || match.status === 'COMPLETED')) {
              return (
                 <div className="bg-accent/10 border-2 border-accent text-center p-8 rounded-sm shadow-[0_0_30px_rgba(0,255,102,0.2)] animate-in zoom-in">
                    <h3 className="text-2xl font-black italic uppercase tracking-tighter text-accent mb-2">Tournament Deployed</h3>
                    <p className="text-xs font-bold uppercase text-white/70 tracking-widest leading-relaxed mb-6">
                      The gathering phase has concluded and fixtures are generated. Everyone remains here until they choose to enter the War Room to view group standings and assignments.
                    </p>
                    <button 
                       onClick={() => targetId && window.open(`/dashboard/tournaments/view/${targetId}`, '_self')}
                       disabled={!targetId}
                       className={`w-full font-black uppercase tracking-widest py-4 rounded-sm transition-all ${targetId ? 'bg-accent text-black hover:-translate-y-1' : 'bg-surface-hover text-gray-500 cursor-not-allowed'}`}
                    >
                       Enter Command Hub
                    </button>
                 </div>
              );
           }
           if (match.status === 'CLOSED' || match.status === 'COMPLETED') {
              const winnerUid = (match as any).championUid;
              const isWinner = winnerUid === currentUserUid;
              const isDraw = !winnerUid && Object.values(match.players).every(p => (p as any).claim === 'DRAW');
              
              return (
                 <div className="bg-black/80 backdrop-blur-xl border-2 border-white/10 p-10 rounded-sm text-center animate-in zoom-in duration-500 shadow-2xl">
                   {isDraw ? (
                     <div className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/40 rotate-45 flex items-center justify-center mx-auto mb-8">
                        <Activity className="w-10 h-10 text-yellow-500 -rotate-45" />
                     </div>
                   ) : isWinner ? (
                     <div className="w-20 h-20 bg-accent/10 border border-accent/40 rotate-45 flex items-center justify-center mx-auto mb-8 shadow-[0_0_50px_rgba(0,255,102,0.2)]">
                        <Trophy className="w-10 h-10 text-accent -rotate-45" />
                     </div>
                   ) : (
                     <div className="w-20 h-20 bg-red-500/10 border border-red-500/40 rotate-45 flex items-center justify-center mx-auto mb-8">
                        <ShieldAlert className="w-10 h-10 text-red-500 -rotate-45" />
                     </div>
                   )}

                   <h3 className={`text-4xl font-black italic uppercase tracking-tighter mb-2 ${isDraw ? 'text-yellow-500' : isWinner ? 'text-accent' : 'text-red-500'}`}>
                     {isDraw ? 'CONSENSUS DRAW' : isWinner ? 'MISSION SECURED' : 'OPERATION FAILED'}
                   </h3>
                   <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.3em] mb-6">
                     Intelligence: Match {match.status} // Tactical Outcome Recorded
                   </p>

                   {match.format === 'league' && (match as any).circuitId && (
                      <div className="mb-8 p-4 bg-white/5 border border-white/5 rounded-sm max-w-md mx-auto">
                         <h4 className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-3 italic">Final Division Podium</h4>
                         <div className="flex justify-center items-end gap-2">
                            {/* RANK 2 */}
                            <div className="flex flex-col items-center gap-1">
                               <div className="w-12 h-1 bg-white/10 rounded-full mb-1" />
                               <div className="text-[8px] font-bold text-gray-400 uppercase truncate max-w-[60px]">2ND</div>
                            </div>
                            {/* RANK 1 */}
                            <div className="flex flex-col items-center gap-1 scale-110 px-4">
                               <Crown className="w-4 h-4 text-accent mb-1 animate-bounce" />
                               <div className="text-[10px] font-black text-accent uppercase truncate max-w-[80px]">CHAMPION</div>
                            </div>
                            {/* RANK 3 */}
                            <div className="flex flex-col items-center gap-1">
                               <div className="w-12 h-1 bg-white/10 rounded-full mb-1" />
                               <div className="text-[8px] font-bold text-gray-400 uppercase truncate max-w-[60px]">3RD</div>
                            </div>
                         </div>
                         <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-4">
                            Visit the League Hub for the full tactical standings.
                         </p>
                      </div>
                   )}
                   
                   <button 
                     onClick={() => window.location.href = '/dashboard'}
                     className="px-8 py-4 bg-white/5 border border-white/10 hover:bg-white/10 text-white font-black uppercase tracking-widest text-[10px] rounded-sm transition-all"
                   >
                     Return to Command Base
                   </button>
                 </div>
              );
           }
           if (match.status === 'SCHEDULED') {
              return (
                 <div className="bg-black/60 backdrop-blur-md border-2 border-white/5 p-8 rounded-sm text-center animate-in zoom-in">
                   <Lock className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-50" />
                   <h3 className="text-xl font-black text-white italic uppercase tracking-widest mb-2">Sector Locked</h3>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                      You have advanced to this sector. Operation will commence automatically once all current round matches are secured. Stay in the comms channel to strategize.
                   </p>
                 </div>
              );
           }
           return null;
        })()}


        {!isGatheringLobby && (isResolutionTimer || (timerSeconds !== null && !['CLOSED', 'COMPLETED', 'SCHEDULED'].includes(match.status))) && (
          <div className={`${(match.status === 'WAITING_FOR_OPPONENT' || isUrgent) ? 'bg-red-950 border-red-500 shadow-[0_0_30px_rgba(220,38,38,0.2)]' : 'bg-black border-accent shadow-[0_0_30px_rgba(0,255,102,0.15)]'} border-2 p-6 rounded-sm flex flex-col items-center justify-center text-center relative overflow-hidden group animate-in fade-in zoom-in`}>
            {isUrgent && <div className="absolute inset-0 bg-red-600/5 animate-pulse pointer-events-none" />}
            
            <h4 className={`text-[10px] ${ (match.status === 'WAITING_FOR_OPPONENT' || isUrgent || hasReadyDeadline) ? 'text-red-500' : 'text-accent'} font-black uppercase tracking-[0.3em] mb-4 flex items-center gap-2 z-10`}>
              <Flame className={`w-4 h-4 ${(match.status === 'WAITING_FOR_OPPONENT' || isUrgent || hasReadyDeadline) ? 'text-red-500' : 'text-accent'} animate-pulse`} /> 
              {isDisputed 
                ? 'EXTRACTION HALTED'
                : isResolutionTimer 
                  ? (match.status === 'WAITING_FOR_OPPONENT' ? 'Final Validation Countdown' : 'Strict Forfeit Timer')
                  : showAwaitingOpponentReadyText
                    ? 'Awaiting opponent to ready'
                    : hasReadyDeadline
                      ? 'Tactical Readiness Deadline'
                      : (hasGhostOpponent ? 'AUTO-VICTORY COUNTDOWN' : '24-Hour Room Deadline')}
            </h4>

            {showAwaitingOpponentReadyText ? (
              <div className="text-2xl font-black text-white italic tracking-tighter z-10">
                Awaiting opponent to ready
              </div>
            ) : (
              <div className={`text-6xl font-black ${(match.status === 'WAITING_FOR_OPPONENT' || isUrgent || hasReadyDeadline) ? 'text-red-400 drop-shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'text-white drop-shadow-[0_0_10px_rgba(0,255,102,0.4)]'} italic tracking-tighter tabular-nums z-10`}>
                {timerSeconds !== null ? formatTime(timerSeconds) : '--'}
              </div>
            )}

            {!isResolutionTimer && (
              <div className="mt-4 z-10 w-full relative">
                 {timerSeconds === 0 ? (
                    (() => {
                       const readyCount = allPlayers.filter(p => p.ready).length;
                       const claimCount = allPlayers.filter(p => (p as any).claim).length;
                       const myReady = (me as any)?.ready;

                       const hasReadyDeadline = !!(match as any).readyDeadline;
                       if (myReady && readyCount === 1) {
                          return (
                             <div className="space-y-3">
                               <button
                                 disabled={loading}
                                 onClick={async () => {
                                    if (!match.id || !user) return;
                                    setLoading(true);
                                    try {
                                       const { claimTechnicalWinAction } = await import("@/app/actions/match-actions");
                                       const idToken = await user.getIdToken();
                                       const res = await claimTechnicalWinAction(idToken, match.id);
                                       if (res.success) {
                                          toast.success("VICTORY SECURED", "Opponent forfeited by no-show.");
                                          setTimeout(() => { window.location.href = "/dashboard"; }, 1000);
                                       } else {
                                          toast.error("Error", (res as any).error);
                                       }
                                    } catch (e: any) { toast.error("Error", e.message); }
                                    finally { setLoading(false); }
                                 }}
                                 className="w-full bg-accent text-black p-3 text-[10px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-transform"
                               >
                                  Claim Technical Win (No-Show)
                               </button>
                               {hasReadyDeadline && (
                                 <button
                                   disabled={loading}
                                   onClick={async () => {
                                      if (!match.id || !user) return;
                                      setLoading(true);
                                      try {
                                         const idToken = await user.getIdToken();
                                         await keepWaiting(idToken, match.id);
                                         toast.success("Grace granted", "Room will continue until normal expiry.");
                                      } catch (e: any) {
                                         toast.error("Error", e.message || "Failed to continue waiting.");
                                      } finally {
                                         setLoading(false);
                                      }
                                   }}
                                   className="w-full bg-black border border-accent text-accent p-3 text-[10px] font-black uppercase tracking-widest hover:bg-accent/5 transition-transform"
                                 >
                                    Keep Waiting for Opponent
                                 </button>
                               )}
                             </div>
                          );
                       } else if (readyCount === 0 || (readyCount === allPlayers.length && claimCount === 0)) {
                          return (
                             <button
                               disabled={loading}
                               onClick={async () => {
                                  if (!match.id || !user) return;
                                  setLoading(true);
                                  try {
                                     const { applyExpirationExtractionAction } = await import("@/app/actions/match-actions");
                                     const idToken = await user.getIdToken();
                                     const res = await applyExpirationExtractionAction(idToken, match.id);
                                     if (res.success) window.location.href = "/dashboard";
                                     else toast.error("Error", (res as any).error);
                                  } catch (e: any) { toast.error("Error", e.message); }
                                  finally { setLoading(false); }
                               }}
                               className="w-full bg-red-600 text-white p-3 text-[10px] font-black uppercase tracking-widest hover:-translate-y-0.5 transition-transform shadow-[0_0_15px_rgba(220,38,38,0.3)]"
                             >
                                Acknowledge Mutual Forfeit
                             </button>
                          );
                       }
                       return (
                          <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                            Extraction window closed. Awaiting HQ intervention.
                          </p>
                       );
                    })()
                 ) : (
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                      Action required: Mission must be completed and results uploaded before extraction.
                    </p>
                 )}
              </div>
            )}
          </div>
        )}

        {['IN_PROGRESS', 'RESOLVING', 'WAITING_FOR_OPPONENT'].includes(match.status) && isPlayerInMatch && !hasGhostOpponent && (!isGatheringLobby || (match as any).isPromo || match.format === 'br') && (
           <>
              {(me as any)?.claim ? (
                <div className="flex flex-col gap-2 w-full">
                  <div className="bg-surface-hover border border-surface-border text-gray-500 font-bold uppercase tracking-widest py-5 rounded-sm text-[10px] flex items-center justify-center gap-2 cursor-not-allowed">
                    <CheckCircle2 className="w-5 h-5 text-accent" />
                    Data Uploaded: {(me as any).claim}
                  </div>
                  <button 
                    onClick={() => setSubmitOpen(true)} 
                    className="w-full bg-black border border-surface-border text-xs font-black text-gray-400 py-3 rounded-sm uppercase tracking-widest hover:text-white transition-all"
                  >
                    Recalibrate / Edit Result
                  </button>
                </div>
              ) : (
                <button onClick={() => setSubmitOpen(true)} className={`${match.status === 'WAITING_FOR_OPPONENT' ? 'bg-red-600 hover:bg-red-500 shadow-[0_0_20px_rgba(220,38,38,0.4)]' : 'bg-accent hover:bg-accent-hover shadow-[0_0_20px_rgba(0,255,102,0.2)]'} w-full text-black font-black uppercase tracking-widest py-5 rounded-sm text-sm transition-all hover:-translate-y-1 flex items-center justify-center gap-2 group`}>
                  {match.status === 'WAITING_FOR_OPPONENT' ? 'URGENT: Submit Result Now' : 'Submit Match Result'}
                </button>
              )}
           </>
        )}

        {(match.status === 'IN_PROGRESS' || match.status === 'WAITING' || match.status === 'READY' || match.status === 'RESOLVING' || match.status === 'WAITING_FOR_OPPONENT') && isPlayerInMatch && !isGatheringLobby && (
          <div className="space-y-3">
             <button 
               onClick={async () => {
                 if (!user || loading) return;
                 setLoading(true);
                 try {
                    const idToken = await user.getIdToken();
                    const res = await pingOpponentAction(idToken, match.id!);
                    if (res.success) {
                       toast.success("TACTICAL PING SENT", "Opponent notified of your presence.");
                    } else {
                       toast.error("Ping Failed", (res as any).error || "Cooldown active.");
                    }
                 } catch (e) {
                    console.error(e);
                 } finally {
                    setLoading(false);
                 }
               }}
               disabled={loading}
               className="w-full bg-accent/5 border border-accent/20 hover:border-accent hover:bg-accent/10 text-accent font-black uppercase tracking-widest py-3 rounded-sm text-[10px] transition-all flex items-center justify-center gap-2 group"
             >
                <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
                Ping Opponent
             </button>
             
             <button onClick={() => setDisputeOpen(true)} className="w-full bg-black border border-surface-border text-gray-500 hover:border-red-500/50 hover:text-red-500 font-bold uppercase tracking-widest py-4 rounded-sm text-xs transition-colors shadow-lg flex items-center justify-center gap-2">
               Dispute / Report
             </button>
          </div>
        )}

      </div>

      <SubmitResultModal 
        isOpen={isSubmitOpen} 
        onClose={() => setSubmitOpen(false)} 
        matchId={match.id || ""} 
        uid={currentUserUid || ""} 
        inGameName={me?.inGameName}
        match={match}
        game={match.game}
      />
      <DisputeModal isOpen={isDisputeOpen} onClose={() => setDisputeOpen(false)} matchId={match.id!} username={profile?.username || "Operator"} />
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} game={match.game} format={match.format} />
    </div>
  );
}
