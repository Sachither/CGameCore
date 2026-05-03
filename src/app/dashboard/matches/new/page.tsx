"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { createMatch } from '@/lib/match-service';
import { checkDuplicateEntryFee } from '@/lib/validation-utils';
import Link from 'next/link';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import CreateChallengeModal from '@/components/dashboard/CreateChallengeModal';
import { Loader2, Trophy, Users, Flame, AlertCircle, ChevronRight } from 'lucide-react';
import { getSystemConfigClient, SystemConfig, DEFAULT_CONFIG } from '@/lib/system-config';

interface Tournament {
  id: string;
  game: string;
  title: string;
  format: string;
  challengeFee: number;
  playerCount: number;
  quota: number;
  status: string;
  totalPool: number;
  createdAt?: any;
  isProtected?: boolean;
}

export default function CreateMatchPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [game, setGame] = useState<'CODM' | 'EFOOTBALL'>('CODM');  const [format, setFormat] = useState<'1v1' | 'FFA' | 'tournament' | 'br' | 'alcatraz'>('1v1');
  const [weaponClass, setWeaponClass] = useState<'ALL GUNS' | 'SHOTGUN' | 'SNIPER'>('ALL GUNS');
  const [duration, setDuration] = useState<'12m' | '15m'>('15m');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [stake, setStake] = useState<number>(50);
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  
  // Tournament section state
  const [matchesLoading, setMatchesLoading] = useState(true);
  const [circuitsLoading, setCircuitsLoading] = useState(true);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [duplicateWarning, setDuplicateWarning] = useState<Tournament | null>(null);
  const [isCreateTournamentOpen, setIsCreateTournamentOpen] = useState(false);
  const [joiningTournament, setJoiningTournament] = useState<Tournament | null>(null);
  const [joinInGameName, setJoinInGameName] = useState("");
  const [joinPassword, setJoinPassword] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);
  const [config, setConfig] = useState<SystemConfig>(DEFAULT_CONFIG);

  // Fetch system config
  useEffect(() => {
    getSystemConfigClient().then(setConfig);
  }, []);

  // Sync game username from profile
  useEffect(() => {
    if (profile) {
      const tag = game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");

      // PARTNER SYNC: For free matches, default password to their promo/referral code
      if (profile.role === 'PARTNER' && stake === 0) {
        if (!roomPassword && profile.myReferralCode) {
           setRoomPassword(profile.myReferralCode.toUpperCase());
        }
        if (!roomName) {
           setRoomName(`${profile.username.toUpperCase()} PRACTICE`);
        }
      }
    }
  }, [profile, game, stake]);

  // Sync join in-game name when a tournament is selected
  useEffect(() => {
    if (profile && joiningTournament) {
      const tag = joiningTournament.game === 'CODM' ? profile.codTag : profile.efootballTag;
      setJoinInGameName(tag || "");
    }
  }, [profile, joiningTournament]);

  // Fetch active tournaments
  useEffect(() => {
    if (!user) return;

    // Fetch gathering tournaments (in WAITING/READY status)
    const qMatches = query(
      collection(db, "matches"),
      where("format", "==", "tournament"),
      where("status", "in", ["WAITING", "READY"])
    );
    const unsubMatches = onSnapshot(qMatches, (snap) => {
      const docs = snap.docs
        .filter(d => !d.data().circuitId) // Exclude spawned sub-matches
        .map(d => {
          const data = d.data();
          const pCount = data.playerIds ? data.playerIds.length : 0;
          return {
            id: d.id,
            game: data.game,
            title: data.roomName || `${data.game} Tournament`,
            format: 'tournament',
            challengeFee: data.challengeFee || 0,
            playerCount: pCount,
            quota: data.maxPlayers || 16,
            status: data.status,
            totalPool: (data.challengeFee || 0) * (data.maxPlayers || 16) * (1 - config.matchFeePercentage),
            createdAt: data.createdAt,
            isProtected: data.isProtected || false
          } as Tournament;
        })
        // Sort by creation date (newest first) in JavaScript to avoid composite index
        .sort((a: any, b: any) => {
          const aTime = a.createdAt?.seconds || 0;
          const bTime = b.createdAt?.seconds || 0;
          return bTime - aTime;
        });
      setTournaments(prevTournaments => {
        const circuitTournaments = prevTournaments.filter(t => t.status === 'FILLING' || t.status === 'GROUPS' || t.status === 'KNOCKOUT_Q');
        return [...docs, ...circuitTournaments];
      });
      setMatchesLoading(false);
    }, (err) => {
      console.error("[CreateMatch] Tournament fetch error:", err);
      setMatchesLoading(false);
    });

    // Fetch active circuits (in FILLING status)
    const qCircuits = query(
      collection(db, "circuits"),
      orderBy("createdAt", "desc")
    );
    const unsubCircuits = onSnapshot(qCircuits, (snap) => {
      const docs = snap.docs
        .filter(d => {
          const data = d.data();
          return !data.title?.includes('MASTER_CIRCUIT') && (data.status === 'FILLING');
        })
        .map(d => {
          const data = d.data();
          return {
            id: d.id,
            game: data.game,
            title: data.roomName || data.title,
            format: 'tournament',
            challengeFee: data.challengeFee || 0,
            playerCount: (data.playerIds || []).length,
            quota: 16,
            status: data.status,
            totalPool: data.totalPool || 0,
            isProtected: data.isProtected || false
          } as Tournament;
        });
      setTournaments(prevTournaments => {
        const gatheringTournaments = prevTournaments.filter(t => t.status === 'WAITING' || t.status === 'READY');
        return [...docs, ...gatheringTournaments];
      });
      setCircuitsLoading(false);
    }, (err) => {
      console.error("[CreateMatch] Circuit fetch error:", err);
      setCircuitsLoading(false);
    });

    return () => { unsubMatches(); unsubCircuits(); };
  }, [user]);

  // Check for duplicate entry fee when format or stake changes
  useEffect(() => {
    if (format === 'tournament') {
      const duplicate = checkDuplicateEntryFee(tournaments, format, stake, game);
      setDuplicateWarning(duplicate ? tournaments.find(t => t.id === duplicate.id) || null : null);
    } else {
      setDuplicateWarning(null);
    }
  }, [format, stake, game, tournaments]);

  const handleJoinTournament = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId);
    if (tournament) {
      setJoiningTournament(tournament);
    }
  };

  const confirmJoinTournament = async () => {
    if (!user || !profile || !joiningTournament) return;
    if (!joinInGameName.trim()) {
      setError("Please enter your In-Game Name");
      return;
    }

    if ((profile.balanceCoins || 0) < joiningTournament.challengeFee) {
      setError(`Insufficient balance. You need ${joiningTournament.challengeFee} CR`);
      return;
    }

    setJoinLoading(true);
    setError("");
    try {
      const idToken = await user.getIdToken();
      const { joinMatch } = await import("@/lib/match-service");
      await joinMatch(
        idToken,
        profile.username,
        profile.avatarId,
        joiningTournament.id,
        joinInGameName.trim(),
        undefined,
        joiningTournament.isProtected ? joinPassword : undefined
      );
      setJoiningTournament(null);
      router.push(`/match/${joiningTournament.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to join tournament");
    }
    setJoinLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    if (!inGameName || inGameName.length < 3) {
      setError("Please provide your correct In-Game Username (min 3 chars).");
      return;
    }
    
    setLoading(true);
    setError("");

    try {
      const idToken = await user.getIdToken();
      const matchId = await createMatch(
        idToken,
        profile.username,
        profile.avatarId,
        game,
        game === 'EFOOTBALL' ? '1v1' : format,
        stake,
        inGameName,
        game === 'CODM' ? weaponClass : 'NONE',
        game === 'EFOOTBALL' ? duration : 'NONE',
        game === 'CODM' && format === 'FFA' ? maxPlayers : 2,
        roomName.trim() || undefined,
        roomPassword.trim() || undefined
      );
      await router.push(`/match/${matchId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create match lobby.");
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-12">
      <CreateChallengeModal isOpen={isCreateTournamentOpen} onClose={() => setIsCreateTournamentOpen(false)} />

      {/* Join Tournament Modal */}
      {joiningTournament && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-0">
          <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={() => setJoiningTournament(null)} />
          <div className="bg-surface border border-surface-border w-full max-w-md rounded-sm relative overflow-hidden animate-in zoom-in-95 fade-in duration-200 shadow-2xl">
            <div className="p-4 bg-black border-b border-surface-border flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-accent" />
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Join Tournament</h3>
              </div>
              <button onClick={() => setJoiningTournament(null)} className="text-gray-500 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-8 space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500 text-red-500 text-xs p-3 rounded-sm font-bold uppercase tracking-widest text-center">
                  {error}
                </div>
              )}

              {/* Tournament Details */}
              <div className="space-y-3">
                <h4 className="text-sm font-black text-white italic uppercase tracking-tight">{joiningTournament.title}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-black/40 p-3 rounded-sm">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Entry Fee</p>
                    <p className="text-lg font-black text-accent italic">{joiningTournament.challengeFee} <span className="text-[10px]">CR</span></p>
                  </div>
                  <div className="bg-black/40 p-3 rounded-sm">
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Players</p>
                    <p className="text-lg font-black text-white italic">{joiningTournament.playerCount}/{joiningTournament.quota}</p>
                  </div>
                </div>
                <div className="bg-black/40 p-3 rounded-sm">
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mb-1">Prize Pool</p>
                  <p className="text-lg font-black text-white italic">{Math.floor(joiningTournament.totalPool).toLocaleString()} <span className="text-[10px]">CR</span></p>
                </div>
              </div>

              {/* In-Game Name Input */}
              <div className="space-y-3">
                <label className="block text-xs font-black uppercase tracking-[0.2em] text-accent-aware italic">
                  Your {joiningTournament.game} Username
                </label>
                <input 
                  type="text"
                  value={joinInGameName}
                  onChange={(e) => setJoinInGameName(e.target.value)}
                  placeholder="Enter your in-game name..."
                  className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-sm transition-all"
                />
              </div>

              {joiningTournament.isProtected && (
                <div className="space-y-3">
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-accent-aware italic">
                    Room Password
                  </label>
                  <input 
                    type="password"
                    value={joinPassword}
                    onChange={(e) => setJoinPassword(e.target.value)}
                    placeholder="Enter room password..."
                    className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-sm transition-all"
                  />
                </div>
              )}

              {/* Balance Check */}
              <div className="bg-accent/5 border border-accent/20 p-3 rounded-sm">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-2">Balance Check</p>
                <div className="flex justify-between items-center">
                  <span className="text-[9px] text-gray-500">Your Balance:</span>
                  <span className="text-sm font-black text-accent italic">{profile?.balanceCoins || 0} CR</span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-[9px] text-gray-500">After Join:</span>
                  <span className={`text-sm font-black italic ${((profile?.balanceCoins || 0) - joiningTournament.challengeFee) < 0 ? 'text-red-500' : 'text-accent'}`}>
                    {(profile?.balanceCoins || 0) - joiningTournament.challengeFee} CR
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-4">
                <button
                  onClick={() => setJoiningTournament(null)}
                  className="py-3 rounded-sm border border-surface-border text-gray-400 hover:text-white font-black uppercase tracking-widest text-[9px] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmJoinTournament}
                  disabled={joinLoading || (profile?.balanceCoins || 0) < joiningTournament.challengeFee || !joinInGameName.trim()}
                  className="py-3 rounded-sm bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-[9px] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {joinLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>Join</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mb-10">
        <Link href="/dashboard" className="text-sub hover:text-accent font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-black text-main italic uppercase tracking-tighter">Create <span className="text-accent">Match Room</span></h1>
        <p className="text-sub text-xs uppercase tracking-widest font-bold mt-2">Initialize an Escrow-protected match lobby or join an active tournament.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Match Creation Form */}
        <div className="lg:col-span-2">
          <div className="bg-surface border border-surface-border p-8 rounded-sm shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl pointer-events-none rounded-full" />

            {error && (
              <div className="mb-8 bg-red-500/10 border border-red-500 text-red-500 text-xs p-4 rounded-sm font-bold uppercase tracking-widest text-center">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8 relative z-10">
              {/* Game Selection */}
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   type="button"
                   onClick={() => setGame('CODM')}
                   className={`p-6 rounded-sm border-2 transition-all text-center group ${game === 'CODM' ? 'border-accent bg-accent/5' : 'border-surface-border grayscale hover:grayscale-0'}`}
                 >
                    <div className="text-xl font-black italic uppercase tracking-tighter text-main mb-1">CODM</div>
                    <div className="text-[10px] text-sub uppercase font-bold tracking-widest">Call of Duty Mobile</div>
                 </button>
                 <button 
                   type="button"
                   onClick={() => setGame('EFOOTBALL')}
                   className={`p-6 rounded-sm border-2 transition-all text-center group ${game === 'EFOOTBALL' ? 'border-accent bg-accent/5' : 'border-surface-border grayscale hover:grayscale-0'}`}
                 >
                    <div className="text-xl font-black italic uppercase tracking-tighter text-main mb-1">eFootball</div>
                    <div className="text-[10px] text-sub uppercase font-bold tracking-widest">Konami Sports</div>
                 </button>
              </div>
              
              {/* Game Username Field */}
              <div className="bg-black/40 border border-surface-border p-6 rounded-sm space-y-3">
                 <label className="block text-xs font-black uppercase tracking-[0.2em] text-accent-aware italic">
                    Your {game} Username (Required)
                 </label>
                 <input 
                    type="text"
                    placeholder={game === 'CODM' ? "e.g. GR_Sniper_99" : "e.g. GoalMachine_CG"}
                    value={inGameName}
                    onChange={(e) => setInGameName(e.target.value)}
                    className="w-full bg-black border border-surface-border/50 focus:border-accent text-main px-4 py-4 rounded-sm outline-none font-bold uppercase tracking-widest text-sm transition-all"
                    required
                 />
                 <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest italic">
                    Operatives must use their actual in-game name for verification.
                 </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Format Selection */}
                <div>
                  <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">
                    {game === 'CODM' ? 'Combat Format' : 'Gameplay Duration'}
                  </label>
                  
                  {game === 'CODM' ? (
                    <select 
                      value={format} 
                      onChange={(e) => setFormat(e.target.value as any)}
                      className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-4 rounded-sm outline-none font-bold uppercase tracking-widest text-sm"
                    >
                      <option value="1v1">1v1 Duel</option>
                      <option value="FFA">Free For All (3-8)</option>
                    </select>
                  ) : (
                    <select 
                      value={duration} 
                      onChange={(e) => setDuration(e.target.value as any)}
                      className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-4 rounded-sm outline-none font-bold uppercase tracking-widest text-sm"
                    >
                      <option value="12m">12 Minute Match</option>
                      <option value="15m">15 Minute Match</option>
                    </select>
                  )}
                </div>

                {/* Weapon Class or Player Count */}
                <div className="space-y-8">
                  {game === 'CODM' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">
                        Weapon Class Rules
                      </label>
                      <select 
                        value={weaponClass} 
                        onChange={(e) => setWeaponClass(e.target.value as any)}
                        className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-4 rounded-sm outline-none font-bold uppercase tracking-widest text-sm"
                      >
                        <option value="ALL GUNS">All Guns Allowed</option>
                        <option value="SNIPER">Sniper Only</option>
                        <option value="SHOTGUN">Shotgun Only</option>
                      </select>
                    </div>
                  )}

                  {game === 'CODM' && format === 'FFA' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">
                        Operator Limit (3-8)
                      </label>
                      <div className="flex items-center gap-4 py-3 px-4 bg-black/40 border border-surface-border rounded-sm">
                        <input 
                          type="range" min="3" max="8" step="1" 
                          value={maxPlayers} 
                          onChange={(e) => setMaxPlayers(parseInt(e.target.value))}
                          className="flex-1 accent-accent"
                        />
                        <span className="text-xl font-black text-accent italic min-w-[3rem] text-center">{maxPlayers}</span>
                      </div>
                    </div>
                  )}

                  {game === 'EFOOTBALL' && (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">
                        Competition Type
                      </label>
                      <div className="w-full bg-black/40 border border-surface-border text-gray-400 px-4 py-4 rounded-sm font-bold uppercase tracking-widest text-sm cursor-not-allowed">
                        Professional 1v1
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-8">
                {/* Stake Input */}
                <div>
                  <div className="flex justify-between items-end mb-3">
                    <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub ml-1 italic">Stake (Coins)</label>
                    <button type="button" onClick={() => setStake(stake === 0 ? 50 : 0)} className="text-[10px] font-bold text-accent uppercase tracking-widest bg-accent/10 px-3 py-1 rounded-sm hover:bg-accent/20 transition-colors">
                      {stake === 0 ? 'Switch to Cash Match' : 'Play for Free ($0)'}
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="number" 
                      min={0} 
                      max={20000}
                      step={50}
                      value={stake === 0 ? '0' : stake}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        setStake(isNaN(val) ? 0 : val);
                      }}
                      className={`w-full bg-black border ${stake > 0 && stake < 50 ? 'border-red-500' : 'border-surface-border'} focus:border-accent text-accent font-mono font-bold text-lg px-4 py-3 rounded-sm outline-none transition-colors`}
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-sub font-black uppercase tracking-widest">Coins</span>
                  </div>
                  {stake > 0 && stake < 50 && (
                    <p className="text-[10px] text-red-500 mt-2 font-black uppercase tracking-widest animate-pulse">Minimum stake is 50 Coins</p>
                  )}
                  {stake >= 50 && (
                    <p className="text-[9px] text-gray-500 mt-2 font-bold uppercase tracking-wide">≈ ${(stake / 100).toFixed(2)} USD Payout Potential</p>
                  )}
                  {stake === 0 && (
                    <p className="text-[9px] text-accent mt-2 font-bold uppercase tracking-wide">Free Practice Match (Unranked)</p>
                  )}
                </div>

                {stake === 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">Room Name</label>
                      <input 
                        type="text" 
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="e.g. Scrims #1"
                        className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-sm transition-colors"
                      />
                    </div>
                    {profile?.role !== 'PARTNER' && (
                      <div>
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">Password (Optional)</label>
                        <input 
                          type="text" 
                          value={roomPassword}
                          onChange={(e) => setRoomPassword(e.target.value)}
                          placeholder="Leave blank for public"
                          className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-sm transition-colors"
                        />
                      </div>
                    )}
                    {profile?.role === 'PARTNER' && (
                      <div className="flex flex-col justify-center">
                        <label className="block text-xs font-black uppercase tracking-[0.2em] text-accent mb-3 ml-1 italic">Partner Gating Active</label>
                        <div className="bg-accent/10 border border-accent/20 p-4 rounded-sm">
                           <p className="text-[10px] text-accent font-bold uppercase tracking-widest leading-relaxed">
                             Deployment is automatically secured via your recruitment network.<br/>
                             Only your Recruits or operatives using code <span className="underline">{profile.myReferralCode}</span> can engage.
                           </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-surface-border">
                <div className="flex items-center justify-between mb-8 p-4 bg-black/50 rounded-sm border border-surface-border/50">
                   <div className="text-xs font-bold text-sub uppercase tracking-widest">Initial Escrow Deduction:</div>
                   <div className="text-xl font-black text-accent-aware italic tracking-tight">{stake.toLocaleString()} <span className="text-[10px] uppercase tracking-widest opacity-60">Coins</span></div>
                </div>

                <button 
                  type="submit" 
                  disabled={loading || (stake > 0 && stake < 50) || (stake > 0 && (profile?.balanceCoins || 0) < stake)}
                  className="w-full bg-accent hover:bg-accent-hover text-black py-5 rounded-sm font-black uppercase tracking-[0.3em] italic shadow-[0_10px_40px_rgba(0,255,102,0.3)] transition-all hover:-translate-y-1 disabled:opacity-20 disabled:cursor-not-allowed group"
                >
                   {loading ? (
                     <span className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin inline-block"></span>
                   ) : (
                     <>Initialize <span className="group-hover:translate-x-2 transition-transform inline-block ml-2">Lobby →</span></>
                   )}
                </button>
                {(stake > 0 && (profile?.balanceCoins || 0) < stake) && (
                  <p className="text-center text-red-500 text-[10px] font-black uppercase tracking-widest mt-4">Insufficient Balance to Create This Match</p>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Available Tournaments */}
        <div className="lg:col-span-1">
          <div className="bg-surface border border-surface-border p-6 rounded-sm shadow-xl sticky top-20">
            <div className="flex items-center gap-2 mb-6">
              <Trophy className="w-5 h-5 text-accent" />
              <h3 className="text-lg font-black text-main italic uppercase tracking-tighter">Tournaments</h3>
            </div>
            
            {matchesLoading || circuitsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-accent animate-spin" />
              </div>
            ) : tournaments.length > 0 ? (
              <div className="space-y-4">
                {/* Duplicate Warning */}
                {duplicateWarning && format === 'tournament' && (
                  <div className="bg-accent/10 border border-accent/30 p-3 rounded-sm flex gap-3 animate-in slide-in-from-top">
                    <AlertCircle className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-black text-accent uppercase tracking-widest mb-2">Tournament Exists</p>
                      <p className="text-gray-300 mb-3">Join the active {game} tournament at {duplicateWarning.challengeFee} CR instead:</p>
                      <button
                        onClick={() => handleJoinTournament(duplicateWarning.id)}
                        className="w-full bg-accent text-black font-black uppercase tracking-widest text-[9px] py-2 rounded-sm hover:bg-accent-hover transition-all"
                      >
                        Join {duplicateWarning.playerCount}/{duplicateWarning.quota} Players
                      </button>
                    </div>
                  </div>
                )}

                {/* Tournament Cards */}
                {tournaments.map((tournament) => (
                  <div key={tournament.id} className="bg-black/40 border border-surface-border p-4 rounded-sm group hover:border-accent/40 transition-all">
                    <div className="flex justify-between items-start mb-3">
                      <span className="bg-accent/10 text-accent px-2 py-1 text-[8px] font-black uppercase rounded-sm">{tournament.format}</span>
                      <span className="text-[8px] text-gray-500 font-bold uppercase">{tournament.status}</span>
                    </div>
                    <h4 className="font-black text-sm text-white italic uppercase tracking-tight mb-3 truncate group-hover:text-accent transition-colors flex items-center gap-2">
                      {tournament.isProtected && <svg className="w-3 h-3 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>}
                      {tournament.title}
                    </h4>
                    <div className="space-y-2 mb-4 text-[9px]">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Entry Fee:</span>
                        <span className="text-white font-black">{tournament.challengeFee} CR</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Players:</span>
                        <span className="text-accent font-black">{tournament.playerCount}/{tournament.quota}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Prize Pool:</span>
                        <span className="text-white">{Math.floor(tournament.totalPool).toLocaleString()} CR</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleJoinTournament(tournament.id)}
                      disabled={tournament.playerCount >= tournament.quota}
                      className={`w-full py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all ${ tournament.playerCount >= tournament.quota ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-white text-black hover:bg-accent'}`}
                    >
                      {tournament.playerCount >= tournament.quota ? 'Full' : 'Join'}
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => setIsCreateTournamentOpen(true)}
                  className="w-full border-2 border-dashed border-surface-border hover:border-accent text-gray-500 hover:text-accent font-black uppercase tracking-widest text-[9px] py-4 rounded-sm transition-all"
                >
                  + Create Tournament
                </button>
              </div>
            ) : (
              <div className="text-center py-12">
                <Trophy className="w-8 h-8 text-gray-800 mx-auto mb-3 opacity-30" />
                <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-4">No Active Tournaments</p>
                <button
                  onClick={() => setIsCreateTournamentOpen(true)}
                  className="w-full bg-accent text-black font-black uppercase tracking-widest text-[9px] py-3 rounded-sm hover:bg-accent-hover transition-all"
                >
                  Create First Tournament
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
