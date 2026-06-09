"use client";
import React, { useEffect, useState } from "react";
import { enlistGauntlet, joinGauntletQueue, leaveGauntletQueue, getChallengeInterestCount, forfeitGauntlet } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2, Swords, Target, Flame, ArrowLeftRight, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

const GAUNTLET_PAYOUTS: Record<number, number> = { 1: 36, 2: 54, 3: 72, 4: 90, 5: 108 };

interface GauntletHubProps {
  game: 'CODM' | 'EFOOTBALL';
}

export default function GauntletHub({ game }: GauntletHubProps) {
  const { user, profile } = useAuth();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [activeGauntlet, setActiveGauntlet] = useState<any>(null);
  const [queueCount, setQueueCount] = useState(0);
  const [inQueue, setInQueue] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState("");

  const [selectedTarget, setSelectedTarget] = useState<number>(3);
  const [showEnlistConfirm, setShowEnlistConfirm] = useState(false);
  const [showNameInput, setShowNameInput] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showForfeitConfirm, setShowForfeitConfirm] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;

    const unsubUser = onSnapshot(doc(db, "users", user.uid), (doc) => {
      if (doc.exists()) {
         const data = doc.data();
         if (data.gauntlet?.active && data.gauntlet.game === game) {
            setActiveGauntlet(data.gauntlet);
         } else {
            setActiveGauntlet(null);
         }
      }
      setLoading(false);
    });

    const queueId = `gauntlet_${game.toLowerCase()}`;
    const unsubQueue = onSnapshot(doc(db, "queues", queueId), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        const pids = data.playerIds || [];
        setQueueCount(pids.length);
        setInQueue(pids.includes(user.uid));
      } else {
        setQueueCount(0);
        setInQueue(false);
      }
    });

    return () => { unsubUser(); unsubQueue(); };
  }, [user, game]);

  const handleEnlist = async () => {
     if (!user || !profile) return;
     if ((profile.balanceCoins || 0) < 20) {
        setError("ABORTED: You need 20 CR to enter the Gauntlet.");
        setShowEnlistConfirm(false);
        return;
     }

     setRegistering(true);
     setError("");
     try {
        const idToken = await user.getIdToken();
        await enlistGauntlet(idToken, game, selectedTarget);
        setShowEnlistConfirm(false);
     } catch (err: any) {
        setError(err.message || "Failed to enlist.");
     }
     setRegistering(false);
  };

  const handlePair = async () => {
     if (!user || !profile || !activeGauntlet) return;

     const tagField = game === 'CODM' ? profile.codTag : profile.efootballTag;
     if (!tagField || tagField === "Unknown") {
        setShowNameInput(true);
        return;
     }

     setRegistering(true);
     setError("");
     try {
        const idToken = await user.getIdToken();
        const result = await joinGauntletQueue(idToken, profile.username, profile.avatarId, game, tagField);
        if ((result as any).matchCreated && (result as any).matchId) {
           router.push(`/match/${(result as any).matchId}`);
        }
     } catch (err: any) {
        setError(err.message || "Failed to join queue.");
     }
     setRegistering(false);
  };

  const handleLeaveQueue = async () => {
     if (!user || registering) return;
     setRegistering(true);
     setError("");
     try {
        const idToken = await user.getIdToken();
        await leaveGauntletQueue(idToken, game);
     } catch (err: any) {
        setError(err.message || "Failed to leave queue.");
     }
     setRegistering(false);
  };

  const handleForfeit = async () => {
     if (!user || registering) return;
     setRegistering(true);
     setError("");
     try {
        const idToken = await user.getIdToken();
        const result = await forfeitGauntlet(idToken);
        if (!result.success) {
           setError(result.error || "Failed to forfeit Gauntlet.");
        } else {
           setShowForfeitConfirm(false);
           setActiveGauntlet(null);
        }
     } catch (err: any) {
        setError(err.message || "Failed to forfeit Gauntlet.");
     }
     setRegistering(false);
  };

  if (loading) return <div className="animate-pulse h-32 bg-surface border border-surface-border rounded-sm"></div>;

  return (
    <div className="mt-8 mb-12 relative overflow-hidden bg-gradient-to-br from-[#1a1515] to-black border border-orange-500/30 rounded-lg p-6 shadow-[0_0_40px_rgba(255,100,0,0.1)]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/10 rounded-full blur-[80px] pointer-events-none" />
      
      <div className="flex justify-between items-start mb-6 relative z-10">
         <div>
            <h2 className="text-xl font-black uppercase tracking-widest text-orange-500 flex items-center gap-2">
               <Flame className="w-5 h-5 text-orange-400" />
               The Gauntlet Arena ({game})
            </h2>
            <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-bold">Survive the streak. Claim the pot.</p>
         </div>
         <div className="text-right">
            <div className="text-[10px] text-orange-500/70 font-black uppercase tracking-widest">Entry Fee</div>
            <div className="text-lg font-black italic text-orange-400">20 CR</div>
         </div>
      </div>

      {error && (
         <div className="mb-4 bg-red-500/10 border border-red-500/30 p-3 rounded-sm">
            <p className="text-xs text-red-400 font-bold uppercase tracking-widest text-center">{error}</p>
         </div>
      )}

      {!activeGauntlet ? (
         <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
               <p className="text-sm text-gray-300">Select your target streak. The higher the streak, the bigger the payout. If you lose a match, your Gauntlet run ends and you lose your 20 CR.</p>
               <div className="grid grid-cols-5 gap-2">
                  {[1, 2, 3, 4, 5].map((target) => (
                     <button
                        key={target}
                        onClick={() => { setSelectedTarget(target); setShowEnlistConfirm(false); }}
                        className={`py-3 rounded-sm border transition-all text-center flex flex-col items-center justify-center ${
                           selectedTarget === target 
                              ? 'bg-orange-500/20 border-orange-500 text-orange-400 scale-105 shadow-[0_0_15px_rgba(255,165,0,0.3)]' 
                              : 'bg-black/50 border-surface-border text-gray-500 hover:border-orange-500/50 hover:text-orange-300'
                        }`}
                     >
                        <span className="text-lg font-black">{target}</span>
                        <span className="text-[9px] uppercase tracking-widest">Wins</span>
                     </button>
                  ))}
               </div>
            </div>
            
            <div className="bg-black/40 border border-orange-500/20 rounded-md p-5 flex flex-col justify-center items-center">
               <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Potential Payout</div>
               <div className="text-4xl font-black italic text-orange-400 mb-6 drop-shadow-[0_0_10px_rgba(255,165,0,0.8)]">
                  {GAUNTLET_PAYOUTS[selectedTarget]} CR
               </div>
               
               {!showEnlistConfirm ? (
                  <button 
                     onClick={() => setShowEnlistConfirm(true)}
                     className="w-full max-w-xs bg-orange-600 hover:bg-orange-500 text-black py-3 rounded-sm font-black uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_20px_rgba(255,100,0,0.4)]"
                  >
                     Enlist Now
                  </button>
               ) : (
                  <div className="w-full max-w-xs space-y-3 animate-in fade-in zoom-in-95">
                     <p className="text-[10px] text-orange-300 text-center uppercase tracking-widest">Deduct 20 CR to begin?</p>
                     <div className="flex gap-2">
                        <button 
                           onClick={() => setShowEnlistConfirm(false)}
                           className="flex-1 border border-surface-border text-gray-400 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-white/5"
                        >
                           Cancel
                        </button>
                        <button 
                           onClick={handleEnlist}
                           disabled={registering}
                           className="flex-1 bg-orange-600 text-black py-2 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center"
                        >
                           {registering ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                        </button>
                     </div>
                  </div>
               )}
            </div>
         </div>
      ) : (
         <div className="relative z-10 flex flex-col items-center justify-center py-6">
            <div className="flex gap-4 mb-8">
               <div className="bg-black/50 border border-orange-500/30 px-6 py-4 rounded-md text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Current Streak</div>
                  <div className="text-3xl font-black text-white">{activeGauntlet.currentWins} <span className="text-lg text-gray-500">/ {activeGauntlet.targetWins}</span></div>
               </div>
               <div className="bg-black/50 border border-orange-500/30 px-6 py-4 rounded-md text-center">
                  <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Target Payout</div>
                  <div className="text-3xl font-black italic text-orange-400">{GAUNTLET_PAYOUTS[activeGauntlet.targetWins]} <span className="text-sm not-italic text-orange-500/50">CR</span></div>
               </div>
            </div>

            {inQueue ? (
               <div className="space-y-4 w-full max-w-sm">
                  <div className="w-full bg-orange-500/10 border border-orange-500/30 py-3 rounded-sm text-xs font-black uppercase tracking-widest text-center text-orange-400 flex items-center justify-center gap-2">
                     <Loader2 className="w-4 h-4 animate-spin" />
                     Searching for Opponent... ({queueCount}/2)
                  </div>
                  <button 
                     onClick={handleLeaveQueue}
                     disabled={registering}
                     className="w-full text-center text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5 py-2"
                  >
                     <ArrowLeftRight className="w-3 h-3" /> Cancel Search
                  </button>
               </div>
            ) : showNameInput ? (
               <div className="w-full max-w-sm space-y-3 animate-in fade-in zoom-in-95">
                  <p className="text-[10px] text-orange-300 text-center uppercase tracking-widest">Enter your In-Game ID to pair</p>
                  <input
                     type="text"
                     value={tempName}
                     onChange={(e) => setTempName(e.target.value)}
                     className="w-full bg-black/50 border border-orange-500/30 p-3 rounded-sm text-white font-black uppercase tracking-widest outline-none focus:border-orange-500 text-center text-xs"
                     placeholder={`${game} IGN`}
                  />
                  <div className="flex gap-2">
                     <button 
                        onClick={() => setShowNameInput(false)}
                        className="flex-1 border border-surface-border text-gray-400 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-white/5"
                     >
                        Cancel
                     </button>
                     <button 
                        onClick={async () => {
                           if (!tempName.trim() || !user || !profile) {
                              setError("In-Game ID and valid session required.");
                              return;
                           }
                           setShowNameInput(false);
                           setRegistering(true);
                           setError("");
                           try {
                              const idToken = await user.getIdToken();
                              const result = await joinGauntletQueue(idToken, profile.username, profile.avatarId, game, tempName.trim());
                              if ((result as any).matchCreated && (result as any).matchId) {
                                 router.push(`/match/${(result as any).matchId}`);
                              }
                           } catch (err: any) {
                              setError(err.message || "Failed to join queue.");
                           }
                           setRegistering(false);
                        }}
                        disabled={registering}
                        className="flex-1 bg-orange-600 text-black py-2 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center"
                     >
                        {registering ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm & Pair"}
                     </button>
                  </div>
               </div>
            ) : (
               <div className="w-full max-w-sm space-y-3 flex flex-col items-center">
                  {activeGauntlet.currentWins === 0 && !showForfeitConfirm && (
                     <button 
                        onClick={() => setShowForfeitConfirm(true)}
                        className="w-full text-center text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5 py-2 border-b border-surface-border"
                     >
                        <LogOut className="w-3 h-3" /> Forfeit & Get Refund
                     </button>
                  )}

                  {showForfeitConfirm && activeGauntlet.currentWins === 0 && (
                     <div className="w-full space-y-3 animate-in fade-in zoom-in-95 mb-4">
                        <p className="text-[10px] text-yellow-300 text-center uppercase tracking-widest">Get 20 CR back? (can't undo)</p>
                        <div className="flex gap-2">
                           <button 
                              onClick={() => setShowForfeitConfirm(false)}
                              className="flex-1 border border-surface-border text-gray-400 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-white/5"
                           >
                              Keep Going
                           </button>
                           <button 
                              onClick={handleForfeit}
                              disabled={registering}
                              className="flex-1 bg-red-600 text-white py-2 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center"
                           >
                              {registering ? <Loader2 className="w-3 h-3 animate-spin" /> : "Forfeit"}
                           </button>
                        </div>
                     </div>
                  )}

                  {!showForfeitConfirm && (
                     <button 
                        onClick={handlePair}
                        disabled={registering}
                        className="w-full max-w-sm bg-orange-600 hover:bg-orange-500 text-black py-4 rounded-sm text-sm font-black uppercase tracking-widest transition-all hover:scale-105 shadow-[0_0_30px_rgba(255,100,0,0.5)] flex items-center justify-center gap-2"
                     >
                        {registering ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                           <>
                              <Swords className="w-5 h-5" /> Pair Now
                           </>
                        )}
                     </button>
                  )}
               </div>
            )}
         </div>
      )}
    </div>
  );
}
