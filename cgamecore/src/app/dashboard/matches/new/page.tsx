"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { createMatch } from '@/lib/match-service';
import Link from 'next/link';

export default function CreateMatchPage() {
  const router = useRouter();
  const { user, profile } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [inGameName, setInGameName] = useState("");
  const [game, setGame] = useState<'CODM' | 'EFOOTBALL'>('CODM');
  const [format, setFormat] = useState<'1v1' | 'FFA'>('1v1');
  const [weaponClass, setWeaponClass] = useState<'ALL GUNS' | 'SHOTGUN' | 'SNIPER'>('ALL GUNS');
  const [duration, setDuration] = useState<'12m' | '15m'>('15m');
  const [maxPlayers, setMaxPlayers] = useState<number>(2);
  const [stake, setStake] = useState<number>(50);

  // Sync game username from profile
  React.useEffect(() => {
    if (profile) {
      const tag = game === 'CODM' ? profile.codTag : profile.efootballTag;
      setInGameName(tag || "");
    }
  }, [profile, game]);

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
      // createMatch(idToken, username, avatarId, game, format, challengeFee, inGameName, ...)
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
        game === 'CODM' && format === 'FFA' ? maxPlayers : 2
      );
      router.push(`/match/${matchId}`);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to create match lobby.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-12">
      <div className="mb-10">
        <Link href="/dashboard" className="text-sub hover:text-accent font-bold uppercase tracking-widest text-[10px] flex items-center gap-2 mb-6 transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          Back to Dashboard
        </Link>
        <h1 className="text-4xl font-black text-main italic uppercase tracking-tighter">Create <span className="text-accent">Match Room</span></h1>
        <p className="text-sub text-xs uppercase tracking-widest font-bold mt-2">Initialize an Escrow-protected match lobby.</p>
      </div>

      <div className="bg-surface border border-surface-border p-8 rounded-sm shadow-2xl relative overflow-hidden">
        {/* Aesthetic background glow */}
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
            {/* Format Selection - Branching */}
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
              <label className="block text-xs font-black uppercase tracking-[0.2em] text-sub mb-3 ml-1 italic">Stake (Coins)</label>
              <div className="relative">
                <input 
                  type="number" 
                  min={50} 
                  max={20000}
                  step={50}
                  value={stake === 0 ? '' : stake}
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
                <p className="text-[9px] text-gray-500 mt-2 font-bold uppercase tracking-wide">≈ ₦{(stake * 15).toLocaleString()} Payout Potential</p>
              )}
            </div>
          </div>

          <div className="pt-6 border-t border-surface-border">
            <div className="flex items-center justify-between mb-8 p-4 bg-black/50 rounded-sm border border-surface-border/50">
               <div className="text-xs font-bold text-sub uppercase tracking-widest">Initial Escrow Deduction:</div>
               <div className="text-xl font-black text-accent-aware italic tracking-tight">{stake.toLocaleString()} <span className="text-[10px] uppercase tracking-widest opacity-60">Coins</span></div>
            </div>

            <button 
              type="submit" 
              disabled={loading || stake < 50 || (profile?.balanceCoins || 0) < stake}
              className="w-full bg-accent hover:bg-accent-hover text-black py-5 rounded-sm font-black uppercase tracking-[0.3em] italic shadow-[0_10px_40px_rgba(0,255,102,0.3)] transition-all hover:-translate-y-1 disabled:opacity-20 disabled:cursor-not-allowed group"
            >
               {loading ? (
                 <span className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin inline-block"></span>
               ) : (
                 <>Initialize <span className="group-hover:translate-x-2 transition-transform inline-block ml-2">Lobby →</span></>
               )}
            </button>
            {(profile?.balanceCoins || 0) < stake && (
              <p className="text-center text-red-500 text-[10px] font-black uppercase tracking-widest mt-4">Insufficient Balance to Create This Match</p>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
