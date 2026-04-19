"use client";

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { getActivePromoAction, joinPromoEventAction } from '@/app/actions/promo-actions';
import { getEffectiveRateAction } from '@/app/actions/rate-actions';
import { Trophy, Users, Zap, Loader2, ShieldCheck, Flame, ChevronLeft, ChevronRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';

export default function PromoTournamentCard() {
  const { user } = useAuth();
  const [promos, setPromos] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [rate, setRate] = useState(1500);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

  const fetchInitialData = async () => {
    try {
      const rateRes = await getEffectiveRateAction('NGN', 'DEPOSIT');
      if (rateRes.success) setRate(rateRes.rate ?? 1500);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInitialData();

    // 📡 REAL-TIME SMART LISTENER
    // Automatically updates player counts and removes the card when full/closed
    const q = query(
      collection(db, "promo_events"),
      where("status", "==", "OPEN"),
      orderBy("createdAt", "desc"),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setPromos([]);
      } else {
        const fetched = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setPromos(fetched);
        if (currentIndex >= fetched.length) setCurrentIndex(0);
      }
      setLoading(false);
    }, (err) => {
      console.error("[PromoCard] Listener Error:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleJoin = async () => {
    const promo = promos[currentIndex];
    if (!user || !promo) return;
    setJoining(true);
    setMessage(null);
    try {
      const idToken = await user.getIdToken();
      const res = await joinPromoEventAction(idToken, promo.id);
      if (res.success) {
        setMessage({ text: "YOU ARE IN! Awaiting combat deployment once slots are filled.", type: 'success' });
        // The real-time listener will update the counts automatically
      } else {
        setMessage({ text: res.error || "Tactical Failure", type: 'error' });
      }
    } catch (e) {
      setMessage({ text: "Neural Link Interrupted", type: 'error' });
    }
    setJoining(false);
  };

  if (loading) return null; // Or skeleton
  if (promos.length === 0) return null;

  const promo = promos[currentIndex];
  const isJoined = promo.participants?.includes(user?.uid);
  const progress = (promo.participants?.length / promo.participantLimit) * 100;

  return (
    <div className="w-full mb-10 relative">
      {promos.length > 1 && (
        <div className="flex justify-between items-end mb-3 animate-in fade-in duration-500">
           <div className="flex items-center gap-2">
             <span className="text-[10px] text-accent font-black uppercase tracking-widest bg-accent/10 border border-accent/20 px-3 py-1.5 rounded-[3px]">
                Active Operations: {currentIndex + 1} / {promos.length}
             </span>
           </div>
           <div className="flex gap-2">
             <button onClick={() => setCurrentIndex(p => p === 0 ? promos.length - 1 : p - 1)} className="p-2 bg-black hover:bg-white/5 border border-white/10 text-accent rounded-[3px] transition-all">
               <ChevronLeft className="w-4 h-4" />
             </button>
             <button onClick={() => setCurrentIndex(p => (p + 1) % promos.length)} className="p-2 bg-black hover:bg-white/5 border border-white/10 text-accent rounded-[3px] transition-all">
               <ChevronRight className="w-4 h-4" />
             </button>
           </div>
        </div>
      )}

      <div key={promo.id} className="relative overflow-hidden bg-black border border-accent/30 rounded-sm shadow-[0_0_50px_rgba(0,255,102,0.1)] group animate-in fade-in slide-in-from-right-4 duration-500">
        {/* Background Hype Elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]" />
        
        {/* Glowing Top Bar */}
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-accent to-transparent opacity-50" />

        <div className="p-6 md:p-10 flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
          <div className="flex-1">
             <div className="flex items-center gap-3 mb-4">
                <div className="flex bg-accent/10 border border-accent/20 px-3 py-1 rounded-sm gap-2 items-center">
                   <Flame className="w-3.5 h-3.5 text-accent animate-bounce" />
                   <span className="text-[10px] font-black text-accent uppercase tracking-widest italic">Official Platform Launch Promo</span>
                </div>
                {isJoined && (
                   <div className="flex bg-blue-500/10 border border-blue-500/20 px-3 py-1 rounded-sm gap-2 items-center animate-pulse">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Enlisted for Combat</span>
                   </div>
                )}
             </div>

             <h2 className="text-4xl md:text-6xl font-black text-white italic uppercase tracking-tighter mb-4 leading-none">
                100K <span className="text-accent-aware">Promo Rush</span>
             </h2>
             
             <p className="max-w-xl text-[11px] md:text-xs text-gray-400 font-bold uppercase tracking-widest leading-relaxed mb-8">
                Join the ultimate {promo.game} tournament {promo.entryFeeCoins > 0 ? `for just ${promo.entryFeeCoins} Coins` : <span className="text-white underline italic">for FREE</span>}. 
                Winner takes home <span className="text-accent underline">{Math.round(promo.prizeNGN || 0).toLocaleString()} NGN</span> (${(promo.prizeUSD || 0).toFixed(2)}). 
                {promo.entryFeeCoins > 0 ? (
                  ` A 100 Coin wallet balance is required for verification (the ${promo.entryFeeCoins} fee will be deducted).`
                ) : (
                  " Requires a minimum 100 Coin wallet balance for verification, but no coins will be deducted."
                )}
             </p>

             <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl">
                <div>
                   <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Combat Arena</p>
                   <p className="text-xl font-black text-white italic tracking-tighter uppercase">{promo.game}</p>
                </div>
                <div>
                   <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Grand Prize</p>
                   <p className="text-xl font-black text-accent italic tracking-tighter uppercase">{Math.round(promo.prizeNGN || 0).toLocaleString()} NGN</p>
                </div>
                <div>
                   <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Entry Fee</p>
                   <p className={`text-xl font-black ${promo.entryFeeCoins > 0 ? 'text-orange-500' : 'text-green-500'} italic tracking-tighter uppercase`}>
                     {promo.entryFeeCoins > 0 ? `${promo.entryFeeCoins} COINS` : 'FREE-JOIN'}
                   </p>
                </div>
                <div>
                   <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">Status</p>
                   <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                      <p className="text-sm font-black text-white italic tracking-tighter uppercase">ACTIVE</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="lg:w-96 shrink-0">
             <div className="bg-white/5 border border-white/10 p-8 rounded-sm backdrop-blur-md relative">
                <div className="flex items-center justify-between mb-6">
                   <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Participants</span>
                   </div>
                   <span className="text-lg font-black text-white italic tracking-tighter">
                      {promo.participants?.length} / {promo.participantLimit}
                   </span>
                </div>

                {/* Cyber Progress Bar */}
                <div className="relative h-2 bg-white/5 rounded-full overflow-hidden mb-10 border border-white/5">
                   <div 
                      className="absolute top-0 left-0 h-full bg-gradient-to-r from-accent/50 to-accent transition-all duration-1000 shadow-[0_0_10px_rgba(0,255,102,0.5)]" 
                      style={{ width: `${progress}%` }}
                   />
                </div>

                {message && (
                   <div className={`mb-6 p-4 rounded-sm border ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-accent/10 border-accent/20 text-accent'} text-[10px] font-black uppercase tracking-widest text-center animate-in zoom-in-95 duration-300`}>
                      {message.text}
                   </div>
                )}

                {!isJoined ? (
                  <button 
                    disabled={joining || promo.participants?.length >= promo.participantLimit}
                    onClick={handleJoin}
                    className="w-full bg-accent hover:bg-accent-aware text-black py-5 rounded-sm text-sm font-black uppercase tracking-widest italic flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-[0_0_20px_rgba(0,255,102,0.2)] disabled:opacity-50 disabled:grayscale"
                  >
                    {joining ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Trophy className="w-5 h-5" /> Confirm Entry</>}
                  </button>
                ) : (
                  <div className="w-full bg-white/5 border border-white/10 text-gray-400 py-5 rounded-sm text-sm font-black uppercase tracking-widest italic flex items-center justify-center gap-3">
                    <ShieldCheck className="w-5 h-5" /> Enlisted
                  </div>
                )}
                
                <p className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-6">
                   {promo.entryFeeCoins > 0 ? `Fee deducted upon enrollment` : `Verification only · No coins taken`}
                </p>
             </div>
          </div>
        </div>

        {/* Diagonal Ribbon Overlay */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-accent opacity-10 blur-3xl rounded-full -ml-16 -mt-16" />
      </div>
    </div>
  );
}
