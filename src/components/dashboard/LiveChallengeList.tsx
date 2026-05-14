"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot, limit, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Match, joinMatch } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2, Swords, User, ChevronRight, Plus, Search, ShieldCheck, Share2 } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function LiveChallengeList({ onHostClick }: { onHostClick?: () => void }) {
  const { user, profile } = useAuth();
  const toast = useToast();
  const [challenges, setChallenges] = useState<Match[]>([]);
  const [showDummyData, setShowDummyData] = useState<boolean>(true);
  const [searchFee, setSearchFee] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<'ALL' | 'CODM' | 'EFOOTBALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [joiningMatch, setJoiningMatch] = useState<Match | null>(null);
  const [inGameName, setInGameName] = useState("");
  const [joinReferralCode, setJoinReferralCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Listen for System Config
    const configUnsub = onSnapshot(doc(db, "system", "config"), (docSnap) => {
       if (docSnap.exists()) {
          setShowDummyData(docSnap.data().showDummyData ?? true);
       }
    });

    const q = query(
      collection(db, "matches"),
      where("status", "==", "WAITING"),
      limit(20)
    );
    // Note: removed orderBy temporarily to avoid index requirement during recovery

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      // Client-side filtering and sorting
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';

      const sorted = docs
        .filter(d => d.format !== 'tournament' && !d.circuitId) 
        .filter(d => isLocal || !d.isTestMode) // Filter out test mode if NOT local

        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 20); // Show more challenges
      
      setChallenges(sorted);
      setLoading(false);

      // [DEEP-LINK] Check for join parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const joinId = urlParams.get("join");
      if (joinId && !joiningMatch) {
         const matchToJoin = sorted.find(m => m.id === joinId);
         if (matchToJoin) {
            setJoiningMatch(matchToJoin);
            // Clear param to avoid re-opening on refresh
            window.history.replaceState({}, '', window.location.pathname);
         }
      }
    }, (err) => {
      console.error("[LiveChallengeList] Sync Error:", err);
      setLoading(false);
    });

    return () => { unsub(); configUnsub(); };
  }, [user, joiningMatch]);

  // Sync game username from profile when joining
  useEffect(() => {
    if (profile && joiningMatch) {
      const tag = joiningMatch.game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");
      setJoinReferralCode("");

      // RECRUIT AUTO-FILL: If joining your partner's room, we don't need a password anymore
      // We rely on isPartnerTournament gating in the UI
      setJoinPassword("");
    }
  }, [profile, joiningMatch]);

  const confirmJoin = async () => {
    if (!user || !profile || !joiningMatch) return;
    
    const isPartnerOverseer = joiningMatch.isPartnerTournament && joiningMatch.creatorId === user.uid;
    
    if (!inGameName.trim() && !isPartnerOverseer) {
       toast.error("Deployment Error", "Please enter your exact In-Game Name.");
       return;
    }

    setJoinLoading(true);
    try {
      const idToken = await user.getIdToken();
      await joinMatch(idToken, profile.username, profile.avatarId, joiningMatch.id!, inGameName.trim(), joinReferralCode.trim() || undefined, joiningMatch.isProtected ? joinPassword : undefined);
      setJoiningMatch(null); // Close modal immediately
      
      if (isPartnerOverseer) {
        toast.info("Overseer Link Established", "Entering Command Center as an observer.");
      }
      
      router.push(`/match/${joiningMatch.id}`);
    } catch (err: any) {
      toast.error("Deployment Failure", err.message || "Failed to join challenge.");
      // Don't close the modal if it's a code error so they can try again
      if (!err.message?.includes("EXCLUSIVE_ACCESS") && !err.message?.includes("INVALID_CODE")) {
        setJoiningMatch(null);
      }
    }
    setJoinLoading(false);
  };

  if (loading) return (
    <div className="flex justify-center py-10">
      <Loader2 className="w-6 h-6 text-accent animate-spin" />
    </div>
  );

  return (
    <div className="mt-8">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-main italic uppercase tracking-tighter flex items-center gap-3">
             <Swords className="w-6 h-6 text-accent animate-pulse" />
             Live Combat Operations
          </h2>
          <p className="text-[10px] text-sub uppercase font-bold tracking-[0.2em] mt-1 italic opacity-60">Multi-Segment Tactical Feed</p>
        </div>
        <Link 
          href="/dashboard/challenges" 
          className="text-[10px] font-black uppercase text-accent hover:text-white border-b border-accent/30 hover:border-white transition-all tracking-[0.2em] pb-1"
        >
          See All Challenges
        </Link>
      </div>
        
      {/* Action Row */}
      <div className="flex items-center gap-4 mb-8">
          <button 
            onClick={onHostClick}
            className="ml-auto bg-accent text-black font-black uppercase tracking-[0.2em] px-8 py-4 rounded-sm text-xs flex items-center gap-3 transition-all hover:bg-accent-hover active:scale-95 shadow-[0_0_20px_rgba(0,255,102,0.3)] group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform" />
            Initiate New Deployment
          </button>
      </div>

      {challenges.length === 0 && false ? ( // Disabled empty state completely since we have dummy data now
        <div className="bg-surface/50 border border-surface-border border-dashed p-10 rounded-sm text-center">
           <Swords className="w-8 h-8 text-gray-700 mx-auto mb-3 opacity-20" />
           <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No active duels found.</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {[...challenges, 
            ...(showDummyData ? [
              { id: 'dummy-1', roomName: 'Sniper Only Lobby', game: 'CODM', format: '1v1', challengeFee: 50, maxPlayers: 2, players: { 1: {}, 2: {} }, creatorId: '1', isDummy: true, isProtected: true },
              { id: 'dummy-2', roomName: 'Pro Circuit Qualifier', game: 'EFOOTBALL', format: '1v1', challengeFee: 200, maxPlayers: 2, players: { 1: {}, 2: {} }, creatorId: '1', isDummy: true },
              { id: 'dummy-3', roomName: 'Casual Grind', game: 'CODM', format: '4v4', challengeFee: 10, maxPlayers: 8, players: { 1: {}, 2: {}, 3: {}, 4: {}, 5: {}, 6: {}, 7: {}, 8: {} }, creatorId: '1', isDummy: true },
              { id: 'dummy-4', roomName: 'High Stakes Duos', game: 'CODM', format: '2v2', challengeFee: 500, maxPlayers: 4, players: { 1: {}, 2: {}, 3: {}, 4: {} }, creatorId: '1', isDummy: true, isPartnerTournament: true, partnerName: 'EliteGaming' }
            ] : [])
          ].map((c: any) => {
            const creator: any = c.isDummy ? { username: c.roomName, avatarId: parseInt(c.id.split('-')[1]) } : Object.values(c.players).find((p: any) => p.uid === c.creatorId);
            const target = c.maxPlayers || 2;
            const current = Object.keys(c.players || {}).length;
            const isFull = current >= target || c.isDummy;
            const isPartnerMatch = !!c.isPartnerTournament;
            
            return (
              <div 
                key={c.id} 
                className={`min-w-[280px] sm:min-w-[320px] snap-start bg-surface border p-5 rounded-sm relative group hover:scale-[1.02] transition-all duration-300 ${isPartnerMatch ? 'border-yellow-500/40 shadow-[0_0_15px_rgba(234,179,8,0.1)]' : 'border-surface-border hover:border-accent/40'}`}
              >
                {isPartnerMatch && (
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-sm">
                    <span className="text-[7px] font-black text-yellow-500 uppercase tracking-widest">Partner Exclusive</span>
                  </div>
                )}

                {isFull && (
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-sm">
                      <div className="border-2 border-red-500/50 px-4 py-2 rotate-[-10deg] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                         <span className="text-red-500 font-black italic uppercase tracking-[0.3em] text-xs">
                           {c.isDummy ? 'Match In Progress' : 'Arena Locked'}
                         </span>
                      </div>
                   </div>
                )}

                <div className="flex items-center gap-4 mb-5">
                  <div className={`w-12 h-12 bg-black border rounded-sm rotate-45 flex items-center justify-center overflow-hidden shrink-0 ${isPartnerMatch ? 'border-yellow-500/40' : 'border-surface-border'}`}>
                    <div 
                      className="w-[200%] h-[200%] -rotate-45"
                      style={{
                        backgroundImage: `url('/avatar_collection.png')`,
                        backgroundSize: '400% 500%',
                        backgroundPosition: `${((creator?.avatarId || 0) % 4) * 33.33}% ${Math.floor((creator?.avatarId || 0) / 4) * 25}%`
                      }}
                    />
                  </div>
                   <div>
                    <div className={`text-white font-black italic uppercase tracking-tighter text-base group-hover:text-accent transition-colors flex items-center gap-2 ${isPartnerMatch ? 'text-yellow-500' : ''}`}>
                      {c.isProtected && <ShieldCheck className="w-4 h-4 text-gray-500" />}
                      {c.roomName || creator?.username || "Operator"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] ${c.game === 'CODM' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {c.game}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] bg-white/5 text-sub border border-white/10">
                        {c.format}
                      </span>
                      {isPartnerMatch && (
                        <span className="text-[8px] font-black uppercase text-yellow-500/60 tracking-widest italic ml-1">
                           by {c.partnerName || "Partner"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-5 bg-black/40 border border-surface-border/50 p-3 rounded-sm">
                   <div className="flex flex-col">
                      <span className="text-[9px] text-sub font-bold uppercase tracking-widest">Entry Fee</span>
                      <span className="text-sm font-black text-white italic tracking-tighter">{c.challengeFee} CR</span>
                   </div>
                   <div className="flex flex-col items-end">
                      <span className="text-[9px] text-sub font-bold uppercase tracking-widest">Occupancy</span>
                      <span className={`text-sm font-black italic tracking-tighter ${isFull ? 'text-red-500' : 'text-accent'}`}>{current}/{target} Players</span>
                   </div>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      if (!user) {
                        router.push(`/register?callback=/dashboard?join=${c.id}`);
                        return;
                      }
                      if (!isFull && !c.isDummy) {
                        setJoiningMatch(c);
                      } else {
                        router.push(`/match/${c.id}`);
                      }
                    }}
                    className={`flex-1 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                      !user 
                        ? 'bg-accent text-black hover:bg-accent-hover' 
                        : (isFull ? 'bg-white/10 text-white hover:bg-white/20' : (isPartnerMatch ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-main hover:bg-main-hover text-accent shadow-[0_0_15px_rgba(0,255,102,0.1)]'))
                    }`}
                  >
                    {!user 
                      ? (isFull ? "Sign Up to Observe" : "Sign Up / Login to Join")
                      : isFull 
                        ? (c.creatorId === user?.uid ? "Enter War Room" : "Observe Mission") 
                        : (c.creatorId === user?.uid ? "Enter War Room" : (isPartnerMatch ? "Enlist in Creator Cup" : "Join Combat Duel"))
                    }
                    <ChevronRight className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (c.isDummy) {
                         toast.error("Arena Locked", "This match is already in progress.");
                         return;
                      }
                      const url = window.location.origin + "/dashboard?join=" + c.id;
                      navigator.clipboard.writeText(url);
                      toast.success("INVITE LINK COPIED", "Share this URL with squad members to invite them to this mission.");
                    }}
                    className="bg-surface-hover border border-surface-border hover:border-accent/40 text-gray-500 hover:text-accent px-3 py-3 rounded-sm transition-all"
                    title="Share Mission"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}


      {/* JOIN CONFIRMATION MODAL WITH IGN & PARTNER GATING */}
      {joiningMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setJoiningMatch(null)} />
          <div className="bg-surface border border-surface-border w-full max-w-sm rounded-sm relative overflow-hidden animate-in zoom-in-95 fade-in duration-200 shadow-2xl p-6">
             <div className="flex items-center gap-3 mb-6">
                <div className={`p-2 rounded-full ${joiningMatch.isPartnerTournament ? 'bg-yellow-500/20' : 'bg-accent/20'}`}>
                  <Swords className={`w-5 h-5 ${joiningMatch.isPartnerTournament ? 'text-yellow-500' : 'text-accent'}`} />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase text-white italic tracking-tighter">
                     {joiningMatch.isPartnerTournament ? "Influencer Clearance" : "Combat Briefing"}
                   </h3>
                   <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pre-Deployment Validation</p>
                </div>
             </div>

             <div className="space-y-4 mb-6">
                <div className="bg-black border border-surface-border p-4 rounded-sm">
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Target Entry Fee</p>
                   <p className="text-xl font-black text-white italic tracking-tighter">
                     {joiningMatch.creatorId === user?.uid ? "0.00 (OVERSEER)" : `${joiningMatch.challengeFee} CR`}
                   </p>
                </div>

                {joiningMatch.creatorId !== user?.uid && (
                  <>
                    <div className="space-y-2">
                       <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em]">Your Exact {joiningMatch.game} Name</label>
                       <input
                         type="text"
                         value={inGameName}
                         onChange={e => setInGameName(e.target.value)}
                         placeholder="e.g. xX_Sniper_Xx"
                         className="w-full bg-black border border-surface-border focus:border-accent text-white py-3 px-4 rounded-sm outline-none font-bold text-sm mb-4"
                       />
                    </div>

                    {joiningMatch.isProtected && !joiningMatch.isPartnerTournament && (
                      <div className="space-y-2 mb-4">
                         <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em]">Room Password</label>
                         <input
                           type="password"
                           value={joinPassword}
                           onChange={e => setJoinPassword(e.target.value)}
                           placeholder="Enter Room Password"
                           className="w-full bg-black border border-surface-border focus:border-accent text-white py-3 px-4 rounded-sm outline-none font-bold text-sm"
                         />
                      </div>
                    )}

                    {joiningMatch.isPartnerTournament && profile?.referredBy !== joiningMatch.creatorId && (
                      <div className="space-y-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-sm mb-4">
                        <div className="flex items-center gap-2 mb-1">
                           <ShieldCheck className="w-3 h-3 text-yellow-500" />
                           <label className="text-[9px] text-yellow-500 font-black uppercase tracking-[0.2em]">Neural Clearance Required</label>
                        </div>
                        <input
                          type="text"
                          value={joinReferralCode}
                          onChange={e => setJoinReferralCode(e.target.value.toUpperCase())}
                          placeholder="ENTER PARTNER CODE"
                          className="w-full bg-black border border-yellow-500/30 focus:border-yellow-500 text-yellow-500 py-3 px-4 rounded-sm outline-none font-black text-sm tracking-widest transition-all text-center"
                        />
                        <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest text-center">Required for non-recruits to join this Creator Cup.</p>
                      </div>
                    )}
                  </>
                )}
                
                {joiningMatch.creatorId === user?.uid && (
                  <p className="text-[10px] text-yellow-500/60 font-bold uppercase tracking-widest text-center py-2 italic">
                    Entering as Overseer. No rewards/fee applied.
                  </p>
                )}
             </div>

             <div className="flex gap-3">
               <button onClick={() => setJoiningMatch(null)} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-500 hover:text-white border border-surface-border hover:bg-black rounded-sm">Cancel</button>
               <button 
                 onClick={confirmJoin}
                 disabled={!!(joinLoading || (user && joiningMatch.creatorId !== user?.uid && !inGameName.trim()))}
                 className={`flex-1 py-3 text-[10px] font-black uppercase shadow-lg rounded-sm flex justify-center disabled:opacity-20 ${joiningMatch.isPartnerTournament ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-accent hover:bg-accent-hover text-black'}`}
               >
                 {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (!user ? "Sign Up to Deploy" : "Verify & Deploy")}
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
