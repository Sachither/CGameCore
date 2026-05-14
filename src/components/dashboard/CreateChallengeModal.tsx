"use client";
import React, { useState, useEffect } from "react";
import { createMatch, joinMatch, findActiveMatchByType, Match } from "@/lib/match-service";
import { useAuth } from "@/components/auth/AuthProvider";
import { useRouter } from "next/navigation";
import { X, Loader2, Swords, ShieldCheck, Users, Trophy, Flame, Crosshair } from "lucide-react";
import { sanitize } from "@/lib/validation-utils";
import { useToast } from "@/context/ToastContext";

interface CreateChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateChallengeModal({ isOpen, onClose }: CreateChallengeModalProps) {
  const { user, profile } = useAuth();
  const router = useRouter();
  const toast = useToast();
  
  const [game, setGame] = useState<'CODM' | 'EFOOTBALL'>('CODM');
  const [fee, setFee] = useState<number>(100);
  const [customFee, setCustomFee] = useState<string>("");
  const [isCustomFee, setIsCustomFee] = useState(false);
  const [weaponClass, setWeaponClass] = useState<'ALL GUNS' | 'SHOTGUN' | 'SNIPER'>('ALL GUNS');
  const [format, setFormat] = useState<Match['format']>('1v1');
  const [duration, setDuration] = useState<'12m' | '15m'>('15m');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [inGameName, setInGameName] = useState<string>('');
  const [roomName, setRoomName] = useState("");
  const [roomPassword, setRoomPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [existingMatchId, setExistingMatchId] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // SINGLETON CHECK: Detect existing filling rooms
  useEffect(() => {
    if (!isOpen) return;
    
    const checkExisting = async () => {
      setCheckingExisting(true);
      try {
        if (profile?.role !== 'PARTNER' && profile?.tier !== 3) {
          const existing = await findActiveMatchByType(game, format, fee);
          setExistingMatchId(existing?.id || null);
        } else {
          setExistingMatchId(null);
        }
      } catch (e) {
        console.error("Singleton check failure:", e);
      }
      setCheckingExisting(false);
    };

    const debounce = setTimeout(checkExisting, 500);
    return () => clearTimeout(debounce);
  }, [game, format, fee, isOpen, profile?.role]);

  // IDENTITY SYNC: Auto-populate In-Game Name from profile
  useEffect(() => {
     if (profile && isOpen) {
        const tag = game === 'CODM' ? profile.codTag : profile.efootballTag;
        setInGameName(tag || "");

        // PARTNER SYNC: For free matches, default password to their promo/referral code
        if (profile.role === 'PARTNER') {
           if (fee === 0 && !roomPassword && profile.myReferralCode) {
              setRoomPassword(profile.myReferralCode.toUpperCase());
           }
           if (!roomName) {
              setRoomName(`${profile.username.toUpperCase()} ${fee === 0 ? 'PRACTICE' : 'LOBBY'}`);
           }
        }
     }
  }, [game, profile, isOpen, fee]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!user || !profile) {
      toast.info("Enlistment Required", "You must be an active operative to initiate a deployment. Redirecting to HQ...");
      router.push('/register?callback=/dashboard');
      return;
    }
    
    if (!inGameName.trim()) {
      toast.error("Tactical Error", `Please enter your exact ${game} In-Game Name so opponents can invite you.`);
      return;
    }

    const sanitizedIGN = sanitize(inGameName);

    setLoading(true);
    try {
      const idToken = await user.getIdToken();

      if (existingMatchId) {
        await joinMatch(idToken, profile.username, profile.avatarId, existingMatchId, sanitizedIGN);
        router.push(`/match/${existingMatchId}`);
        onClose();
        return;
      }

      const matchId = await createMatch(
        idToken, 
        profile.username, 
        profile.avatarId, 
        game, 
        format, 
        isCustomFee ? (Number(customFee) || 0) : fee, 
        sanitizedIGN,
        weaponClass, 
        game === 'EFOOTBALL' ? duration : 'NONE',
        maxPlayers,
        roomName.trim() || undefined,
        fee === 0 ? roomPassword.trim() || undefined : undefined,
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
      );
      router.push(`/match/${matchId}`);
      onClose();
    } catch (err: any) {
      toast.error("Deployment Error", err.message || "Failed to process request.");
    }
    setLoading(false);
  };

  const getFormatsForGame = () => {
    if (game === 'CODM') return ['1v1', 'FFA', 'br', 'alcatraz'] as const;
    return ['1v1', 'league', 'tournament'] as const;
  };

  const getAvailableFees = () => {
    const allFees = [0, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    const userTier = profile?.tier || 1;
    
    if (userTier === 1) return allFees.filter(f => f <= 1000);
    if (userTier === 2) return allFees.filter(f => f <= 10000);
    return allFees;
  };

  const fees = getAvailableFees();
  const weaponClasses = ['ALL GUNS', 'SHOTGUN', 'SNIPER'] as const;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-md" onClick={onClose} />
      
      <div className="bg-surface border border-surface-border w-full max-w-lg rounded-sm relative overflow-hidden animate-in zoom-in-95 fade-in duration-200 flex flex-col max-h-[90vh] shadow-2xl">
         <div className="p-4 bg-black border-b border-surface-border flex justify-between items-center shrink-0">
            <div className="flex items-center gap-2">
               <Swords className="w-4 h-4 text-accent" />
               <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-white italic">Operational Deployment</h3>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
               <X className="w-5 h-5" />
            </button>
         </div>

         <div className="p-8 space-y-8 overflow-y-auto custom-scrollbar">
             {/* Singleton Alert */}
             {existingMatchId && (
               <div className="bg-accent/10 border border-accent/30 p-4 rounded-sm flex items-center gap-4 animate-in slide-in-from-top-4 duration-500">
                  <div className="bg-accent/20 p-2 rounded-full">
                     <Flame className="w-4 h-4 text-accent animate-pulse" />
                  </div>
                  <div>
                     <h4 className="text-[10px] font-black uppercase text-accent tracking-widest leading-none mb-1">Tactical Unit Detected</h4>
                     <p className="text-[9px] text-gray-400 font-bold uppercase leading-tight">An active room already exists for this mission. Singleton protocol requires you to join existing squads first.</p>
                  </div>
               </div>
             )}

             {/* IN-GAME NAME CAPTURE - MOVED TO TOP */}
             <div className="space-y-3 bg-black/40 p-4 border border-surface-border rounded-sm">
                <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em] block">In-Game Neural Link (Mandatory)</label>
                <input
                  type="text"
                  placeholder={`Enter your exact ${game} username...`}
                  value={inGameName}
                  onChange={(e) => setInGameName(e.target.value)}
                  className="w-full bg-black border border-accent/20 focus:border-accent text-white py-4 px-4 rounded-sm outline-none font-bold placeholder-gray-800 transition-colors text-sm"
                  required
                />
                <p className="text-[7px] text-gray-600 font-bold uppercase tracking-widest leading-relaxed">
                  Required for opponent synchronization. Rejections occur for mismatched data.
                </p>
             </div>

            {/* Game Selection */}
            <div className="space-y-4">
               <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Theatre of War</label>
               <div className="grid grid-cols-2 gap-3">
                  {(['CODM', 'EFOOTBALL'] as const).map((g) => (
                    <button 
                      key={g}
                      onClick={() => {
                        setGame(g);
                        setFormat('1v1');
                        setMaxPlayers(2);
                      }}
                      className={`flex flex-col items-center justify-center py-5 rounded-sm transition-all border ${game === g ? 'bg-accent text-black border-accent' : 'bg-black border-surface-border text-gray-500 hover:border-accent/40'}`}
                    >
                      <span className="text-xs font-black uppercase tracking-widest italic">{g}</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* Format Selection */}
            <div className="space-y-4 animate-in fade-in duration-500" key={game}>
              <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Mission Format</label>
              <div className="grid grid-cols-2 gap-3">
                 {getFormatsForGame().map((f) => (
                   <button 
                     key={f}
                     disabled={f === 'alcatraz'}
                      onClick={() => {
                        setFormat(f);
                        if (f === 'br' || f === 'alcatraz') setMaxPlayers(20);
                        else if (f === 'tournament') setMaxPlayers(16);
                        else if (f === 'league') setMaxPlayers(8);
                        else if (f === 'FFA') setMaxPlayers(8);
                        else setMaxPlayers(2);
                      }}
                     className={`py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border 
                       ${f === 'alcatraz' ? 'bg-black border-surface-border text-gray-800 opacity-50 cursor-not-allowed' : 
                       (format === f ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600 hover:border-accent/20')}`}
                   >
                     {f === 'league' ? 'LEAGUE (ROBIN)' : f.toUpperCase()}
                   </button>
                 ))}
              </div>
            </div>

            {/* Weapon Class - Only for CODM Duels (1v1/FFA) */}
            {game === 'CODM' && (format === '1v1' || format === 'FFA') && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block flex items-center gap-2">
                  <Crosshair className="w-3 h-3 text-accent" />
                  Tactical Selection (Mandatory)
                </label>
                <div className="grid grid-cols-3 gap-3">
                   {weaponClasses.map(w => (
                     <button 
                       key={w}
                       onClick={() => setWeaponClass(w)}
                       className={`py-3 rounded-sm text-[9px] font-black transition-all border ${weaponClass === w ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600'}`}
                     >
                       {w}
                     </button>
                   ))}
                </div>
              </div>
            )}

            {/* Player Selection for CODM BR/Alcatraz */}
            {game === 'CODM' && (format === 'br' || format === 'alcatraz') && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Operator Limits (Mode Selection)</label>
                <div className="grid grid-cols-3 gap-3">
                   {[20, 25, 30].map(n => (
                     <button 
                       key={n}
                       onClick={() => setMaxPlayers(n)}
                       className={`py-3 rounded-sm text-xs font-black italic transition-all border ${maxPlayers === n ? 'bg-accent text-black border-accent' : 'bg-black border-surface-border text-gray-500 hover:border-accent/40'}`}
                     >
                       {n} PLYRs
                     </button>
                   ))}
                </div>
              </div>
            )}

            {/* Player Selection for CODM FFA (3-8) or League (4-16) */}
            {((game === 'CODM' && format === 'FFA') || (game === 'EFOOTBALL' && format === 'league')) && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Operator Limits ({format === 'league' ? '4-16' : '3-8'} PLYRs)</label>
                <div className="grid grid-cols-4 gap-2">
                   {(format === 'league' ? [4, 8, 10, 16] : [3, 4, 5, 6, 7, 8]).map(n => (
                     <button 
                       key={n}
                       onClick={() => setMaxPlayers(n)}
                       className={`py-3 rounded-sm text-xs font-black italic transition-all border ${maxPlayers === n ? 'bg-accent text-black border-accent' : 'bg-black border-surface-border text-gray-500 hover:border-accent/40'}`}
                     >
                       {n}
                     </button>
                   ))}
                </div>
              </div>
            )}

            {/* Fee Selection */}
            <div className="space-y-4">
               <div className="flex justify-between items-end">
                  <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Challenge Stake (Credits)</label>
                  <span className="text-[8px] text-accent font-black uppercase tracking-widest border border-accent/20 px-1.5 py-0.5 rounded-sm">Tier {profile?.tier || 1} Limits Active</span>
               </div>
               <div className="grid grid-cols-3 gap-3">
                  {fees.map(f => (
                    <button 
                      key={f}
                      onClick={() => { setFee(f); setIsCustomFee(false); }}
                      className={`py-4 rounded-sm text-sm font-black transition-all border flex flex-col items-center justify-center gap-0.5 ${!isCustomFee && fee === f ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600 hover:border-accent/40'}`}
                    >
                      <span>{f === 0 ? "FREE" : f} {f !== 0 && <span className="text-[9px] opacity-60">CR</span>}</span>
                      {f !== 0 && <span className="text-[8px] opacity-40 italic">~${(f/100).toFixed(0)}</span>}
                    </button>
                  ))}
                  {(profile?.tier || 1) >= 2 && (
                    <button 
                      onClick={() => setIsCustomFee(true)}
                      className={`py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border ${isCustomFee ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600'}`}
                    >
                       Custom Amt
                    </button>
                  )}
                  {(profile?.tier || 1) < 2 && (
                    <button 
                      onClick={() => toast.info("Ascend Rank Required", "Custom stake deployment is locked to Tier 2+ Operatives.")}
                      className="py-4 rounded-sm bg-black border border-surface-border border-dashed text-gray-800 flex flex-col items-center justify-center grayscale"
                    >
                       <span className="text-[9px] font-black uppercase tracking-widest">Locked</span>
                       <span className="text-[7px] font-bold uppercase">Ascend to T2</span>
                    </button>
                  )}
               </div>

               {isCustomFee && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <div className="relative">
                      <input 
                        type="number"
                        placeholder="Enter custom credits..."
                        value={customFee}
                        onChange={(e) => setCustomFee(e.target.value)}
                        className="w-full bg-black border border-accent/50 focus:border-accent text-white px-4 py-4 rounded-sm outline-none font-bold text-sm"
                      />
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-accent uppercase">
                        Credits
                      </div>
                    </div>
                    <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest mt-2">
                       Max Limit: {profile?.tier === 2 ? '10,000 CR ($100)' : 'Unlimited'}
                    </p>
                  </div>
               )}
            </div>

            <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-2">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Room Name</label>
                <input 
                  type="text" 
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g. Scrims #1"
                  className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-xs transition-colors"
                />
              </div>
              {fee === 0 && (
                <>
                  {profile?.role !== 'PARTNER' && (
                    <div className="space-y-2">
                      <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Password (Opt)</label>
                      <input 
                        type="text" 
                        value={roomPassword}
                        onChange={(e) => setRoomPassword(e.target.value)}
                        placeholder="Leave blank for public"
                        className="w-full bg-black border border-surface-border focus:border-accent text-main px-4 py-3 rounded-sm outline-none font-bold uppercase tracking-widest text-xs transition-colors"
                      />
                    </div>
                  )}
                  {profile?.role === 'PARTNER' && (
                    <div className="space-y-2 flex flex-col justify-center">
                      <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em] block mb-1">Partner Gating Active</label>
                      <div className="bg-accent/10 border border-accent/20 p-2 rounded-sm">
                         <p className="text-[8px] text-accent font-bold uppercase tracking-widest">Only your Recruits or people using code <span className="underline">{profile.myReferralCode}</span> can join.</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Security Warning */}
            <div className="bg-accent/5 border border-accent/20 p-5 rounded-sm flex gap-4">
               <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
               <div className="space-y-1">
                  {fee === 0 ? (
                    <>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide leading-relaxed">
                        Operative <span className="text-white italic">{profile?.username}</span>: This is a free practice lobby. No credits will be deducted.
                      </p>
                      <p className="text-[8px] text-accent font-bold uppercase tracking-widest">Unranked Match • Stats Are Not Affected</p>
                    </>
                  ) : (
                    <>
                      <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide leading-relaxed">
                        Operative <span className="text-white italic">{profile?.username}</span>: Your {fee} CR entry fee will be vaulted immediately.
                      </p>
                      <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Singleton Protocol Active • No Zombie Lobbies Allowed</p>
                    </>
                  )}
               </div>
            </div>

            <button 
              onClick={handleCreate}
              disabled={(() => {
                if (loading || checkingExisting) return true;
                if (!inGameName.trim()) return true;
                if (isCustomFee && !customFee.trim()) return true;
                const currentStake = isCustomFee ? (Number(customFee) || 0) : fee;
                if (currentStake > 0 && currentStake > (profile?.balanceCoins || 0)) return true;
                const userTier = Number(profile?.tier || 1);
                if (profile?.role !== 'PARTNER' && userTier < 3) {
                  if (userTier === 1 && currentStake > 1000) return true;
                  if (userTier === 2 && currentStake > 10000) return true;
                }
                return false;
              })()}
              className={`w-full font-black uppercase tracking-[0.2em] py-5 rounded-sm text-[11px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 ${
                (() => {
                  const currentStake = isCustomFee ? (Number(customFee) || 0) : fee;
                  const isAffordable = currentStake === 0 || currentStake <= (profile?.balanceCoins || 0);
                  if (!inGameName.trim() || !isAffordable) return 'bg-gray-800 text-gray-500 cursor-not-allowed opacity-50';
                  return existingMatchId ? 'bg-white text-black hover:bg-accent' : 'bg-accent text-black hover:bg-accent-hover';
                })()
              }`}
            >
              {loading || checkingExisting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : !user ? (
                "Sign Up to Deploy"
              ) : !inGameName.trim() ? (
                "Link Neural ID (Enter IGN)"
              ) : (isCustomFee ? (Number(customFee) || 0) : fee) > (profile?.balanceCoins || 0) ? (
                "Insufficient Balance"
              ) : existingMatchId ? (
                <><Flame className="w-4 h-4" /> Join Active Squad</>
              ) : (
                "Initiate Deployment"
              )}
            </button>
         </div>
      </div>
    </div>
  );
}
