"use client";
import React, { useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getPartnerStatsAction, createPartnerTournamentAction, applyForPartnerAction } from '@/app/actions/user-actions';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, DollarSign, Copy, CheckCircle, ShieldAlert, Swords, Zap, Activity, Share2 } from 'lucide-react';

export default function PartnerPortal() {
  const { user, profile, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [creating, setCreating] = useState(false);
  const [creationError, setCreationError] = useState<string | null>(null);
  const [selectedFee, setSelectedFee] = useState(100);
  const [customFee, setCustomFee] = useState<string>("");
  const [isCustomFee, setIsCustomFee] = useState(false);
  const [codmFormat, setCodmFormat] = useState<'BR' | 'FFA'>('BR');
  const [codmPlayers, setCodmPlayers] = useState(20);
  const [codmWeaponClass, setCodmWeaponClass] = useState<'ALL GUNS' | 'SHOTGUN' | 'SNIPER'>('ALL GUNS');
  const [efootballPlayers, setEfootballPlayers] = useState(16);
  const [efootballFormat, setEfootballFormat] = useState<'tournament' | 'league'>('league');
  const [deploymentSuccess, setDeploymentSuccess] = useState<string | null>(null);
  const [appForm, setAppForm] = useState({ channelName: '', channelUrl: '', followerCount: 0 });
  const [appLoading, setAppLoading] = useState(false);
  const router = useRouter();

  const fetchStats = async () => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await getPartnerStatsAction(idToken);
      if (res.success) {
        setStats(res.stats);
      }
    } catch (err) {
      console.error("Failed to fetch partner stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTournament = async (game: 'CODM' | 'EFOOTBALL') => {
    if (!user) return;
    setCreating(true);
    setCreationError(null);
    setDeploymentSuccess(null);
    try {
      const idToken = await user.getIdToken();
      const format = game === 'CODM' ? codmFormat : efootballFormat;
      const players = game === 'CODM' ? codmPlayers : efootballPlayers;
      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
      const feeToUse = isCustomFee ? (Number(customFee) || 0) : selectedFee;
      
      const res = await createPartnerTournamentAction(idToken, game, feeToUse, format, players, codmWeaponClass, isLocal);
      if (res.success) {
        setDeploymentSuccess(`LOBBY DEPLOYED: Your ${game} Creator Cup is live!`);
        // Refresh stats to show new match/recruits without full page reload
        fetchStats();
        setTimeout(() => setDeploymentSuccess(null), 5000);
      } else {
        setCreationError(res.error || "Deployment failed.");
      }
    } catch (err: any) {
      setCreationError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setAppLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await applyForPartnerAction(idToken, appForm);
      if (res.success) {
        window.location.reload(); // Refresh to show pending status
      } else {
        alert(res.error);
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAppLoading(false);
    }
  };

  // 🛡️ PARTNER EXPIRY CHECK
  const partnerExpiryDate = profile?.partnerExpiresAt?.seconds 
    ? new Date(profile.partnerExpiresAt.seconds * 1000) 
    : null;
    
  const isExpired = partnerExpiryDate && partnerExpiryDate < new Date();

  useEffect(() => {
    if (user && profile) {
      fetchStats();
    } else if (!authLoading && !user) {
      setLoading(false);
    }
  }, [user, profile, authLoading]);

  const copyToClipboard = () => {
    if (!profile?.myReferralCode) return;
    navigator.clipboard.writeText(profile.myReferralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const code = profile?.myReferralCode || "";
    if (!code) return;
    
    const shareUrl = `${window.location.origin}/register?code=${code}`;
    const shareText = `Join me on CGameCore! Use my recruitment code: ${code} to access elite tournaments.`;
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'CGameCore Recruitment',
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or share failed
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (authLoading || (loading && !stats)) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] animate-pulse">Syncing Command Center...</p>
      </div>
    );
  }

  // 🛡️ ROLE & TIER CLEARANCE CHECK
  const isPartner = (profile?.role as any) === 'PARTNER' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
  const hasClearance = isPartner || (profile?.tier || 1) >= 3;

  if (!hasClearance) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 bg-red-500/5 border border-red-500/20 rounded-sm">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Clearance Denied</h2>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest max-w-md">
          Neural clearance not found. The Partner Hub is reserved for Tier 3 Operatives and Verified Creators. Reach Tier 3 to apply for partnership.
        </p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-8 text-[10px] font-black text-gray-400 hover:text-white uppercase tracking-[0.2em] bg-surface-border/20 px-8 py-3 rounded-sm transition-all border border-surface-border"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (isExpired) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4 animate-pulse" />
        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter mb-2">Neural Link Terminated</h2>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest max-w-md">
          Your Partner Clearance has expired (90-day cycle complete). Re-apply via the Command Center if you wish to extend your deployment.
        </p>
        <button 
          onClick={() => window.location.href = '/dashboard'}
          className="mt-8 text-xs font-black text-gray-500 uppercase tracking-widest border border-surface-border px-6 py-2 rounded-sm hover:text-white transition-colors"
        >
          Return to Dashboard
        </button>
      </div>
    );
  }

  if (!isPartner) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-6">
        <div className="bg-surface border border-surface-border p-12 rounded-sm text-center relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
             <Zap className="w-32 h-32 text-accent" />
          </div>
          
          <h2 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-6">
            ASCEND TO <span className="text-accent">PARTNER</span> STATUS
          </h2>
          
          {profile?.partnerStatus === 'PENDING' ? (
            <div className="bg-accent/10 border border-accent/20 p-8 rounded-sm animate-pulse">
               <Activity className="w-12 h-12 text-accent mx-auto mb-4" />
               <h3 className="text-xl font-black text-white uppercase tracking-widest mb-2">NEURAL VERIFICATION IN PROGRESS</h3>
               <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Our command staff is reviewing your tactical footprint. You will be notified once clearance is granted.</p>
            </div>
          ) : (
            <div className="space-y-10">
               <p className="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed max-w-xl mx-auto">
                 You have reached Tier 3 status. You are now eligible to apply for our Creator Partnership program to earn 50% commission on all recruit match fees.
               </p>

               <form onSubmit={handleApply} className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left max-w-2xl mx-auto">
                  <div className="space-y-2">
                    <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Primary Channel Name</label>
                    <input 
                      type="text" 
                      required
                      placeholder="YouTube / Twitch / TikTok"
                      className="w-full bg-black border border-surface-border p-4 rounded-sm outline-none focus:border-accent text-white font-bold text-xs"
                      value={appForm.channelName}
                      onChange={e => setAppForm({...appForm, channelName: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Follower Count</label>
                    <input 
                      type="number" 
                      required
                      placeholder="Current Audience Size"
                      className="w-full bg-black border border-surface-border p-4 rounded-sm outline-none focus:border-accent text-white font-bold text-xs"
                      value={appForm.followerCount || ''}
                      onChange={e => setAppForm({...appForm, followerCount: Number(e.target.value)})}
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <label className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Channel URL / Proof</label>
                    <input 
                      type="url" 
                      required
                      placeholder="Link to your primary platform"
                      className="w-full bg-black border border-surface-border p-4 rounded-sm outline-none focus:border-accent text-white font-bold text-xs"
                      value={appForm.channelUrl}
                      onChange={e => setAppForm({...appForm, channelUrl: e.target.value})}
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={appLoading}
                    className="md:col-span-2 bg-accent text-black font-black uppercase tracking-[0.2em] py-5 rounded-sm text-[11px] hover:scale-[1.02] transition-transform disabled:opacity-50"
                  >
                    {appLoading ? 'TRANSMITTING...' : 'SUBMIT PARTNER APPLICATION'}
                  </button>
               </form>
            </div>
          )}
        </div>
      </div>
    );
  }

  const referralCode = profile?.myReferralCode || "PENDING_DEPLOYMENT";

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header & Code Card */}
      <div className="relative group overflow-hidden bg-surface border border-surface-border p-8 rounded-sm">
        <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
          <TrendingUp className="w-32 h-32 text-white" />
        </div>
        
        <div className="relative z-10">
          <h1 className="text-3xl font-black italic uppercase tracking-tighter text-white mb-2">
            PARTNER <span className="text-accent">COMMAND</span> PORTAL
          </h1>
          <div className="flex items-center justify-between mb-8">
            <p className="text-gray-400 font-bold uppercase tracking-widest text-[10px]">
              Tactical Recruitment & Revenue Intelligence
            </p>
            {partnerExpiryDate && (
              <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-sm">
                Clearance Valid Until: <span className="text-white ml-1">{partnerExpiryDate.toLocaleDateString()}</span>
              </div>
            )}
          </div>

          {/* TACTICAL SUMMONS SECTION */}
          {stats?.activeSummons?.length > 0 && (
            <div className="mb-8 bg-red-500/10 border border-red-500 p-6 rounded-sm animate-pulse flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
                <div className="text-left">
                  <h3 className="text-sm font-black text-white uppercase tracking-widest">COMMAND CENTER SUMMONS</h3>
                  <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Admin Intervention required for Match #{stats.activeSummons[0].id.slice(-6)}</p>
                </div>
              </div>
              <button 
                onClick={() => window.open(`/match/${stats.activeSummons[0].id}`, '_blank')}
                className="w-full md:w-auto bg-red-500 text-white px-6 py-3 rounded-sm text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
              >
                JOIN JUDGEMENT ROOM
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="flex-1 w-full bg-black/40 border border-surface-border p-6 rounded-sm">
              <label className="block text-[10px] font-black text-accent uppercase tracking-[0.2em] mb-3">Your Operative Code</label>
              <div className="flex items-center flex-wrap gap-4">
                <span className="text-2xl font-black tracking-widest text-white font-mono">{referralCode}</span>
                <div className="flex gap-2">
                  <button 
                    onClick={copyToClipboard}
                    className="flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30 text-accent px-4 py-2 rounded-sm text-xs font-black uppercase transition-all"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "COPIED" : "COPY CODE"}
                  </button>
                  <button 
                    onClick={handleShare}
                    className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-sm text-xs font-black uppercase transition-all"
                  >
                    <Share2 className="w-4 h-4" />
                    SHARE LINK
                  </button>
                </div>
              </div>
            </div>
            
            <div className="w-full md:w-64 bg-accent text-black p-6 rounded-sm text-center">
              <div className="text-[10px] font-black uppercase tracking-widest mb-1">Commission Rate</div>
              <div className="text-4xl font-black italic tracking-tighter">50% <span className="text-xl">RAKE</span></div>
            </div>
          </div>
        </div>
      </div>

      {/* Deploy Creator Lobbies */}
      <div className="bg-surface border border-surface-border overflow-hidden rounded-sm">
        <div className="bg-accent/5 px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Deploy Creator Lobbies</h3>
          </div>
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Strategic Entry Tier:</span>
            <div className="flex flex-wrap gap-2">
              {[
                { val: 0, label: 'FREE', sub: 'PRACTICE' },
                { val: 100, label: '$1.00', sub: 'ENTRY' },
                { val: 200, label: '$2.00', sub: 'ENTRY' },
                { val: 500, label: '$5.00', sub: 'ELITE' },
                { val: 1000, label: '$10.00', sub: 'PRO' },
              ].map((tier) => (
                <button
                  key={tier.val}
                  onClick={() => { setSelectedFee(tier.val); setIsCustomFee(false); }}
                  className={`flex flex-col items-center justify-center min-w-[80px] py-2 px-3 rounded-sm border transition-all ${
                    !isCustomFee && selectedFee === tier.val 
                      ? 'bg-accent border-accent text-black shadow-[0_0_15px_rgba(0,255,102,0.2)]' 
                      : 'bg-black border-surface-border text-gray-500 hover:border-white/20'
                  }`}
                >
                  <span className="text-[11px] font-black italic tracking-tighter leading-none">{tier.label}</span>
                  <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">{tier.sub}</span>
                </button>
              ))}
              <button
                onClick={() => setIsCustomFee(true)}
                className={`flex flex-col items-center justify-center min-w-[80px] py-2 px-3 rounded-sm border transition-all ${
                  isCustomFee 
                    ? 'bg-white border-white text-black' 
                    : 'bg-black border-surface-border text-gray-500 hover:border-white/20'
                }`}
              >
                <span className="text-[11px] font-black italic tracking-tighter leading-none">CUSTOM</span>
                <span className="text-[7px] font-bold uppercase tracking-widest opacity-60">STAKE</span>
              </button>
            </div>
          </div>

          {isCustomFee && (
            <div className="bg-black/40 border border-white/5 p-4 rounded-sm animate-in slide-in-from-top-2 duration-300">
               <div className="flex items-center gap-4">
                  <div className="relative flex-1">
                     <input 
                       type="number"
                       placeholder="Enter Custom Credits..."
                       value={customFee}
                       onChange={(e) => setCustomFee(e.target.value)}
                       className="w-full bg-black border border-accent/30 focus:border-accent text-white px-4 py-3 rounded-sm outline-none font-black text-xs"
                     />
                     <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-accent opacity-50">CR</div>
                  </div>
                  <div className="hidden sm:block text-right">
                     <p className="text-[10px] text-white font-black italic">~${(Number(customFee || 0)/100).toFixed(2)}</p>
                     <p className="text-[7px] text-gray-600 font-bold uppercase tracking-widest leading-none">Estimated Value</p>
                  </div>
               </div>
            </div>
          )}
        </div>
        
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* CODM Lobby */}
          <div className="bg-black/40 border border-surface-border p-5 rounded-sm relative overflow-hidden">
            <div className="relative z-10">
               <div className="flex items-center justify-between mb-2">
                 <h4 className="text-sm font-black text-white italic uppercase">CODM CREATOR CUP</h4>
                 <div className="flex gap-2">
                   <button 
                     onClick={() => { setCodmFormat('BR'); setCodmPlayers(20); }}
                     className={`px-2 py-1 text-[8px] font-black rounded-sm border transition-all ${codmFormat === 'BR' ? 'bg-accent text-black border-accent' : 'bg-black text-gray-500 border-white/10'}`}
                   >BR</button>
                   <button 
                     onClick={() => { setCodmFormat('FFA'); setCodmPlayers(8); }}
                     className={`px-2 py-1 text-[8px] font-black rounded-sm border transition-all ${codmFormat === 'FFA' ? 'bg-accent text-black border-accent' : 'bg-black text-gray-500 border-white/10'}`}
                   >FFA</button>
                 </div>
               </div>
               
               <div className="flex items-center gap-3 mb-6">
                 <label className="text-[9px] text-gray-500 font-bold uppercase">Size:</label>
                 <select 
                   value={codmPlayers}
                   onChange={(e) => setCodmPlayers(Number(e.target.value))}
                   className="bg-black border border-white/10 text-white text-[10px] font-black px-2 py-1 outline-none"
                 >
                   {codmFormat === 'BR' ? (
                     [20, 30, 50, 100].map(v => <option key={v} value={v}>{v} Players</option>)
                   ) : (
                     [3, 5, 6, 7, 8].map(v => <option key={v} value={v}>{v} Players</option>)
                   )}
                 </select>
               </div>

               {codmFormat === 'FFA' && (
                 <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-top-1">
                   <label className="text-[9px] text-gray-500 font-bold uppercase">Weapon:</label>
                   <select 
                     value={codmWeaponClass}
                     onChange={(e) => setCodmWeaponClass(e.target.value as any)}
                     className="bg-black border border-white/10 text-white text-[10px] font-black px-2 py-1 outline-none"
                   >
                     <option value="ALL GUNS">All Guns</option>
                     <option value="SHOTGUN">Shotguns Only</option>
                     <option value="SNIPER">Snipers Only</option>
                   </select>
                 </div>
               )}

               <div className="flex items-center justify-between gap-4">
                  <div className="text-xs font-black text-accent uppercase">
                     { (isCustomFee ? (Number(customFee) || 0) : selectedFee) === 0 
                       ? 'FREE PRACTICE' 
                       : `$${((isCustomFee ? (Number(customFee) || 0) : selectedFee) / 100).toFixed(2)} Entry`
                     }
                   </div>
                  <button 
                    disabled={creating}
                    onClick={() => handleCreateTournament('CODM')}
                    className="bg-accent text-black px-4 py-2 rounded-sm text-[10px] font-black uppercase hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {creating ? 'DEPLOYING...' : 'SPURN LOBBY'}
                  </button>
               </div>
            </div>
          </div>

          {/* eFootball Lobby */}
          <div className="bg-black/40 border border-surface-border p-5 rounded-sm relative overflow-hidden">
            <div className="relative z-10">
               <h4 className="text-sm font-black text-white italic mb-1 uppercase">eFootball ELITE SERIES</h4>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <label className="text-[9px] text-gray-500 font-bold uppercase">Players:</label>
                    <select 
                      value={efootballPlayers}
                      onChange={(e) => setEfootballPlayers(Number(e.target.value))}
                      className="bg-black border border-white/10 text-white text-[10px] font-black px-2 py-1 outline-none"
                    >
                      <option value={4}>4 Operatives</option>
                      <option value={8}>8 Operatives</option>
                      <option value={10}>10 Operatives</option>
                      <option value={16}>16 Operatives</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-[9px] text-gray-500 font-bold uppercase">Format:</label>
                    <select 
                      value={efootballFormat}
                      onChange={(e) => setEfootballFormat(e.target.value as any)}
                      className="bg-black border border-white/10 text-accent text-[10px] font-black px-2 py-1 outline-none"
                    >
                      <option value="league">Elite League Season</option>
                      <option value="tournament">Knockout Tournament</option>
                    </select>
                  </div>
                </div>
               <div className="flex items-center justify-between gap-4">
                  <div className="text-xs font-black text-accent uppercase">
                     { (isCustomFee ? (Number(customFee) || 0) : selectedFee) === 0 
                       ? 'FREE PRACTICE' 
                       : `$${((isCustomFee ? (Number(customFee) || 0) : selectedFee) / 100).toFixed(2)} Entry`
                     }
                   </div>
                  <button 
                    disabled={creating}
                    onClick={() => handleCreateTournament('EFOOTBALL')}
                    className="bg-accent text-black px-4 py-2 rounded-sm text-[10px] font-black uppercase hover:scale-105 transition-transform disabled:opacity-50"
                  >
                    {creating ? 'DEPLOYING...' : 'SPURN LOBBY'}
                  </button>
               </div>
            </div>
          </div>
        </div>
        {deploymentSuccess && (
          <div className="px-6 pb-6 text-center">
            <div className="text-[10px] font-black text-accent uppercase tracking-widest bg-accent/10 py-3 border border-accent/20 rounded-sm animate-bounce">
              ✓ {deploymentSuccess}
            </div>
          </div>
        )}
        {creationError && (
          <div className="px-6 pb-6 text-center">
            <div className="text-[10px] font-black text-red-500 uppercase tracking-widest bg-red-500/10 py-3 border border-red-500/20 rounded-sm">
              ERROR: {creationError}
            </div>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-surface border border-surface-border p-6 rounded-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-sm">
              <Users className="w-5 h-5 text-blue-400" />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Recruits</span>
          </div>
          <div className="text-3xl font-black text-white">{stats?.totalRecruits || 0}</div>
        </div>

        <div className="bg-surface border border-surface-border p-6 rounded-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-accent/10 border border-accent/20 rounded-sm">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Total Deployments</span>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.recruits?.reduce((acc: number, r: any) => acc + r.totalMatches, 0) || 0}
          </div>
        </div>

        <div className="bg-surface border border-surface-border p-6 rounded-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-sm">
              <DollarSign className="w-5 h-5 text-yellow-500" />
            </div>
            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Lifetime Earnings</span>
          </div>
          <div className="text-3xl font-black text-white">
            {stats?.recentEarnings?.reduce((acc: number, e: any) => acc + e.amount, 0) || 0} <span className="text-xs text-gray-500">Coins</span>
          </div>
        </div>
      </div>


      {/* Live Operational Feed (Matches in Progress) */}
      <div className="bg-surface border border-surface-border rounded-sm overflow-hidden">
        <div className="bg-accent/5 px-6 py-4 border-b border-surface-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Live Operational Feed</h3>
          </div>
          <span className="text-[9px] text-gray-500 font-bold uppercase tracking-tighter">Real-Time Combat Monitoring</span>
        </div>
        
        <div className="p-6">
          {stats?.liveMatches?.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.liveMatches.map((m: any) => (
                <div key={m.id} className="bg-black/40 border border-surface-border p-4 rounded-sm flex flex-col justify-between group hover:border-accent/30 transition-all">
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[9px] font-black text-accent uppercase tracking-widest">{m.game} // {m.round || m.format}</span>
                      <span className="text-[8px] bg-white/5 text-gray-500 px-1.5 py-0.5 rounded-sm font-bold uppercase">{m.status}</span>
                    </div>
                    <div className="space-y-1">
                      {m.players.map((p: any, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <div className={`w-1 h-3 ${p.team === 'alpha' ? 'bg-blue-500' : 'bg-red-500'}`} />
                          <span className="text-[10px] font-black text-white uppercase tracking-tight">{p.username}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      if (m.circuitId) {
                        router.push(`/dashboard/tournaments/view/${m.circuitId}`);
                      } else {
                        router.push(`/match/${m.id}`);
                      }
                    }}
                    className="w-full bg-surface-border/30 hover:bg-accent hover:text-black text-white py-2 rounded-sm text-[9px] font-black uppercase tracking-widest transition-all"
                  >
                    Jump In // Observe
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center">
              <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No Active Missions in Sector. All Roster Personnel Idle.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recruits List */}
        <div className="bg-surface border border-surface-border rounded-sm overflow-hidden">
          <div className="bg-surface-hover px-6 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Recruited Operatives</h3>
            <span className="text-[9px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Active List</span>
          </div>
          <div className="divide-y divide-surface-border max-h-[400px] overflow-y-auto">
            {stats?.recruits?.length > 0 ? (
              stats.recruits.map((r: any, i: number) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div>
                    <div className="text-sm font-black text-white uppercase italic">{r.username}</div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase">Joined {new Date(r.createdAt).toLocaleDateString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-black text-accent">{r.totalMatches}</div>
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Deployments</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-gray-600 font-black uppercase tracking-widest text-[10px]">
                No Operatives Recruited Yet. Deploy Your Code.
              </div>
            )}
          </div>
        </div>

        {/* Earnings History */}
        <div className="bg-surface border border-surface-border rounded-sm overflow-hidden">
          <div className="bg-surface-hover px-6 py-4 border-b border-surface-border flex items-center justify-between">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Earnings Intel</h3>
            <span className="text-[9px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-full font-black uppercase tracking-tighter">Live Feed</span>
          </div>
          <div className="divide-y divide-surface-border max-h-[400px] overflow-y-auto">
            {stats?.recentEarnings?.length > 0 ? (
              stats.recentEarnings.map((e: any, i: number) => (
                <div key={i} className="px-6 py-4 flex items-center justify-between hover:bg-white/5 transition-colors">
                  <div>
                    <div className="text-[10px] font-black text-white uppercase tracking-tight">{e.description}</div>
                    <div className="text-[9px] text-gray-500 font-bold uppercase">{new Date(e.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-black text-yellow-500">+{e.amount}</div>
                    <div className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Coins</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-12 text-center text-gray-600 font-black uppercase tracking-widest text-[10px]">
                No Commissions Recorded. 
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Referral Program Guidelines */}
      <div className="bg-black/50 border border-surface-border p-6 rounded-sm">
        <div className="flex items-center gap-3 mb-4">
          <ShieldAlert className="w-5 h-5 text-accent" />
          <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">Deployment Rules</h4>
        </div>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <li className="flex gap-3 text-[10px] text-gray-400 font-bold leading-relaxed">
            <span className="text-accent">•</span>
            <span>You earn 50% of the platform rake from every match played by your recruits.</span>
          </li>
          <li className="flex gap-3 text-[10px] text-gray-400 font-bold leading-relaxed">
            <span className="text-accent">•</span>
            <span>Commissions apply for the first 90 days of an Operative's lifecycle.</span>
          </li>
          <li className="flex gap-3 text-[10px] text-gray-400 font-bold leading-relaxed">
            <span className="text-accent">•</span>
            <span>You can deploy 1 custom Creator Lobby per game (CODM/eFootball) at a time.</span>
          </li>
          <li className="flex gap-3 text-[10px] text-gray-400 font-bold leading-relaxed">
            <span className="text-accent">•</span>
            <span>Fake accounts or bot recruitment will result in immediate partner suspension.</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
