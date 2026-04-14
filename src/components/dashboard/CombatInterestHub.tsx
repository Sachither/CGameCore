"use client";
import React, { useEffect, useState } from "react";
import { getChallengeInterestCount, registerChallengeInterest, unregisterChallengeInterest } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2, Users, Swords, Trophy, ShieldCheck, User, Lock, ArrowLeftRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface InterestCardProps {
  game: 'CODM' | 'EFOOTBALL';
  segment: '1v1' | 'br' | 'ffa' | 'tournament' | 'alcatraz';
  weekendOnly?: boolean;
  title: string;
  quota: number;
  icon: React.ReactNode;
  onRegistered: () => void;
}

const InterestCard = ({ game, segment, title, quota, icon, onRegistered, weekendOnly }: InterestCardProps) => {
  const { user, profile } = useAuth();
  const router = useRouter();
  const [count, setCount] = useState<number>(0);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [localTagName, setLocalTagName] = useState("");
  const [error, setError] = useState("");

  const profileTag = game === 'CODM' ? profile?.codTag : profile?.efootballTag;
  const hasTag = !!profileTag && profileTag !== "Unknown";

  useEffect(() => {
    if (!user?.uid) return;

    const queueId = `${game.toLowerCase()}_${segment}`;
    const unsub = onSnapshot(doc(db, "queues", queueId), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Match creation relies on backend response for the active user, 
        // and MatchReadyDispatcher for passive waiting users.

        const playerIds = data.playerIds || [];
        setCount(playerIds.length);
        setIsRegistered(playerIds.includes(user.uid));
      } else {
        setCount(0);
        setIsRegistered(false);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [game, segment, user?.uid]);

  useEffect(() => {
    if (hasTag) {
      setLocalTagName(profileTag);
    }
  }, [hasTag, profileTag]);

  const handleRegister = async () => {
    if (!user || !profile) return;
    
    // Final balance check before sending to server
    if ((profile.balanceCoins || 0) < 500 && !isRegistered) {
      setError(`ABORTED: You need 500 CR to vault. Current balance: ${profile.balanceCoins || 0} CR.`);
      setShowConfirm(false);
      return;
    }

    const finalInGameName = hasTag ? profileTag : localTagName;
    if (!finalInGameName || finalInGameName.length < 3 || finalInGameName === "Unknown") {
      setError("MISSION ABORTED: Valid In-Game ID required (min 3 chars).");
      return;
    }

    setRegistering(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const result: any = await registerChallengeInterest(
        idToken,
        profile.username,
        profile.avatarId,
        game,
        segment,
        500, // fee
        finalInGameName
      );
      
      if (result.matchCreated) {
        if (result.matchId) {
          router.push(`/match/${result.matchId}`);
        } else if (result.circuitId) {
          router.push(`/dashboard/tournaments/view/${result.circuitId}`);
        }
        return;
      }

      setShowConfirm(false);
      onRegistered();
    } catch (err: any) {
      setError(err.message || "Failed to register interest.");
    }
    setRegistering(false);
  };

  const handleUnregister = async () => {
    if (!user || registering) return;
    setRegistering(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      await unregisterChallengeInterest(idToken, game, segment, 500);
      
      const fresh = await getChallengeInterestCount(game, segment, user.uid);
      setCount(fresh.count);
      setIsRegistered(fresh.isRegistered);
      onRegistered();
    } catch (err: any) {
      setError(err.message || "Failed to leave queue.");
    }
    setRegistering(false);
  };

  const progress = Math.min((count / quota) * 100, 100);

  // weekend gate: 0=Sun, 5=Fri, 6=Sat
  const dayOfWeek = new Date().getDay();
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 5 || dayOfWeek === 6;
  const isLocked = weekendOnly && !isWeekend;

  return (
    <div className="bg-surface border border-surface-border rounded-sm p-5 hover:border-accent/40 transition-all group relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      
      <div className="flex items-start justify-between relative z-10 mb-4">
        <div className="p-2.5 bg-black border border-surface-border rounded-[3px] text-accent group-hover:scale-110 transition-transform">
          {icon}
        </div>
        <div className="text-right">
          <div className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Fee</div>
          <div className="text-sm font-black italic text-main tracking-tighter">500 CR</div>
        </div>
      </div>

      <div className="relative z-10">
        <h3 className="text-base font-black italic uppercase text-white tracking-tight mb-1">{title}</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{game} Edition</p>
        {weekendOnly ? (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[2px] bg-orange-500/10 text-orange-400 border border-orange-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
            Fri – Sun Only
          </span>
        ) : isRegistered && (
          <span className="inline-flex items-center gap-1 mt-1.5 text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-[2px] bg-accent/10 text-accent border border-accent/20">
             <ShieldCheck className="w-2.5 h-2.5" />
             Credits Vaulted
          </span>
        )}
      </div>

      <div className="mt-6 relative z-10">
        <div className="flex justify-between items-end mb-2">
          <span className="text-[10px] font-black uppercase tracking-widest text-accent">Combat Group</span>
          <span className="text-xs font-black italic text-main">
            {loading ? <Loader2 className="w-3 h-3 animate-spin inline" /> : `${count}/${quota}`}
          </span>
        </div>
        <div className="h-1 bg-black border border-surface-border rounded-full overflow-hidden">
          <div 
            className="h-full bg-accent shadow-[0_0_8px_rgba(0,255,102,0.6)] transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 relative z-10 space-y-3">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 p-2 rounded-sm animate-in slide-in-from-top-1">
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest text-center">{error}</p>
          </div>
        )}

        {isLocked ? (
          <div className="w-full bg-gray-900/80 border border-orange-500/20 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest text-center text-orange-500/60 flex items-center justify-center gap-2 cursor-not-allowed">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500/40 inline-block" />
            Opens Friday
          </div>
        ) : isRegistered ? (
          <div className="space-y-2">
            <div className="w-full bg-accent/10 border border-accent/20 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest text-center text-accent flex items-center justify-center gap-2">
               <ShieldCheck className="w-3 h-3" />
               In Queue (Vaulted)
            </div>
            <button 
              onClick={handleUnregister}
              disabled={registering}
              className="w-full text-center text-[9px] font-black uppercase tracking-widest text-gray-500 hover:text-red-500 transition-colors flex items-center justify-center gap-1.5"
            >
              {registering ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : (
                <>
                  <ArrowLeftRight className="w-2.5 h-2.5" />
                  Leave Queue & Return Credits
                </>
              )}
            </button>
          </div>
        ) : !showConfirm ? (
          <button 
            onClick={() => {
              setError("");
              setShowConfirm(true);
            }}
            className="w-full bg-accent hover:bg-accent/80 text-black py-2.5 rounded-sm text-xs font-black uppercase tracking-widest transition-all hover:scale-[1.02] active:scale-95 shadow-[0_0_20px_rgba(var(--accent-rgb),0.2)] hover:shadow-[0_0_30px_rgba(var(--accent-rgb),0.4)]"
          >
            Register Interest
          </button>
        ) : (
          <div className="bg-black border border-accent/20 p-3 rounded-sm space-y-3 animate-in fade-in slide-in-from-bottom-1">
             <div className="flex items-center gap-2 text-[9px] text-gray-400 leading-tight">
                <ShieldCheck className="w-3 h-3 text-accent shrink-0" />
                <span>500 Credits will be moved to the Secure Vault and held until the quota is met.</span>
             </div>

             {!hasTag && (
               <div className="space-y-2 animate-in fade-in duration-300">
                 <label className="block text-[9px] font-bold uppercase tracking-widest text-sub">One-Time Identity Link ({game})</label>
                 <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-500" />
                    <input 
                      type="text"
                      placeholder="Enter In-Game ID..."
                      value={localTagName}
                      onChange={(e) => setLocalTagName(e.target.value)}
                      className="w-full bg-black border border-surface-border focus:border-accent p-2 pl-8 rounded-sm text-[10px] text-white font-bold outline-none"
                    />
                 </div>
               </div>
             )}
             <div className="flex gap-2">
                <button 
                  onClick={() => setShowConfirm(false)}
                  className="flex-1 bg-surface border border-surface-border text-gray-400 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleRegister}
                  className="flex-1 bg-accent hover:bg-accent-hover text-black py-1.5 rounded-sm text-[10px] font-black uppercase tracking-widest flex items-center justify-center"
                  disabled={registering}
                >
                  {registering ? <Loader2 className="w-3 h-3 animate-spin" /> : "Confirm"}
                </button>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default function CombatInterestHub() {
  const [key, setKey] = useState(0);
  const [lockdownActive, setLockdownActive] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system", "config"), (doc) => {
       if (doc.exists()) {
          setLockdownActive(doc.data().lockdownActive || false);
       }
    });
    return () => unsub();
  }, []);

  return (
    <div className="mt-12">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          High-Stake Combat Queues
        </h2>
        <span className="text-[10px] text-accent font-black uppercase tracking-widest bg-accent/5 px-2 py-1 rounded-sm border border-accent/20 italic">
          Vaulted Entry: 500 Credits
        </span>
      </div>

      {lockdownActive ? (
        <div className="bg-red-500/10 border border-red-500/30 p-8 rounded-sm text-center">
           <Lock className="w-12 h-12 text-red-500 mx-auto mb-4" />
           <h3 className="text-xl font-black text-red-500 uppercase tracking-[0.2em] mb-2">Emergency Lockdown</h3>
           <p className="text-[11px] text-red-400/80 font-bold uppercase tracking-widest">
             Operations are temporarily suspended by Tribunal Command. Matchmaking is currently inactive.
           </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
          {/* COD BR */}
          <InterestCard 
            game="CODM" 
            segment="br" 
            title="Battle Royale" 
            quota={20} 
            icon={<Users className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
          />
          {/* eFootball 1v1 High-Stake */}
          <InterestCard 
            game="EFOOTBALL" 
            segment="1v1" 
            title="Pro Duel EF" 
            quota={2} 
            icon={<Swords className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
          />
          {/* 1v1 High-Stake COD */}
          <InterestCard 
            game="CODM" 
            segment="1v1" 
            title="Pro Duel COD" 
            quota={2} 
            icon={<Swords className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
          />
          {/* COD FFA */}
          <InterestCard 
            game="CODM" 
            segment="ffa" 
            title="Free For All" 
            quota={8} 
            icon={<Users className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
          />
          {/* COD Alcatraz Weekend Blitz */}
          <InterestCard 
            game="CODM" 
            segment="alcatraz" 
            title="Alcatraz Blitz" 
            quota={20} 
            icon={<Trophy className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
            weekendOnly={true}
          />
          {/* eFootball Elite Tournament */}
          <InterestCard 
            game="EFOOTBALL" 
            segment="tournament" 
            title="Elite Tournament" 
            quota={16} 
            icon={<Trophy className="w-5 h-5" />} 
            onRegistered={() => setKey(k => k + 1)}
          />
        </div>
      )}
    </div>
  );
}
