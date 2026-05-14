"use client";
import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Match, joinMatch } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2, Swords, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/context/ToastContext";

export default function ChallengesExplorerPage() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [challenges, setChallenges] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchFee, setSearchFee] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<'ALL' | 'CODM' | 'EFOOTBALL'>('ALL');
  const [joiningMatch, setJoiningMatch] = useState<Match | null>(null);
  const [inGameName, setInGameName] = useState("");
  const [joinReferralCode, setJoinReferralCode] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "matches"),
      where("status", "==", "WAITING")
    );

    const unsub = onSnapshot(q, (snap) => {
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() } as Match))
        .filter(d => isLocal || !d.isTestMode);
      setChallenges(docs);
      setLoading(false);
    }, (err) => {
      console.error("[ChallengesExplorer] Sync failure:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [user]);

  // IDENTITY SYNC: Auto-populate IGN from profile when selecting a match to join
  useEffect(() => {
    if (profile && joiningMatch) {
      const tag = joiningMatch.game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");
      setJoinReferralCode("");
      setJoinPassword("");
    }
  }, [profile, joiningMatch]);

  const confirmJoin = async () => {
    if (!user || !profile || !joiningMatch) return;
    if (!inGameName.trim()) {
      toast.error("Deployment Error", "Please enter your exact In-Game Name.");
      return;
    }
    setJoinLoading(true);
    try {
      const idToken = await user.getIdToken();
      await joinMatch(
        idToken, 
        profile.username, 
        profile.avatarId, 
        joiningMatch.id!, 
        inGameName.trim(), 
        joinReferralCode.trim() || undefined, 
        joiningMatch.isProtected ? joinPassword : undefined
      );
      router.push(`/match/${joiningMatch.id}`);
    } catch (err: any) {
      toast.error("Tactical Error", err.message || "Failed to join duel.");
      setJoiningMatch(null);
    }
    setJoinLoading(false);
  };

  const filteredChallenges = challenges.filter(c => {
    const matchesGame = selectedGame === 'ALL' || c.game === selectedGame;
    const matchesFee = !searchFee || c.challengeFee.toString().includes(searchFee);
    return matchesGame && matchesFee;
  });

  if (loading) {
    return (
      <div className="w-full min-h-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <p className="text-[10px] font-black uppercase text-gray-500 tracking-widest mt-4">Scanning Operations Theaters...</p>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-10">
          <button 
            onClick={() => router.push('/dashboard')}
            className="text-gray-500 hover:text-white mb-6 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> Back to Basecamp
          </button>
          
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter mb-2">
            Operations <span className="text-accent underline decoration-accent/30 underline-offset-8">Explorer</span>
          </h1>
          <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em]">Direct Neural Link to all Active Combat Arenas</p>
        </div>

        {/* Filters */}
        <div className="bg-surface border border-surface-border p-8 rounded-sm mb-12 flex flex-col lg:flex-row gap-8 items-center relative overflow-hidden shadow-2xl">
           <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-3xl pointer-events-none rounded-full" />
           
           <div className="flex-1 w-full relative z-10">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sub mb-4 block italic">Victory Credit Calibration</label>
              <div className="relative group">
                 <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-accent transition-colors" />
                 <input 
                   type="number"
                   value={searchFee}
                   onChange={(e) => setSearchFee(e.target.value)}
                   placeholder="Enter Minimum Credits..."
                   className="w-full bg-black border border-surface-border p-5 pl-14 text-sm text-white font-black italic rounded-sm focus:border-accent outline-none transition-all placeholder:text-gray-800"
                 />
              </div>
           </div>

           <div className="w-full lg:w-auto relative z-10">
              <label className="text-[10px] font-black uppercase tracking-[0.3em] text-sub mb-4 block italic">Combat Category</label>
              <div className="flex flex-wrap gap-3">
                 {(['ALL', 'CODM', 'EFOOTBALL'] as const).map(g => (
                   <button 
                     key={g}
                     onClick={() => setSelectedGame(g)}
                     className={`px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] rounded-sm border transition-all ${selectedGame === g ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'bg-black text-gray-500 border-surface-border hover:border-accent/40'}`}
                   >
                     {g}
                   </button>
                 ))}
              </div>
           </div>
        </div>

        {/* Results Grid */}
        {filteredChallenges.length === 0 ? (
          <div className="bg-surface/30 border border-surface-border border-dashed p-20 rounded-sm text-center">
             <Swords className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
             <p className="text-xs text-gray-600 font-black uppercase tracking-widest leading-relaxed">
               No active tactical requests match your current filters.<br/>
               <span className="text-[10px] text-gray-800 mt-2 block">Try adjusting your search criteria or initiate a new duel.</span>
             </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredChallenges.map(c => {
               const creator = Object.values(c.players).find(p => p.uid === c.creatorId);
               const isFull = Object.keys(c.players).length >= (c.format === '1v1' ? 2 : 10);

               return (
                 <div key={c.id} className="bg-surface border border-surface-border p-6 rounded-sm relative group hover:border-accent transition-all overflow-hidden">
                    {/* Status Badge */}
                    <div className="absolute top-0 right-0 p-3 z-10">
                       <span className={`text-[8px] font-black uppercase tracking-[0.2em] px-2 py-1 rounded-[2px] ${isFull ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 'bg-accent/10 text-accent border border-accent/20'}`}>
                          {isFull ? 'LOCKDOWN' : 'LIVE COMM'}
                       </span>
                    </div>

                    <div className="flex items-center gap-4 mb-8">
                       <div className="w-14 h-14 bg-black border border-surface-border rounded-sm rotate-45 flex items-center justify-center overflow-hidden shrink-0 group-hover:scale-110 transition-transform">
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
                           <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-1">{c.format} Duel</p>
                           <h3 className="text-xl font-black text-white italic uppercase tracking-tighter group-hover:text-accent transition-colors leading-none flex items-center gap-2">
                              {c.isProtected && <svg className="w-4 h-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                              {c.roomName || creator?.username || "Operator"}
                           </h3>
                        </div>
                    </div>

                    <div className="space-y-4 mb-8">
                       <div className="flex justify-between items-center py-2 border-b border-surface-border/50">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Victory Grant</span>
                          <span className="text-base font-black italic text-main tracking-tighter">{c.challengeFee} CR</span>
                       </div>
                       <div className="flex justify-between items-center py-2 border-b border-surface-border/50">
                          <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">Theater</span>
                          <span className="text-[10px] font-black uppercase tracking-widest text-white">{c.game}</span>
                       </div>
                    </div>

                    <button 
                      onClick={() => {
                        if (!user) {
                          router.push(`/register?callback=/dashboard/challenges?join=${c.id}`);
                          return;
                        }
                        if (!isFull) {
                          setJoiningMatch(c);
                        } else {
                          router.push(`/match/${c.id}`);
                        }
                      }}
                      className={`w-full py-4 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 transition-all ${
                        !user 
                          ? 'bg-accent text-black hover:bg-accent-hover' 
                          : (isFull ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-accent hover:bg-accent-hover text-black shadow-[0_0_20px_rgba(0,255,102,0.1)]')
                      }`}
                    >
                      {!user 
                        ? (isFull ? "Sign Up to Observe" : "Sign Up / Login to Join")
                        : isFull 
                          ? (c.creatorId === user?.uid ? "Enter War Room" : "Observe Mission") 
                          : "Initiate Combat Link"
                      }
                      <ChevronRight className="w-4 h-4" />
                    </button>
                 </div>
               );
            })}
          </div>
        )}
      </div>

      {/* JOIN CONFIRMATION MODAL WITH IGN CAPTURE */}
      {joiningMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setJoiningMatch(null)} />
          <div className="bg-surface border border-surface-border w-full max-w-sm rounded-sm relative overflow-hidden animate-in zoom-in-95 fade-in duration-200 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-accent/20 p-2 rounded-full"><Swords className="w-5 h-5 text-accent" /></div>
              <div>
                <h3 className="text-sm font-black uppercase text-white italic tracking-tighter">Combat Briefing</h3>
                <p className="text-[9px] font-bold text-gray-500 uppercase tracking-widest">Pre-Deployment Validation</p>
              </div>
            </div>

            <div className="space-y-4 mb-6">
              <div className="bg-black border border-surface-border p-4 rounded-sm">
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Entry Fee</p>
                <p className="text-xl font-black text-white italic tracking-tighter">{joiningMatch.challengeFee} CR</p>
              </div>

              <div className="space-y-2">
                <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em] block">
                  Your Exact {joiningMatch.game} Name
                </label>
                <input
                  type="text"
                  value={inGameName}
                  onChange={e => setInGameName(e.target.value)}
                  placeholder="e.g. xX_Sniper_Xx"
                  className="w-full bg-black border border-surface-border focus:border-accent text-white py-3 px-4 rounded-sm outline-none font-bold text-sm transition-colors mb-4"
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
                     className="w-full bg-black border border-surface-border focus:border-accent text-white py-3 px-4 rounded-sm outline-none font-bold text-sm transition-colors"
                   />
                </div>
              )}

              {joiningMatch.isPartnerTournament && profile?.referredBy !== joiningMatch.creatorId && (
                <div className="space-y-3 p-4 bg-yellow-500/5 border border-yellow-500/20 rounded-sm mb-4">
                  <div className="flex items-center gap-2 mb-1">
                     <svg className="w-3 h-3 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
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
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setJoiningMatch(null)}
                className="flex-1 py-3 text-[10px] font-black uppercase text-gray-500 hover:text-white border border-surface-border hover:bg-black rounded-sm transition-all"
              >
                Cancel
              </button>
              <button
                onClick={confirmJoin}
                disabled={!!(joinLoading || (user && !inGameName.trim()))}
                className="flex-1 py-3 text-[10px] font-black uppercase bg-accent hover:bg-accent-hover text-black shadow-lg rounded-sm flex justify-center disabled:opacity-20 transition-all"
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
