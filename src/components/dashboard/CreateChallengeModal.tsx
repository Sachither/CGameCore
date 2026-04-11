"use client";
import React, { useState, useEffect } from "react";
import { createMatch, findActiveMatchByType, Match } from "@/lib/match-service";
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
  const [weaponClass, setWeaponClass] = useState<'ALL GUNS' | 'SHOTGUN' | 'SNIPER'>('ALL GUNS');
  const [format, setFormat] = useState<Match['format']>('1v1');
  const [duration, setDuration] = useState<'12m' | '15m'>('15m');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [inGameName, setInGameName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [existingMatchId, setExistingMatchId] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);

  // SINGLETON CHECK: Detect existing filling rooms
  useEffect(() => {
    if (!isOpen) return;
    
    const checkExisting = async () => {
      setCheckingExisting(true);
      try {
        const existing = await findActiveMatchByType(game, format, fee);
        setExistingMatchId(existing?.id || null);
      } catch (e) {
        console.error("Singleton check failure:", e);
      }
      setCheckingExisting(false);
    };

    const debounce = setTimeout(checkExisting, 500);
    return () => clearTimeout(debounce);
  }, [game, format, fee, isOpen]);

  // IDENTITY SYNC: Auto-populate In-Game Name from profile
  useEffect(() => {
     if (profile && isOpen) {
        const tag = game === 'CODM' ? profile.codTag : profile.efootballTag;
        setInGameName(tag || "");
     }
  }, [game, profile, isOpen]);

  if (!isOpen) return null;

  const handleCreate = async () => {
    if (!user || !profile) return;
    
    if (existingMatchId) {
      router.push(`/match/${existingMatchId}`);
      onClose();
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
      const matchId = await createMatch(
        idToken, 
        profile.username, 
        profile.avatarId, 
        game, 
        format, 
        fee, 
        sanitizedIGN,
        weaponClass, 
        game === 'EFOOTBALL' ? duration : 'NONE',
        maxPlayers
      );
      router.push(`/match/${matchId}`);
      onClose();
    } catch (err: any) {
      toast.error("Deployment Error", err.message || "Failed to create challenge.");
    }
    setLoading(false);
  };

  const getFormatsForGame = () => {
    if (game === 'CODM') return ['1v1', 'FFA', 'br', 'alcatraz', 'league'] as const;
    return ['1v1', 'tournament'] as const;
  };

  const fees = [50, 100];
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
                     onClick={() => {
                       setFormat(f);
                       if (f === 'br' || f === 'alcatraz') setMaxPlayers(20);
                       else if (f === 'league') setMaxPlayers(12);
                       else if (f === 'tournament') setMaxPlayers(16);
                       else if (f === 'FFA') setMaxPlayers(8);
                       else setMaxPlayers(2);
                     }}
                     className={`py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all border ${format === f ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600 hover:border-accent/20'}`}
                   >
                     {f.toUpperCase()}
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

            {/* Player Selection for CODM FFA (3-8) */}
            {game === 'CODM' && format === 'FFA' && (
              <div className="space-y-4 animate-in slide-in-from-top-2">
                <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Operator Limits (3-8 PLYRs)</label>
                <div className="grid grid-cols-3 gap-3">
                   {[3, 4, 5, 6, 7, 8].map(n => (
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

            {/* Fee Selection */}
            <div className="space-y-4">
               <label className="text-[9px] text-gray-500 font-black uppercase tracking-[0.2em] block">Challenge Stake (Credits)</label>
               <div className="grid grid-cols-2 gap-3">
                  {fees.map(f => (
                    <button 
                      key={f}
                      onClick={() => setFee(f)}
                      className={`py-5 rounded-sm text-base font-black transition-all border ${fee === f ? 'bg-white text-black border-white' : 'bg-black border-surface-border text-gray-600'}`}
                    >
                      {f} <span className="text-[10px] ml-1 opacity-60">CR</span>
                    </button>
                  ))}
               </div>
            </div>

            {/* Security Warning */}
            <div className="bg-accent/5 border border-accent/20 p-5 rounded-sm flex gap-4">
               <ShieldCheck className="w-5 h-5 text-accent shrink-0" />
               <div className="space-y-1">
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide leading-relaxed">
                    Operative <span className="text-white italic">{profile?.username}</span>: Your {fee} CR entry fee will be vaulted immediately.
                  </p>
                  <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">Singleton Protocol Active • No Zombie Lobbies Allowed</p>
               </div>
            </div>

            {/* IN-GAME NAME CAPTURE */}
            <div className="space-y-3">
               <label className="text-[9px] text-accent font-black uppercase tracking-[0.2em] block">Your In-Game Name (Mandatory)</label>
               <input
                 type="text"
                 placeholder={`Enter your exact ${game} username...`}
                 value={inGameName}
                 onChange={(e) => setInGameName(e.target.value)}
                 className="w-full bg-black border border-surface-border focus:border-accent text-white py-4 px-4 rounded-sm outline-none font-bold placeholder-gray-700 transition-colors"
                 required
               />
               <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed mt-2">
                 This exact name will be copied by your opponent to send you a friend request. If we cannot match your screenshot victory to this text, it will be instantly rejected.
               </p>
            </div>

            <button 
              onClick={handleCreate}
              disabled={loading || checkingExisting || (profile?.balanceCoins || 0) < fee || !inGameName.trim()}
              className={`w-full font-black uppercase tracking-[0.2em] py-5 rounded-sm text-[11px] shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-20 ${existingMatchId ? 'bg-white text-black hover:bg-accent' : 'bg-accent text-black hover:bg-accent-hover'}`}
            >
              {loading || checkingExisting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
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
