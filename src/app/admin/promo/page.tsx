"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { createPromoEventAction, deletePromoEventAction } from "@/app/actions/promo-actions";
import { getEffectiveRateAction } from "@/app/actions/rate-actions";
import { Trophy, Plus, RefreshCw, RefreshCcw, Flame, Users, Zap, ShieldCheck, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, onSnapshot } from "firebase/firestore";
import TacticalConfirmModal from "@/components/admin/TacticalConfirmModal";
import { useToast } from "@/context/ToastContext";

function PromoDeploymentCenter() {
  const { user } = useAuth();
  const toast = useToast();
  const [rate, setRate] = useState(1500);
  const [loading, setLoading] = useState(false);
  const [isConfirmOpen, setConfirmOpen] = useState(false);
  const [formData, setFormData] = useState({
    game: 'EFOOTBALL' as 'EFOOTBALL' | 'CODM',
    limit: 128,
    prizeUSD: 35,
    prizeNGN: 50000,
    entryFeeCoins: 0
  });

  useEffect(() => {
    const fetchRate = async () => {
      const res = await getEffectiveRateAction('NGN', 'DEPOSIT');
      if (res.success && res.rate) {
        setRate(res.rate);
        // Sync initial prizeNGN with live rate
        setFormData(prev => ({ ...prev, prizeNGN: Math.round(prev.prizeUSD * res.rate) }));
      }
    };
    fetchRate();
  }, []);

  const handleLaunch = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const res = await createPromoEventAction(
        idToken,
        formData.game,
        formData.limit,
        formData.prizeUSD,
        formData.prizeNGN,
        formData.entryFeeCoins
      );
      if (res.success) {
        toast.success("PROMO DEPLOYED", `Successfully launched ${formData.game} operations for ${formData.limit} players.`);
      } else {
        toast.error("DEPLOYMENT FAILED", (res as any).error || "Unknown authorization failure.");
      }
    } catch (e) {
      console.error(e);
      toast.error("CRITICAL FAILURE", "The tactical uplink was lost during deployment.");
    }
    setLoading(false);
  };

  return (
    <div className="bg-[#0a0a0a] border border-accent/20 p-10 rounded-sm relative overflow-hidden group shadow-[0_0_50px_rgba(0,255,102,0.05)]">
      <div className="absolute top-0 right-0 p-6 opacity-10">
        <Flame className="w-32 h-32 text-accent" />
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-accent/10 border border-accent/20 rounded-sm">
            <Zap className="w-8 h-8 text-accent animate-pulse" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-none mb-1">Promo Deployment Center</h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Global Operations Control</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          {/* Tactical Arena */}
          <div className="flex flex-col">
            <div className="h-6 flex items-center mb-2">
              <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1 italic">Tactical Arena</label>
            </div>
            <select
              value={formData.game}
              onChange={(e) => setFormData({ ...formData, game: e.target.value as any, limit: e.target.value === 'EFOOTBALL' ? 128 : 100 })}
              className="w-full bg-black border border-white/10 p-4 rounded-sm text-xs font-bold text-white outline-none focus:border-accent"
            >
              <option value="EFOOTBALL">eFootball (Knockout)</option>
              <option value="CODM">CODM (Battle Royale)</option>
            </select>
            <div className="h-6" />
          </div>

          {/* Player Limit */}
          <div className="flex flex-col">
            <div className="h-6 flex items-center mb-2">
              <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1 italic">Player Limit (Cap)</label>
            </div>
            {formData.game === 'EFOOTBALL' ? (
              <select
                value={formData.limit}
                onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) || 0 })}
                className="w-full bg-black border border-white/10 p-4 rounded-sm text-xs font-bold text-white outline-none focus:border-accent"
              >
                <option value={2}>2 Players (Final Mode)</option>
                <option value={4}>4 Players</option>
                <option value={8}>8 Players</option>
                <option value={16}>16 Players</option>
                <option value={32}>32 Players</option>
                <option value={64}>64 Players</option>
                <option value={128}>128 Players (Mega Promo)</option>
              </select>
            ) : (
              <input
                type="number"
                value={formData.limit}
                onChange={(e) => setFormData({ ...formData, limit: parseInt(e.target.value) || 0 })}
                className="w-full bg-black border border-white/10 p-4 rounded-sm text-xs font-bold text-white outline-none focus:border-accent"
                placeholder="100"
              />
            )}
            <div className="h-6" />
          </div>

          {/* Prize USD */}
          <div className="flex flex-col">
            <div className="h-6 flex items-center mb-2">
              <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1 italic">Prize USD (100CR = $1)</label>
            </div>
            <input
              type="number"
              value={formData.prizeUSD}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 0;
                setFormData({ ...formData, prizeUSD: val, prizeNGN: Math.round(val * rate) });
              }}
              className="w-full bg-black border border-white/10 p-4 rounded-sm text-xs font-bold text-white outline-none focus:border-accent"
              placeholder="35"
            />
            <div className="h-6 flex items-center">
              <p className="text-[8px] text-accent font-bold uppercase italic px-1 leading-none">
                ≈ {Math.round(formData.prizeUSD * rate).toLocaleString()} NGN at {rate}/$
              </p>
            </div>
          </div>

          {/* Entry Fee */}
          <div className="flex flex-col">
            <div className="h-6 flex items-center mb-2">
              <label className="text-[10px] font-black text-accent uppercase tracking-widest px-1 italic">Entry Fee (Coins)</label>
            </div>
            <input
              type="number"
              value={formData.entryFeeCoins}
              onChange={(e) => setFormData({ ...formData, entryFeeCoins: parseInt(e.target.value) || 0 })}
              className="w-full bg-black border border-white/10 p-4 rounded-sm text-xs font-bold text-white outline-none focus:border-accent"
              placeholder="0"
            />
            <div className="h-6 flex items-center">
              <p className="text-[8px] text-gray-500 font-bold uppercase italic px-1 leading-none">0 = Free Enrollment</p>
            </div>
          </div>

          {/* Deploy Button */}
          <div className="flex flex-col">
            <div className="h-6 mb-2 hidden md:block" /> {/* Vertical Offset Matcher */}
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-accent hover:bg-accent-aware text-black py-4 rounded-sm text-xs font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,255,102,0.2)] active:scale-95 h-[50px]"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <><Trophy className="w-4 h-4" /> Authorize & Deploy</>}
            </button>
            <div className="h-6" />
          </div>
        </div>
      </div>

      <TacticalConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLaunch}
        title="Tactical Authorization Required"
        message={`DEPLOY PROTOCOL: This will launch a live ${formData.game} promo for ${formData.limit} players. All system resources will be allocated to this event. Proceed?`}
        confirmText="Confirm Deployment"
      />
    </div>
  );
}

export default function AdminPromoPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);

  useEffect(() => {
    // 🛡️ PRUNING PROTOCOL: Only show OPEN and ACTIVE operations in the primary feed.
    const q = query(
      collection(db, "promo_events"),
      where("status", "!=", "COMPLETED"),
      orderBy("status"), // Required for inequality filters in some Firestore versions
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, []);

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="mb-10">
        <p className="text-[10px] text-accent font-black uppercase tracking-[0.3em] mb-2 font-mono">
          Campaign Strategy & Engagement
        </p>
        <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
          Promotional <span className="text-accent underline">Operations</span>
        </h1>
      </div>

      <PromoDeploymentCenter />

      <div className="mt-16">
        <div className="flex items-center gap-3 mb-8">
          <Users className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-black text-white italic uppercase tracking-tight">Active Operation Feed</h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {events.map((e) => (
            <div key={e.id} className="bg-[#0a0a0a] border border-white/5 p-6 rounded-sm flex flex-col md:flex-row md:items-center justify-between gap-6 hover:border-white/10 transition-colors">
              <div className="flex items-center gap-6">
                <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-full flex items-center justify-center">
                  {e.game === 'EFOOTBALL' ? <Trophy className="w-5 h-5 text-blue-400" /> : <ShieldCheck className="w-5 h-5 text-red-500" />}
                </div>
                <div>
                  <h4 className="text-white font-black italic uppercase tracking-tighter text-lg leading-none mb-1">
                    100K RUSH: {e.game}
                  </h4>
                  <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest italic">
                    Limit: {e.participantLimit} Participants · Fee: {e.entryFeeCoins || 0} Coins · Created: {e.createdAt?.toDate?.()?.toLocaleString() || "Syncing..."}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Enlisted</p>
                  <p className="text-xl font-black text-white italic tracking-tighter">{e.participants?.length || 0} / {e.participantLimit}</p>
                </div>
                <div className={`px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest ${e.status === 'OPEN' ? 'bg-accent/10 text-accent border border-accent/20 animate-pulse' : e.status === 'ACTIVE' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}`}>
                  {e.status === 'ACTIVE' ? 'FULL / ACTIVE' : e.status}
                </div>
                <DeletePromoButton promo={e} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DeletePromoButton({ promo }: { promo: any }) {
  const { user } = useAuth();
  const toast = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isRefundMode, setIsRefundMode] = useState(false);

  const handleDelete = async () => {
    try {
      const idToken = await user?.getIdToken();
      if (idToken) {
        await deletePromoEventAction(idToken, promo.id, isRefundMode);
        toast.success(isRefundMode ? "PROMO REFUNDED & TERMINATED" : "PROMO TERMINATED", "The promotional operational record has been expunged.");
      }
    } catch (e) {
      toast.error("DELETION FAILED", "Tactical record could not be purged.");
    }
  };

  const openDelete = () => { setIsRefundMode(false); setIsOpen(true); };
  const openRefund = () => { setIsRefundMode(true); setIsOpen(true); };

  return (
    <div className="flex gap-2">
      {promo.entryFeeCoins > 0 && (promo.participants?.length || 0) > 0 && (
         <button 
           onClick={openRefund}
           className="p-2 bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 hover:bg-yellow-500 hover:text-black transition-all rounded-sm flex items-center justify-center"
           title="Refund Entry Fees & Delete"
         >
           <RefreshCcw className="w-4 h-4 ml-1 mr-1" />
           <span className="text-[10px] uppercase font-black tracking-widest px-1 mr-1">Refund All</span>
         </button>
      )}

      <button 
        onClick={openDelete}
        className="p-2 bg-red-500/10 border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-black transition-all rounded-sm flex items-center justify-center"
        title="Delete Promo (No Refunds)"
      >
        <Trash2 className="w-4 h-4" />
      </button>

      <TacticalConfirmModal 
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onConfirm={handleDelete}
        title={isRefundMode ? "Refund & Terminate?" : "Terminate Operation?"}
        message={isRefundMode ? `Are you sure you want to completely refund the ${promo.participants?.length || 0} participants ${promo.entryFeeCoins} coins each and delete this promo?` : `Are you sure you want to expunge the 100K RUSH: ${promo.game}? This data cannot be recovered once purged.`}
        confirmText={isRefundMode ? "Refund & Expunge" : "Expunge Record"}
        isDanger={true}
      />
    </div>
  );
}
