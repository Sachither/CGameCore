import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, query, onSnapshot, orderBy, where, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { registerChallengeInterest, joinMatch } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2, Trophy, Users, ShieldCheck, Flame, Swords, ChevronRight } from "lucide-react";
import CreateChallengeModal from "@/components/dashboard/CreateChallengeModal";
import { useToast } from "@/context/ToastContext";

interface LeagueListing {
  id: string;
  game: string;
  title: string;
  challengeFee: number;
  totalPool: number;
  playerCount: number;
  quota: number;
  format?: string;
  status: 'FILLING' | 'ACTIVE' | 'COMPLETED' | 'GROUPS' | 'KNOCKOUT_Q' | 'KNOCKOUT_S' | 'KNOCKOUT_F' | 'WAITING' | 'READY';
  isGathering?: boolean;
  playerIds?: string[];
  isPartnerTournament?: boolean;
  partnerName?: string;
  creatorId?: string;
}

export default function ActiveTournamentsTable() {
  const { user, profile } = useAuth();
   const [circuits, setCircuits] = useState<LeagueListing[]>([]);
  const [leagues, setLeagues] = useState<LeagueListing[]>([]);
  const [gatherMatches, setGatherMatches] = useState<LeagueListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCounter, setLoadingCounter] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [joiningMatch, setJoiningMatch] = useState<LeagueListing | null>(null);
  const [inGameName, setInGameName] = useState("");
  const [joinReferralCode, setJoinReferralCode] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const router = useRouter();
  const { info: showInfoToast, error: showErrorToast } = useToast();

  useEffect(() => {
    if (profile && joiningMatch) {
      const tag = joiningMatch.game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");
      setJoinReferralCode("");
    }
  }, [profile, joiningMatch]);

  const confirmJoin = async () => {
    if (!user || !profile || !joiningMatch) return;
    
    const isPartnerOverseer = joiningMatch.isPartnerTournament && joiningMatch.creatorId === user.uid;

    if (!inGameName.trim() && !isPartnerOverseer) {
       showErrorToast("Deployment Error", "Please enter your exact In-Game Name.");
       return;
    }
    setJoinLoading(true);
    try {
      const idToken = await user.getIdToken();
      await joinMatch(idToken, profile.username, profile.avatarId, joiningMatch.id, inGameName.trim(), joinReferralCode.trim());
      
      setJoiningMatch(null); // Close modal immediately
      
      if (isPartnerOverseer) {
        showInfoToast("Overseer Link Established", "Entering Command Center as an observer.");
      }
      
      router.push(`/match/${joiningMatch.id}`);
    } catch (err: any) {
      showErrorToast("Deployment Failure", err.message || "Failed to join challenge.");
      if (!err.message?.includes("EXCLUSIVE_ACCESS") && !err.message?.includes("INVALID_CODE")) {
        setJoiningMatch(null);
      }
    }
    setJoinLoading(false);
  };

  useEffect(() => {
    if (!user) return;

    // Reset loading state when user changes
    setLoading(true);
    setLoadingCounter(0);

    // 1. Fetch Circuits from the last 72 hours
    const searchWindow = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const qCircuits = query(
      collection(db, "circuits"),
      where("createdAt", ">", searchWindow)
    );
    const unsubCircuits = onSnapshot(qCircuits, (snap) => {
      const allowedStatuses = ["FILLING", "KNOCKOUT_Q", "KNOCKOUT_S", "KNOCKOUT_F", "ACTIVE"];
      const docs = snap.docs
        .filter(d => allowedStatuses.includes(d.data().status))
        .map(d => {
          const data = d.data();
          // DYNAMIC QUOTA: Support 2, 4, 8, 16 from format, fallback to playerIds count if promo
          const formatQuota = data.format?.split('_')?.[0];
          const quota = data.quota || (formatQuota && !isNaN(parseInt(formatQuota)) ? parseInt(formatQuota) : (data.isPromo ? (data.playerIds?.length || 128) : 16));
          return {
            id: d.id,
            game: data.game,
            title: data.title,
            challengeFee: data.challengeFee || 0,
            totalPool: data.totalPool || 0,
            playerCount: (data.playerIds || []).length,
            quota,
            format: data.format,
            status: data.status,
            isGathering: false,
            playerIds: data.playerIds || [],
            isPromo: data.isPromo,
            createdAt: data.createdAt,
            isPartnerTournament: data.isPartnerTournament || false,
            partnerName: data.partnerName || 'Partner',
            creatorId: data.creatorId
          } as any;
        })
        .sort((a, b) => {
          // Client-side sort by createdAt DESC
          const timeA = a.createdAt?.toMillis?.() || 0;
          const timeB = b.createdAt?.toMillis?.() || 0;
          return timeB - timeA;
        });
      setCircuits(docs);
      
      // Increment loading counter and check if both queries are done
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    }, (err) => {
      console.error("[ActiveTournamentsTable] Circuit Sync failure:", err);
      // Still increment counter even on error to prevent infinite loading
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    });

    // 1.1 Fetch Leagues from the last 72 hours
    const qLeagues = query(
      collection(db, "leagues"),
      where("createdAt", ">", searchWindow)
    );
    const unsubLeagues = onSnapshot(qLeagues, (snap) => {
      const allowedStatuses = ["FILLING", "ACTIVE", "GROUPS"];
      const docs = snap.docs
        .filter(d => allowedStatuses.includes(d.data().status))
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            game: data.game,
            title: data.title,
            challengeFee: data.challengeFee || 0,
            totalPool: data.totalPool || 0,
            playerCount: (data.playerIds || []).length,
            quota: data.quota || 8,
            format: 'MASTER_CIRCUIT', // Map to master circuit style
            status: data.status,
            isGathering: false,
            playerIds: data.playerIds || [],
            isLeague: true,
            createdAt: data.createdAt,
            isPartnerTournament: data.isPartnerTournament || false,
            partnerName: data.partnerName,
            creatorId: data.creatorId
          } as any;
        });
      
      setLeagues(docs);
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    }, (err) => {
      console.error("[ActiveTournamentsTable] League Sync failure:", err);
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    });

    // 2. Fetch Gathering Match Lobbies from the last 72 hours
    const qMatches = query(
      collection(db, "matches"),
      where("createdAt", ">", searchWindow)
    );
    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const allowedStatuses = ["WAITING", "READY"];
      const docs = snap.docs
        .filter(d => {
           const data = d.data();
           return data.format === 'tournament' && allowedStatuses.includes(data.status) && !data.circuitId;
        })
        .map(d => {
          const data = d.data();
          const pCount = data.playerIds ? data.playerIds.length : Object.keys(data.players || {}).length;
          const quota = data.maxPlayers || 16;
          return {
            id: d.id,
            game: data.game,
            title: data.isPartnerTournament ? `${data.partnerName}'s ${data.game} CUP` : `${data.game} TOURNAMENT (GATHERING)`,
            challengeFee: data.challengeFee || 0,
            totalPool: (data.challengeFee || 0) * quota * 0.8,
            playerCount: pCount,
            quota,
            format: data.format,
            status: data.status,
            isGathering: true,
            playerIds: data.playerIds || [],
            isPartnerTournament: data.isPartnerTournament || false,
            partnerName: data.partnerName,
            creatorId: data.creatorId
          } as LeagueListing;
        });
      setGatherMatches(docs);
      
      // Increment loading counter and check if both queries are done
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    }, (err) => {
      console.error("[ActiveTournamentsTable] Match Sync failure:", err);
      // Still increment counter even on error to prevent infinite loading
      setLoadingCounter(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) setLoading(false);
        return newCount;
      });
    });

    return () => { unsubCircuits(); unsubLeagues(); unsubMatches(); };
  }, [user]);

  if (loading) return (
    <div className="flex justify-center py-20 grayscale opacity-20">
      <Loader2 className="w-8 h-8 text-white animate-spin" />
    </div>
  );

  const allComps = [...circuits, ...leagues, ...gatherMatches].sort((a: any, b: any) =>
    (b.status === 'FILLING' || b.status === 'WAITING' || b.status === 'KNOCKOUT_Q' || b.status === 'GROUPS') ? 1 : -1
  );

  return (
    <div className="mt-16">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4 mb-8">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-main italic uppercase tracking-tighter flex items-center gap-3">
            <Trophy className="w-6 h-6 text-accent" />
            Competitive Operational Hub
          </h2>
          <p className="text-[10px] text-sub uppercase font-bold tracking-[0.2em] mt-1 italic opacity-60">Battleground Strategy &amp; Live Results</p>
        </div>
        <div className="flex items-center gap-6">
          <Link 
            href="/dashboard/tournaments/efootball" 
            className="text-[9px] font-black uppercase text-accent hover:text-white border-b border-accent/20 hover:border-white transition-all tracking-[0.2em] pb-1"
          >
            See All Brackets &amp; Standings
          </Link>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-accent hover:bg-accent-hover text-black px-6 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-accent/10"
          >
            Create Competition
          </button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {allComps.length > 0 ? allComps.map((t) => {
          const progress = Math.min(((t.playerCount || 0) / (t.quota || 12)) * 100, 100);
          return (
            <LeagueCard key={t.id} league={t} progress={progress} onJoin={setJoiningMatch} currentUserUid={user?.uid} />
          );
        }) : (
          <div className="md:col-span-2 lg:col-span-3 bg-surface border border-surface-border border-dashed p-16 rounded-sm text-center">
             <Trophy className="w-12 h-12 text-gray-800 mx-auto mb-4 opacity-20" />
             <h3 className="text-sm font-black text-main italic uppercase mb-1">No Active Operations Found</h3>
             <p className="text-[10px] text-sub uppercase font-bold tracking-widest max-w-xs mx-auto">Initiate a new circuit using the Create Competition protocol or join a high-stake queue below.</p>
          </div>
        )}
      </div>

      <CreateChallengeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

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
                         className="w-full bg-black border border-surface-border text-white py-3 px-4 rounded-sm outline-none font-bold text-sm focus:border-accent transition-colors"
                       />
                    </div>

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
                 disabled={joinLoading || (joiningMatch.creatorId !== user?.uid && !inGameName.trim())}
                 className={`flex-1 py-3 text-[10px] font-black uppercase shadow-lg rounded-sm flex justify-center disabled:opacity-20 ${joiningMatch.isPartnerTournament ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-accent hover:bg-accent-hover text-black'}`}
               >
                 {joinLoading ? <Loader2 className="w-4 h-4 animate-spin text-black" /> : "Confirm Deployment"}
               </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}

function LeagueCard({ league: t, progress, onJoin, currentUserUid }: { league: LeagueListing, progress: number, onJoin: (t: LeagueListing) => void, currentUserUid: string | undefined }) {
  // Tournament-only: circuits go to the War Room, gathering goes to match lobby
  let detailHref = `/dashboard/tournaments/view/${t.id}`;
  if (t.isGathering) detailHref = `/match/${t.id}`;
  const isCircuit = !t.isGathering;

  const isPromo = (t as any).isPromo;
  const isPartner = !!t.isPartnerTournament;
  
  const formatLabel = isPartner ? 'CREATOR CUP' : (isPromo ? `PROMO RUSH (${t.quota}P)` : 'ELITE KNOCKOUT (16P)');
  
  return (
    <div className={`group relative bg-surface border rounded-sm transition-all duration-300 overflow-hidden flex flex-col shadow-2xl hover:scale-[1.02] ${isPartner ? 'border-yellow-500/40 shadow-yellow-500/5' : 'border-surface-border hover:border-accent/40'}`}>
      <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-${isPartner ? 'yellow-500' : 'accent'} to-transparent opacity-20 group-hover:opacity-100 transition-opacity`}></div>
      
      <div className="p-6 flex-1">
        <div className="flex justify-between items-start mb-6">
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-black border rounded-sm ${isPartner ? 'border-yellow-500/30 text-yellow-500' : 'border-surface-border text-gray-400'}`}>
            {formatLabel}
          </span>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${['FILLING','GROUPS','KNOCKOUT_Q', 'WAITING'].includes(t.status) ? (isPartner ? 'bg-yellow-500/10 text-yellow-500 animate-pulse' : 'bg-accent/10 text-accent animate-pulse') : 'bg-blue-500/10 text-blue-400'}`}>
            {t.status === 'GROUPS' ? 'GROUP STAGE' : t.status === 'KNOCKOUT_Q' ? 'KNOCKOUT' : t.status}
          </span>
        </div>

        <h3 className={`text-2xl font-black italic uppercase tracking-tighter mb-1 transition-colors ${isPartner ? 'text-yellow-500 group-hover:text-yellow-400' : 'text-white group-hover:text-accent'}`}>
          {t.title}
        </h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-8">
          {isPartner ? `Influence by ${t.partnerName}` : 'Active Championship Race'}
        </p>

        <div className="space-y-6">
          <div className="flex justify-between items-end border-b border-surface-border/50 pb-4">
            <div className="text-[9px] text-sub font-black uppercase tracking-widest">Victory Pool</div>
            <div className={`text-2xl font-black italic tracking-tight ${isPartner ? 'text-yellow-500' : 'text-accent'}`}>{Math.floor(t.totalPool || 0).toLocaleString()} CR</div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
              <span className="text-gray-500">Deployment Status</span>
              <span className="text-white">{t.playerCount || 0} / {t.quota} PLYRs</span>
            </div>
            <div className="h-1 bg-black rounded-full overflow-hidden border border-surface-border">
              <div 
                className={`h-full transition-all duration-1000 ${isPartner ? 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]' : 'bg-accent shadow-[0_0_10px_rgba(0,255,102,0.5)]'}`} 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="p-6 pt-0">
        {!t.isGathering ? (
          <Link href={detailHref}>
            <button className={`w-full py-4 font-black uppercase tracking-widest text-[10px] rounded-sm transition-all shadow-lg active:scale-95 ${isPartner ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-white hover:bg-accent text-black'}`}>
              {isCircuit 
                ? (currentUserUid && (t.playerIds?.includes(currentUserUid) || t.creatorId === currentUserUid) ? 'Enter War Room' : 'Observe War Room') 
                : 'View Rankings Standings'}
            </button>
          </Link>
        ) : (
          <button 
             onClick={() => {
                const isFull = (t.playerCount || 0) >= (t.quota || 16);
                const isAlreadyPlayer = currentUserUid && t.playerIds && t.playerIds.includes(currentUserUid);
                const isOverseer = currentUserUid === t.creatorId && isPartner;
                if (isAlreadyPlayer || isFull || isOverseer) {
                   window.location.href = detailHref;
                } else {
                   onJoin(t);
                 }
             }}
             className={`w-full py-4 font-black uppercase tracking-widest text-[10px] rounded-sm transition-all shadow-lg active:scale-95 ${(currentUserUid && t.playerIds && t.playerIds.includes(currentUserUid)) || (currentUserUid === t.creatorId && isPartner) ? (isPartner ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-accent text-black hover:bg-white') : ((t.playerCount || 0) >= (t.quota || 16)) ? 'bg-surface-hover text-gray-400 border border-surface-border hover:text-white hover:border-accent' : (isPartner ? 'bg-yellow-500 hover:bg-yellow-600 text-black' : 'bg-accent hover:bg-accent-hover text-black shadow-accent/20')}`}
          >
            {(() => {
              const isAlreadyPlayer = currentUserUid && t.playerIds && t.playerIds.includes(currentUserUid);
              const isOverseer = currentUserUid === t.creatorId && isPartner;
              
              if (isAlreadyPlayer) {
                // Determine if eliminated
                // Note: In 16_TOURNAMENT, if round1Winners/qfWinners/sfWinners exist and user is not in them, they are eliminated.
                 const isEliminated = t.playerIds && t.playerIds.includes(currentUserUid) && (
                    (t.status === 'KNOCKOUT_Q' && (t as any).round1Winners?.length > 0 && !(t as any).round1Winners.includes(currentUserUid)) ||
                    (t.status === 'KNOCKOUT_S' && (t as any).qfWinners?.length > 0 && !(t as any).qfWinners.includes(currentUserUid)) ||
                    (t.status === 'KNOCKOUT_F' && (t as any).sfWinners?.length > 0 && !(t as any).sfWinners.includes(currentUserUid))
                 );

                if (isEliminated) return 'Eliminated // View Standings';
                return 'Return to Lobby';
              }
              
              if (isOverseer) return 'Enter Command Center';
              if ((t.playerCount || 0) >= (t.quota || 16)) return 'Observe Lobby';
              return 'Deploy (Join Lobby)';
            })()}
          </button>
        )}
      </div>
    </div>
  );
}
