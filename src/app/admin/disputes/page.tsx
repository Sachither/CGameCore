"use client";
// [TACTICAL INTEGRITY CHECK: 1.1] Force Segment Refresh
import React, { useEffect, useState, useCallback, Suspense } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getDisputedMatchesAction, resolveDisputeAction, cancelStaleMatchAction, triggerAdminInterventionAction, getUserAuditHistoryAction, alertPlayersOfAdminPresence } from "@/app/actions/admin-actions";
import { Gavel, ImageIcon, AlertTriangle, CheckCircle2, XCircle, RotateCcw, Loader2, MessageSquare, ExternalLink, ShieldAlert, History, Terminal, UserSearch, BellRing } from "lucide-react";
import MatchChat from "@/components/match/MatchChat";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import SafeImage from "@/components/ui/SafeImage";

export default function AdminDisputesPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-24"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>}>
      <AdminDisputesContent />
    </Suspense>
  );
}

function AdminDisputesContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const matchId = searchParams.get('match');
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [resolving, setResolving] = useState(false);
  const [verdictModal, setVerdictModal] = useState<{ isOpen: boolean, winnerId: string, label: string } | null>(null);
  const [intervening, setIntervening] = useState<string | null>(null);
  const [interventionMsg, setInterventionMsg] = useState("Admin presence required in match room for identity verification.");
  const [feedback, setFeedback] = useState("");
  const [auditTarget, setAuditTarget] = useState<{ uid: string, username: string } | null>(null);
  const [auditData, setAuditData] = useState<any[]>([]);
  const [auditing, setAuditing] = useState(false);

  const fetchDisputes = useCallback(async () => {
    if (!user) return;
    const idToken = await user.getIdToken();
    const result = await getDisputedMatchesAction(idToken);
    if (result.success) setMatches(result.matches || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  useEffect(() => {
    if (matchId && matches.length > 0 && !selected) {
      const match = matches.find(m => m.id === matchId);
      if (match) setSelected(match);
    }
  }, [matchId, matches, selected]);

  const handleResolve = async (matchId: string, winnerId: string) => {
    if (!user) return;
    const label = winnerId === "REFUND" ? "void this match and refund both players" : "award the win to this player";
    setVerdictModal({ isOpen: true, winnerId, label });
  };

  const executeVerdict = async () => {
    if (!user || !selected || !verdictModal) return;
    
    setResolving(true);
    const idToken = await user.getIdToken();
    const result = await resolveDisputeAction(idToken, selected.id, verdictModal.winnerId);
    if (result.success) {
      setFeedback("Tribunal verdict delivered. Match funds distributed and arena closed.");
      setSelected(null);
      setVerdictModal(null);
      await fetchDisputes();
    } else {
      setFeedback(`Verdict Failed: ${result.error}`);
    }
    setResolving(false);
  };

  const handleIntervene = async (targetUid: string) => {
    if (!user || !selected || !interventionMsg.trim()) return;
    setIntervening(targetUid);
    const idToken = await user.getIdToken();
    const result = await triggerAdminInterventionAction(idToken, targetUid, selected.id, interventionMsg);
    if (result.success) {
      setFeedback("Intervention alert triggered boldly for the operator.");
    } else {
      setFeedback(`Intervention Failed: ${result.error}`);
    }
    setIntervening(null);
  };

  const handleAudit = async (uid: string, username: string) => {
    if (!user) return;
    setAuditTarget({ uid, username });
    setAuditing(true);
    const idToken = await user.getIdToken();
    const result = await getUserAuditHistoryAction(idToken, uid);
    if (result.success) {
      setAuditData(result.audit || []);
    } else {
      setFeedback(`Audit Failed: ${result.error}`);
    }
    setAuditing(false);
    setAuditing(false);
  };

  const handleAlertPlayers = async () => {
    if (!user || !selected) return;
    const idToken = await user.getIdToken();
    setFeedback("Transmitting alert signal...");
    const result = await alertPlayersOfAdminPresence(idToken, selected.id);
    if (result.success) {
      setFeedback("Admin presence alert dispatched to all players.");
    } else {
      setFeedback(`Alert Failed: ${result.error}`);
    }
  };

  const playerList = selected ? Object.values(selected.players || {}) : [];

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mb-1">Admin Command Center</p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Dispute <span className="text-red-400">Tribunal</span>
        </h1>
        <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest mt-1">
          Review contested match evidence and deliver verdicts
        </p>
      </div>

      {feedback && (
        <div className={`mb-6 px-4 py-3 rounded-sm border text-[10px] font-black uppercase tracking-widest ${feedback.startsWith("Error") ? "bg-red-500/10 border-red-500/30 text-red-400" : "bg-green-500/10 border-green-500/30 text-green-400"}`}>
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Left: Dispute Queue */}
        <div className="lg:col-span-2">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden sticky top-6">
            <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-black/40">
              <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center gap-2">
                <Gavel className="w-3.5 h-3.5 text-red-400" />
                Active Queue
              </h2>
              <span className="text-[9px] text-red-500 font-black bg-red-500/10 px-2 py-0.5 rounded-sm border border-red-500/20">
                {matches.length} pending
              </span>
            </div>

            <div className="max-h-[75vh] overflow-y-auto custom-scrollbar">
              {loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="w-5 h-5 text-gray-600 animate-spin" />
                </div>
              ) : matches.length === 0 ? (
                <div className="py-24 text-center">
                  <CheckCircle2 className="w-8 h-8 text-green-500/10 mx-auto mb-3" />
                  <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No active disputes</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {matches.map((m: any) => {
                    const players = Object.values(m.players || {}) as any[];
                    const isSelected = selected?.id === m.id;
                    return (
                      <button
                        key={m.id}
                        onClick={() => { setSelected(m); setFeedback(""); }}
                        className={`w-full text-left px-5 py-4 hover:bg-white/5 transition-all group ${isSelected ? "bg-red-500/10 border-l-4 border-red-500" : "border-l-4 border-transparent"}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 font-mono">
                               <p className="text-[9px] text-red-400 font-black uppercase tracking-widest">#{m.id?.slice(0, 8)}</p>
                               <span className="w-1 h-1 rounded-full bg-gray-700" />
                               <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                                 {new Date(m.createdAt).toLocaleDateString()}
                               </p>
                            </div>
                            <p className="text-white font-black text-sm italic uppercase tracking-tighter leading-tight group-hover:text-red-400 transition-colors">{m.game} · {m.format}</p>
                            <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1.5">
                              {players.length} Players · {m.challengeFee} CR
                            </p>
                          </div>
                          <AlertTriangle className={`w-4 h-4 mt-1 shrink-0 transition-colors ${isSelected ? "text-red-500" : "text-gray-800 group-hover:text-red-500/50"}`} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Queue Footer */}
            <div className="px-4 py-2 border-t border-white/5 bg-black/40">
               <p className="text-[7px] font-black uppercase tracking-[0.3em] text-gray-700 text-center uppercase">Tribunal Live Feed: Queue-50-Alpha</p>
            </div>
          </div>
        </div>

        {/* Right: Detail View */}
        <div className="lg:col-span-3">
          {!selected ? (
            <div className="bg-[#0a0a0a] border border-white/5 border-dashed rounded-sm h-full flex items-center justify-center py-24">
              <div className="text-center">
                <Gavel className="w-10 h-10 text-gray-700 mx-auto mb-4" />
                <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Select a dispute to begin review</p>
              </div>
            </div>
          ) : (
            <div className="bg-[#0a0a0a] border border-red-500/20 rounded-sm overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/5 bg-red-500/5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] text-red-400/60 font-mono mb-1">MATCH ID: {selected.id}</p>
                  <h3 className="text-white font-black italic uppercase tracking-tighter text-xl">
                    {selected.game} · {selected.format} · {selected.challengeFee} CR/player
                  </h3>
                </div>
                <Link 
                  href={`/match/${selected.id}`}
                  target="_blank"
                  className="bg-accent hover:bg-accent-hover text-black px-4 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-[0_0_20px_rgba(0,255,102,0.15)]"
                >
                  <ExternalLink className="w-3 h-3" /> Enter Room
                </Link>
              </div>

              {/* Tribunal Evidence Vault */}
              {(selected.disputeImageProof || selected.disputeVideoProof || selected.disputeReason) && (
                <div className="px-6 py-5 border-y border-white/5 bg-red-950/20 shadow-inner">
                   <div className="flex items-center gap-2 mb-4">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400 italic">Tribunal Forensic Evidence</h4>
                   </div>
                   
                   <div className="bg-black/40 border border-white/5 p-4 rounded-sm mb-6">
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-2">Operative Claim / Reason:</p>
                      <p className="text-white text-xs font-bold leading-relaxed italic">"{selected.disputeReason || "No statement provided."}"</p>
                   </div>

                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Dispute Screenshot */}
                      <div className="space-y-2">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
                           <ImageIcon className="w-3 h-3 text-red-400" /> Screenshot
                        </p>
                        <div className="bg-black border border-white/10 rounded-sm overflow-hidden aspect-video relative group">
                           {selected.disputeImageProof ? (
                             <>
                               <SafeImage
                                 src={selected.disputeImageProof}
                                 alt="Dispute Proof"
                                 className="w-full h-full object-cover"
                                 timeout={5000} // 5 second timeout for dispute images
                               />
                               <a href={selected.disputeImageProof} target="_blank" className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                  <span className="text-[10px] font-black uppercase tracking-widest text-white border border-white/20 px-3 py-1 rounded-sm">View Full Res</span>
                               </a>
                             </>
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-800 italic text-[9px] uppercase font-bold tracking-widest">No Image</div>
                           )}
                        </div>
                      </div>

                      {/* Dispute Video */}
                      <div className="space-y-2">
                        <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-2">
                           <MessageSquare className="w-3 h-3 text-red-400" /> Video Clip
                        </p>
                        <div className="bg-black border border-white/10 rounded-sm overflow-hidden aspect-video relative group">
                           {selected.disputeVideoProof ? (
                             <>
                               {/* Use a simple video tag or just a link to the CDN */}
                               <div className="w-full h-full flex flex-col items-center justify-center p-4">
                                  <div className="bg-red-500/20 p-2 rounded-full mb-2">
                                     <Gavel className="w-4 h-4 text-red-500" />
                                  </div>
                                  <a href={selected.disputeVideoProof} target="_blank" className="text-[10px] font-black uppercase tracking-widest text-red-400 hover:text-white transition-colors border-b border-red-500/20">
                                     Download Video Proof
                                  </a>
                               </div>
                             </>
                           ) : (
                             <div className="w-full h-full flex items-center justify-center text-gray-800 italic text-[9px] uppercase font-bold tracking-widest">No Video</div>
                           )}
                        </div>
                      </div>
                   </div>
                </div>
              )}

              {/* Standard Player Claims (Individual Result Proofs) */}
              <div className="grid grid-cols-2 divide-x divide-white/5">
                {playerList.map((p: any) => (
                  <div key={p.uid} className="p-5">
                    <div className="mb-3">
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Player</p>
                      <div className="flex items-center justify-between">
                        <p className="text-white font-black italic uppercase tracking-tighter">{p.username}</p>
                        <Link 
                          href={`/match/${selected.id}`} 
                          target="_blank"
                          className="text-[8px] text-accent font-black uppercase tracking-widest flex items-center gap-1 hover:underline"
                        >
                          Jump to Room <ExternalLink className="w-2.5 h-2.5" />
                        </Link>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border inline-block ${p.claim === "WIN" ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                          Claimed: {p.claim || "No claim"}
                        </span>
                        <button 
                          onClick={() => handleAudit(p.uid, p.username)}
                          className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm border border-blue-500/20 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all flex items-center gap-1"
                        >
                          <History className="w-2.5 h-2.5" /> Audit Operative
                        </button>
                      </div>
                    </div>

                    {/* Proof Screenshot */}
                    <div className="bg-black border border-white/10 rounded-sm overflow-hidden aspect-video flex items-center justify-center mb-4">
                      {p.proofUrl ? (
                        <SafeImage
                          src={p.proofUrl}
                          alt="Match Result Proof"
                          className="w-full h-full object-cover"
                          timeout={3000} // 3 second timeout for player proofs
                          fallbackText="Proof image unavailable"
                        />
                      ) : (
                        <div className="text-center p-4">
                          <ImageIcon className="w-6 h-6 text-gray-700 mx-auto mb-2" />
                          <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">No proof submitted</p>
                        </div>
                      )}
                    </div>

                    {/* Action Panel */}
                    <div className="space-y-3">
                      <div className="bg-black border border-white/5 p-3 rounded-sm">
                         <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mb-2">Intervention Command</p>
                         <textarea 
                           className="w-full bg-surface border border-white/5 p-2 text-[10px] text-white min-h-[50px] outline-none focus:border-red-500/50 mb-2 font-medium"
                           placeholder="Message to display boldly..."
                           value={interventionMsg}
                           onChange={(e) => setInterventionMsg(e.target.value)}
                         />
                         <button
                            onClick={() => handleIntervene(p.uid)}
                            disabled={intervening === p.uid}
                            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white text-[9px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                         >
                            {intervening === p.uid ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldAlert className="w-3 h-3" />}
                            Trigger Bold Alert
                         </button>
                      </div>

                      <button
                        onClick={() => handleResolve(selected.id, p.uid)}
                        disabled={resolving}
                        className="w-full py-2.5 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 hover:border-green-500/40 text-green-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {resolving ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        Award Win to {p.username}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* INTEGRATED COMMAND COMMS */}
              <div className="px-6 py-4 border-t border-white/5 bg-black/40">
                 <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                       <Terminal className="w-4 h-4 text-accent" />
                       <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-accent italic">Integrated Sector Comms</h4>
                    </div>
                    <button 
                      onClick={handleAlertPlayers}
                      className="text-[9px] px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 rounded-sm font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
                    >
                      <BellRing className="w-3 h-3" /> Notify Players
                    </button>
                 </div>
                 <div className="h-[400px] border border-white/5 rounded-sm overflow-hidden">
                    <MatchChat match={selected} />
                 </div>
                 <p className="text-[7.5px] text-gray-600 font-bold uppercase tracking-widest mt-2 px-1">
                    Direct frequency enabled. All transmissions logged for tribunal integrity.
                 </p>
              </div>

              {/* Global Actions */}
              <div className="px-6 py-4 border-t border-white/5 flex gap-3">
                <button
                  onClick={() => handleResolve(selected.id, "REFUND")}
                  disabled={resolving}
                  className="flex-1 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/20 text-yellow-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-3 h-3" /> Void Match / Refund Both
                </button>
                <button
                  onClick={() => setSelected(null)}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Verdict Confirmation Modal */}
      {verdictModal?.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-[#0a0a0a] border-2 border-red-500/30 p-8 w-full max-w-md rounded-sm shadow-[0_0_50px_rgba(239,68,68,0.2)] relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent" />
            
            <div className="flex flex-col items-center text-center">
               <div className="bg-red-500/10 p-4 rounded-full mb-6">
                  <Gavel className="w-10 h-10 text-red-500" />
               </div>
               
               <h3 className="text-white font-black uppercase tracking-[0.2em] text-xl italic mb-3">Deliver Verdict?</h3>
               <p className="text-gray-400 text-[11px] font-bold uppercase tracking-widest leading-relaxed mb-8">
                  You are about to <span className="text-white font-black underline">{verdictModal.label}</span>. 
                  This action will instantly distribute funds, notify all participants, and **permanently close the match room**.
               </p>

               <div className="w-full space-y-3">
                  <button 
                    onClick={executeVerdict}
                    disabled={resolving}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase tracking-[0.2em] py-4 rounded-sm text-xs transition-all flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
                  >
                    {resolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><ShieldAlert className="w-4 h-4" /> Confirm Verdict</>}
                  </button>
                  <button 
                    onClick={() => setVerdictModal(null)}
                    disabled={resolving}
                    className="w-full bg-black border border-white/10 text-gray-500 hover:text-white py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all"
                  >
                    Hold / Review Evidence
                  </button>
               </div>

               <p className="mt-6 text-[8px] text-red-500/40 font-black uppercase tracking-[0.3em] font-mono">
                  Tribunal Protocol: VERDICT_FINAL_TRANS_01
               </p>
            </div>
          </div>
        </div>
      )}

      {/* FORENSIC AUDIT MODAL */}
      {auditTarget && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-[#0a0a0a] border border-blue-500/30 w-full max-w-4xl max-h-[85vh] rounded-sm shadow-[0_0_50px_rgba(59,130,246,0.1)] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-6 border-b border-white/5 bg-blue-500/5 flex items-center justify-between">
                 <div>
                    <h3 className="text-white font-black uppercase tracking-[0.2em] text-xl italic flex items-center gap-3 leading-none mb-1">
                       <UserSearch className="w-5 h-5 text-blue-400" /> Forensic History
                    </h3>
                    <p className="text-[9px] text-blue-400/60 font-mono uppercase tracking-widest">Target: {auditTarget.username} · UID: {auditTarget.uid}</p>
                 </div>
                 <button onClick={() => setAuditTarget(null)} className="text-gray-500 hover:text-white transition-colors">
                    <XCircle className="w-6 h-6" />
                 </button>
              </div>

              {/* Modal Content */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                 {auditing ? (
                   <div className="flex flex-col items-center justify-center py-24">
                      <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                      <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest text-center">Decrypting Operative Match History...</p>
                   </div>
                 ) : auditData.length === 0 ? (
                   <div className="py-24 text-center opacity-40">
                      <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No match data found for this operative</p>
                   </div>
                 ) : (
                   <div className="space-y-3">
                      {auditData.map((event, idx) => (
                        <div key={idx} className="bg-white/[0.02] border border-white/5 p-4 rounded-sm hover:bg-white/[0.04] transition-colors group">
                           <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                 <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-sm ${event.type === 'MATCH' ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
                                       {event.type}
                                    </span>
                                    <p className="text-[8px] text-gray-600 font-mono">{new Date(event.timestamp).toLocaleString()}</p>
                                 </div>
                                 <p className="text-xs text-white font-bold tracking-tight mb-1 group-hover:text-blue-400 transition-colors uppercase italic">{event.title}</p>
                                 <p className="text-[10px] text-gray-500 leading-relaxed font-medium">{event.details}</p>
                              </div>
                              <div className="text-right shrink-0">
                                 <p className={`text-sm font-black italic tracking-tighter ${event.impact > 0 ? 'text-green-400' : event.impact < 0 ? 'text-red-400' : 'text-gray-500'}`}>
                                    {event.impact > 0 ? '+' : ''}{event.impact} CR
                                 </p>
                                 <p className="text-[8px] text-gray-600 font-black uppercase tracking-widest mt-1">Delta Impact</p>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                 )}
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end">
                 <button 
                   onClick={() => setAuditTarget(null)}
                   className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase tracking-widest rounded-sm text-[10px] transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)]"
                 >
                   Clear Intel Feed
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}
