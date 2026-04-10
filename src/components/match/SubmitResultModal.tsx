"use client";
import React, { useState, useRef } from 'react';
import { submitMatchResult, Match, MatchPlayer } from '@/lib/match-service';
import { useAuth } from '@/components/auth/AuthProvider';
import { submitResultWithDiscordAction } from '@/app/actions/discord-actions';

export default function SubmitResultModal({ 
  isOpen, 
  onClose, 
  matchId, 
  uid,
  inGameName,
  match,
  game
}: { 
  isOpen: boolean, 
  onClose: () => void,
  matchId: string, 
  uid: string,
  inGameName?: string,
  match: Match,
  game: 'CODM' | 'EFOOTBALL'
}) {
  const { user } = useAuth();
  const me = match.players[uid];
  const [file, setFile] = useState<File | null>(null);
  const [claim, setClaim] = useState<'WIN' | 'LOSS' | null>((me as any)?.claim || null);
  const [scoreFor, setScoreFor] = useState<string>((me as any)?.scoreFor?.toString() || "");
  const [scoreAgainst, setScoreAgainst] = useState<string>((me as any)?.scoreAgainst?.toString() || "");
  const [kills, setKills] = useState<string>((me as any)?.kills?.toString() || "");
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- TACTICAL STATE RE-SYNC ---
  // When the modal opens, refresh data from the match
  // Reset failure states, but KEEP isSubmitted true if it was just set
  React.useEffect(() => {
    if (isOpen) {
      setError("");
      setIsUploading(false);
      
      const p = match.players[uid];
      if (p) {
        setClaim((p as any).claim || null);
        setScoreFor((p as any).scoreFor?.toString() || "");
        setScoreAgainst((p as any).scoreAgainst?.toString() || "");
        setKills((p as any).kills?.toString() || "");
      }
    } else {
      // Clear submission state when modal officially closes
      setIsSubmitted(false);
    }
  }, [isOpen, match.id, uid]); // Only sync on ID/Open, not on match data updates

  if (!isOpen) return null;

  const isFormValid = () => {
    if (!claim) return false;
    if (claim === 'WIN' && !file) return false;
    if (game === 'EFOOTBALL') {
       return scoreFor !== "" && scoreAgainst !== "";
    } else {
       return kills !== "";
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!isFormValid()) {
      setError("Tactical Error: All mission parameters must be specified.");
      return;
    }

    if (game === 'CODM' && claim === 'WIN' && match.format === 'FFA') {
      const myKills = Number(kills);
      const players = Object.values(match.players) as MatchPlayer[];
      const otherKills = players
        .filter(p => (p as any).uid !== uid && (p as any).kills !== undefined)
        .map(p => Number((p as any).kills));
      
      if (otherKills.includes(myKills)) {
        const conflictOperative = players.find(p => (p as any).uid !== uid && Number((p as any).kills) === myKills);
        setError(`DATA CONFLICT: Kill-count of ${myKills} already reported by ${conflictOperative?.username || "another operative"}. Winners must have a unique score.`);
        return;
      }
    }

    // SCORE INTEGRITY CHECK (eFootball)
    if (game === 'EFOOTBALL') {
      const sFor = Number(scoreFor);
      const sAgainst = Number(scoreAgainst);
      
      if (claim === 'WIN' && sFor <= sAgainst) {
        setError("Logical Conflict: You cannot claim a VICTORY with a losing scoreline.");
        return;
      }
      if (claim === 'LOSS' && sFor >= sAgainst) {
        setError("Logical Conflict: You cannot admit DEFEAT with a winning scoreline.");
        return;
      }
    }

    setIsUploading(true);
    setError("");

    try {
      const formData = new FormData();
      if (!user) throw new Error("Authentication required.");
      const idToken = await user.getIdToken();
      
      formData.append("idToken", idToken);
      formData.append("matchId", matchId);
      formData.append("claim", claim!);
      formData.append("username", user.displayName || "Unknown Operator");
      if (inGameName) {
        formData.append("inGameName", inGameName);
      }

      if (game === 'EFOOTBALL') {
         formData.append("scoreFor", scoreFor);
         formData.append("scoreAgainst", scoreAgainst);
      } else {
         formData.append("kills", kills);
      }

      if (file && claim === 'WIN') {
        formData.append("file", file);
      }

      const result = await submitResultWithDiscordAction(formData);
      
      if (!result.success) {
        throw new Error(result.error);
      }
      
      setIsSubmitted(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Submission failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={!isUploading ? onClose : undefined} />
      
      <div className="relative w-full max-w-lg bg-surface border border-surface-border rounded-[5px] shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-black border-b border-surface-border p-5 flex justify-between items-center z-10 shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
             </div>
             <div>
               <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Final Resolution</h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Declare Match Complete</p>
             </div>
           </div>
           
           {!isUploading && !isSubmitted && (
             <button onClick={onClose} className="text-gray-500 hover:text-white p-2 bg-surface hover:bg-surface-hover rounded-[3px] transition-colors">
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
             </button>
           )}
        </div>

        {/* Dynamic Content */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">
           {!isSubmitted ? (
             <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-3">Target Outcome</label>
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={() => setClaim('WIN')}
                      className={`py-4 rounded-[3px] font-black uppercase tracking-widest transition-all ${claim === 'WIN' ? 'bg-accent text-black shadow-[0_0_15px_rgba(0,255,102,0.3)]' : 'bg-surface-hover border border-surface-border text-gray-400'}`}
                    >
                      I Won
                    </button>
                    <button 
                      onClick={() => setClaim('LOSS')}
                      className={`py-4 rounded-[3px] font-black uppercase tracking-widest transition-all ${claim === 'LOSS' ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'bg-surface-hover border border-surface-border text-gray-400'}`}
                    >
                      I Lost
                    </button>
                  </div>
                </div>

                {claim && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-3">
                       {game === 'EFOOTBALL' ? 'Final Scoreline' : 'Confirmed Total Kills'}
                    </label>
                    {game === 'EFOOTBALL' ? (
                        <div className="space-y-3">
                           <div className="flex items-center gap-4">
                              <div className="flex-1">
                                 <input 
                                   type="number"
                                   min="0" 
                                   placeholder="Your Score"
                                   value={scoreFor}
                                   onChange={(e) => setScoreFor(e.target.value)}
                                   className="w-full bg-black border border-surface-border focus:border-accent p-4 rounded-[3px] text-white font-black text-center"
                                 />
                              </div>
                              <span className="text-gray-600 font-bold">VS</span>
                              <div className="flex-1">
                                 <input 
                                   type="number"
                                   min="0" 
                                   placeholder="Opponent"
                                   value={scoreAgainst}
                                   onChange={(e) => setScoreAgainst(e.target.value)}
                                   className="w-full bg-black border border-surface-border focus:border-accent p-4 rounded-[3px] text-white font-black text-center"
                                 />
                              </div>
                           </div>
                           <div className="bg-accent/5 border border-accent/20 p-3 rounded-sm">
                              <p className="text-[9px] text-accent font-bold uppercase tracking-widest leading-relaxed text-center">
                                 <span className="text-white">Tactical Agreement Required:</span> Your opponent must submit the exact same scoreline for auto-payout. Accuracy is mandatory.
                              </p>
                           </div>
                        </div>
                    ) : (
                       <input 
                         type="number"
                         min="0" 
                         placeholder="Enemy Casualties Confirmed..."
                         value={kills}
                         onChange={(e) => setKills(e.target.value)}
                         className="w-full bg-black border border-surface-border focus:border-accent p-4 rounded-[3px] text-white font-black text-center"
                       />
                    )}
                  </div>
                )}

               {claim === 'WIN' && (
                 <div className="animate-in slide-in-from-top-2 duration-300">
                    <label className="block text-[10px] font-bold uppercase tracking-widest text-sub mb-3">Visual Proof (Required)</label>
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className={`border-2 border-dashed ${file ? 'border-accent bg-accent/5' : 'border-surface-border hover:border-accent bg-black'} p-8 rounded-[3px] flex flex-col items-center justify-center cursor-pointer transition-colors group`}
                    >
                       <div className="w-10 h-10 rounded-full bg-surface group-hover:bg-accent/10 flex items-center justify-center mb-3 transition-colors">
                          <svg className={`w-5 h-5 ${file ? 'text-accent' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                       </div>
                       <span className="text-[11px] font-bold text-white uppercase tracking-widest text-center">
                         {file ? file.name : "Tap to Select Victory Screen"}
                       </span>
                    </div>
                 </div>
               )}

               {/* Real-time Conflict Alert */}
               {(() => {
                  if (game === 'EFOOTBALL' && scoreFor && scoreAgainst) {
                     const opponents = Object.entries(match.players).filter(([pid]) => pid !== uid);
                     for (const [opUid, opData] of opponents) {
                        const opScoreFor = (opData as any).scoreFor;
                        const opScoreAgainst = (opData as any).scoreAgainst;
                        
                        if (opScoreFor !== undefined && opScoreAgainst !== undefined) {
                           if (Number(scoreFor) !== opScoreAgainst || Number(scoreAgainst) !== opScoreFor) {
                              return (
                                 <div className="p-4 bg-red-600/10 border border-red-600/30 rounded-[3px] mb-4 animate-in slide-in-from-top-2">
                                    <p className="text-red-500 text-[10px] font-black uppercase tracking-widest text-center leading-relaxed italic">
                                       ⚠️ Tactical Conflict Detected: Your scoreline ({scoreFor}-{scoreAgainst}) does not match your opponent's report ({opScoreAgainst}-{opScoreFor}). Please verify.
                                    </p>
                                 </div>
                              );
                           }
                        }
                     }
                  }
                  return null;
               })()}

               {error && (
                 <div className={`p-4 rounded-[3px] border animate-in slide-in-from-top-2 duration-300 mb-4 ${error.includes('SCORE_MISMATCH') ? 'bg-red-500/10 border-red-500/50' : 'bg-surface border-surface-border'}`}>
                    <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest text-center leading-relaxed italic">
                       {error.includes('SCORE_MISMATCH') 
                         ? "⚠️ Tactical Mismatch: Reported scoreline conflicts with your opponent's report. Coordinate and retry." 
                         : error}
                    </p>
                 </div>
               )}

               <button 
                  disabled={isUploading || !isFormValid()}
                  onClick={handleSubmit}
                  className="w-full bg-accent hover:bg-accent-hover disabled:bg-surface disabled:text-gray-500 disabled:border overflow-hidden disabled:border-surface-border disabled:shadow-none transition-all py-4 rounded-[3px] text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,102,0.2)] flex justify-center items-center h-14 mt-4"
               >
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-white font-bold uppercase tracking-widest animate-in fade-in duration-300">
                       <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                       <span>Transmitting & Scanning Data...</span>
                    </div>
                  ) : (
                    "Confirm & Notify Opponent"
                  )}
               </button>
             </div>
           ) : (
             <div className="flex flex-col items-center text-center py-6">
                <div className="w-20 h-20 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mb-6 relative">
                   <div className="absolute inset-0 rounded-full bg-accent blur-xl opacity-30 animate-pulse"></div>
                   <svg className="w-10 h-10 text-accent animate-[bounce_1s_infinite]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                 </div>
                 <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">Claim Filed</h3>
                 <p className="text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed mb-8 max-w-sm mx-auto">
                    Result submitted for validation. If your opponent confirms or fails to counter within the timer, the match resolves.
                 </p>
                 
                 <button 
                  onClick={onClose}
                  className="w-full bg-surface hover:bg-surface-hover border border-surface-border text-white font-bold uppercase tracking-widest py-4 rounded-[3px] transition-all"
                >
                  Return to Combat Zone
                </button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
