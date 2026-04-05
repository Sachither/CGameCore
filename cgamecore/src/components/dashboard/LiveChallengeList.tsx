"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Match, joinMatch } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { Loader2, Swords, User, ChevronRight, Plus, Search } from "lucide-react";
import CreateChallengeModal from "./CreateChallengeModal";

export default function LiveChallengeList() {
  const { user, profile } = useAuth();
  const [challenges, setChallenges] = useState<Match[]>([]);
  const [searchFee, setSearchFee] = useState<string>("");
  const [selectedGame, setSelectedGame] = useState<'ALL' | 'CODM' | 'EFOOTBALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [joiningMatch, setJoiningMatch] = useState<Match | null>(null);
  const [inGameName, setInGameName] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Query only by status to avoid composite index requirement. Sort on client.
    const q = query(
      collection(db, "matches"),
      where("status", "==", "WAITING")
    );

      const unsub = onSnapshot(q, (snap) => {
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
        // Client-side sort by createdAt
        const sorted = docs
          .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
          .slice(0, 10);
        
        setChallenges(sorted);
        setLoading(false);
      });

    return () => unsub();
  }, []);

  // Sync game username from profile when joining
  useEffect(() => {
    if (profile && joiningMatch) {
      const tag = joiningMatch.game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");
    }
  }, [profile, joiningMatch]);

  const confirmJoin = async () => {
    if (!user || !profile || !joiningMatch) return;
    if (!inGameName.trim()) {
       alert("Please enter your exact In-Game Name.");
       return;
    }
    setJoinLoading(true);
    try {
      const idToken = await user.getIdToken();
      await joinMatch(idToken, profile.username, profile.avatarId, joiningMatch.id!, inGameName.trim());
      router.push(`/match/${joiningMatch.id}`);
    } catch (err: any) {
      alert(err.message || "Failed to join challenge.");
      setJoiningMatch(null);
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
      <div className="flex items-center gap-4 mb-6">
          <button 
             disabled
             className="bg-red-500/5 border border-red-500/10 text-red-500/30 px-3 py-2 rounded-sm text-[9px] font-black uppercase tracking-widest cursor-not-allowed"
          >
             System Cleanup Restricted
          </button>
          
          <button 
            onClick={() => setIsCreateOpen(true)}
            className="ml-auto bg-accent-aware/10 border border-accent/20 hover:border-accent/40 text-accent-aware font-black uppercase tracking-widest px-4 py-2 rounded-sm text-[10px] flex items-center gap-2 transition-all group"
          >
            <Plus className="w-3 h-3 group-hover:rotate-90 transition-transform" />
            Host Match
          </button>
      </div>

      {challenges.length === 0 ? (
        <div className="bg-surface/50 border border-surface-border border-dashed p-10 rounded-sm text-center">
           <Swords className="w-8 h-8 text-gray-700 mx-auto mb-3 opacity-20" />
           <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">No active duels found.</p>
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-4 pb-6 snap-x snap-mandatory no-scrollbar">
          {challenges.map((c) => {
            const creator = Object.values(c.players).find(p => p.uid === c.creatorId);
            
            const target = c.maxPlayers || 2;

            const current = Object.keys(c.players).length;
            const isFull = current >= target;
            
            return (
              <div 
                key={c.id} 
                className="min-w-[280px] sm:min-w-[320px] snap-start bg-surface border border-surface-border p-5 rounded-sm relative group hover:border-accent/40 transition-all"
              >
                {isFull && (
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-20 flex items-center justify-center rounded-sm">
                      <div className="border-2 border-red-500/50 px-4 py-2 rotate-[-10deg] shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                         <span className="text-red-500 font-black italic uppercase tracking-[0.3em] text-xs">Arena Locked</span>
                      </div>
                   </div>
                )}

                <div className="flex items-center gap-4 mb-5">
                  <div className="w-12 h-12 bg-black border border-surface-border rounded-sm rotate-45 flex items-center justify-center overflow-hidden shrink-0">
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
                    <div className="text-white font-black italic uppercase tracking-tighter text-base group-hover:text-accent transition-colors">
                      {creator?.username || "Operator"}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] ${c.game === 'CODM' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-500'}`}>
                        {c.game}
                      </span>
                      <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] bg-white/5 text-sub border border-white/10">
                        {c.format}
                      </span>
                      {c.weaponClass && c.weaponClass !== 'NONE' && (
                        <span className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-[2px] bg-white text-black">
                          {c.weaponClass}
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

                <button 
                  onClick={() => !isFull && setJoiningMatch(c)}
                  disabled={isFull}
                  className={`w-full py-3 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${isFull ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-main hover:bg-main-hover text-accent shadow-[0_0_15px_rgba(0,255,102,0.1)]'}`}
                >
                  {isFull ? "Host Assignment Pending" : "Join Combat Duel"}
                  {!isFull && <ChevronRight className="w-3 h-3" />}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {isCreateOpen && (
        <CreateChallengeModal 
          isOpen={isCreateOpen} 
          onClose={() => setIsCreateOpen(false)} 
        />
      )}

      {/* JOIN CONFIRMATION MODAL WITH IGN CAPTURE */}
      {joiningMatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
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
                   <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Target Entry Fee</p>
                   <p className="text-xl font-black text-white italic tracking-tighter">{joiningMatch.challengeFee} CR</p>
                </div>

                <div className="space-y-2">
                   <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em]">Your Exact {joiningMatch.game} Name</label>
                   <input
                     type="text"
                     value={inGameName}
                     onChange={e => setInGameName(e.target.value)}
                     placeholder="e.g. xX_Sniper_Xx"
                     className="w-full bg-black border border-surface-border focus:border-accent text-white py-3 px-4 rounded-sm outline-none font-bold text-sm"
                   />
                   <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase tracking-widest">Required for opponents to add you in-game.</p>
                </div>
             </div>

             <div className="flex gap-3">
               <button onClick={() => setJoiningMatch(null)} className="flex-1 py-3 text-[10px] font-black uppercase text-gray-500 hover:text-white border border-surface-border hover:bg-black rounded-sm">Cancel</button>
               <button 
                 onClick={confirmJoin}
                 disabled={joinLoading || !inGameName.trim()}
                 className="flex-1 py-3 text-[10px] font-black uppercase bg-accent hover:bg-accent-hover text-black shadow-lg rounded-sm flex justify-center disabled:opacity-20"
               >
                 {joinLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Deploy"}
               </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
