"use client";
import React, { useEffect, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { toPng } from 'html-to-image';
import { Trophy, Download, X, Check } from 'lucide-react';
import { useAuth } from "@/components/auth/AuthProvider";

interface VictoryCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  playerName: string;
  gameLabel: string;
  prizeAmount: number;
  isTournamentChampion: boolean;
  rewardType: 'COINS' | 'USD';
}

export default function VictoryCelebrationModal({
  isOpen,
  onClose,
  playerName,
  gameLabel,
  prizeAmount,
  isTournamentChampion,
  rewardType,
}: VictoryCelebrationModalProps) {
  const { profile } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [localCurrencyValue, setLocalCurrencyValue] = useState<string | null>(null);

  // Prize amount in CR (coins)
  const prizeInCR = Math.round(prizeAmount);

  // Fetch local currency conversion on mount
  useEffect(() => {
    const fetchConversion = async () => {
      if (!isOpen || !profile?.country) {
        setLocalCurrencyValue(null);
        return;
      }

      try {
        const { getEffectiveRateAction } = await import('@/app/actions/rate-actions');
        const userCurrency = profile.currency || 'USD';
        
        if (userCurrency === 'USD') {
          setLocalCurrencyValue(`$${(prizeInCR / 100).toFixed(2)}`);
          return;
        }

        const res = await getEffectiveRateAction(userCurrency, 'WITHDRAWAL');

        if (res.success && res.rate) {
          const converted = (prizeInCR / 100) * res.rate;
          setLocalCurrencyValue(`≈ ${converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${userCurrency}`);
        } else {
          setLocalCurrencyValue(`$${(prizeInCR / 100).toFixed(2)}`);
        }
      } catch (e) {
        console.error('Rate conversion error:', e);
        setLocalCurrencyValue(`$${(prizeInCR / 100).toFixed(2)}`);
      }
    };

    fetchConversion();
  }, [isOpen, profile, prizeInCR]);

  // Trigger confetti animation when modal opens
  useEffect(() => {
    if (isOpen) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          spread: 100,
          origin: { y: 0.6 },
        });
      }, 500);
    }
  }, [isOpen]);

  const handleDownload = async () => {
    if (!cardRef.current) return;
    setIsExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        cacheBust: true,
        backgroundColor: '#000000',
        pixelRatio: 2,
      });
      const link = document.createElement('a');
      link.download = `CGame_Victory_${playerName}_${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to generate image', e);
    }
    setIsExporting(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto scrollbar-hide">
      <div className="fixed inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      
      <div className="min-h-full w-full flex items-center justify-center p-4 py-16">
        <div className="relative w-full max-w-md animate-in zoom-in-95 duration-300">
          <button 
            onClick={onClose}
            className="absolute -top-12 right-0 p-2 text-gray-500 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          {/* --- EXPORTABLE CARD AREA --- */}
          <div 
            ref={cardRef} 
            className="relative bg-[#050505] border border-white/10 rounded-[12px] overflow-hidden shadow-2xl p-8"
          >
            {/* Background Ambient Glows */}
            <div className="absolute top-0 right-0 w-80 h-80 opacity-20 blur-[100px] rounded-full -mt-20 -mr-20 bg-accent" />
            <div className="absolute bottom-0 left-0 w-80 h-80 opacity-10 blur-[100px] rounded-full -mb-20 -ml-20 bg-blue-500" />
            
            {/* Overlay Texture */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

            <div className="relative z-10 flex flex-col items-center text-center">
              {/* Header: Logo & Site */}
              <div className="flex items-center gap-3 mb-10 w-full justify-between border-b border-white/5 pb-4">
                <div className="text-[11px] font-black italic tracking-[0.3em] text-white uppercase flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-accent" /> CGAMECORE
                </div>
                <div className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/10">
                  cgamecore.online
                </div>
              </div>

              {/* Victory Title */}
              <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-2 drop-shadow-lg">
                MATCH <span className="text-accent">VICTORY</span>
              </h2>
              <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-8">
                TACTICAL CLEARANCE GRANTED
              </p>

              {/* Prize Amount Section */}
              <div className="w-full bg-black/50 backdrop-blur-sm border border-white/10 py-6 rounded-lg mb-8 relative overflow-hidden shadow-inner">
                <div className="absolute left-0 top-0 w-1.5 h-full bg-accent" />
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">Prize Secured</p>
                <div className="flex flex-col items-center justify-center">
                  <h3 className="text-[3.5rem] font-black italic tracking-tighter leading-none drop-shadow-md text-accent">
                    {prizeInCR.toLocaleString()} <span className="text-xl text-white opacity-90">CR</span>
                  </h3>
                  {localCurrencyValue && (
                    <div className="text-[11px] font-black uppercase tracking-widest mt-3 px-4 py-1.5 rounded-sm border bg-accent/10 text-accent/90 border-accent/20">
                      {localCurrencyValue}
                    </div>
                  )}
                </div>
              </div>

              {/* Details Grid */}
              <div className="w-full grid grid-cols-2 gap-y-6 gap-x-4 text-left border-t border-b border-white/5 py-5 mb-6 bg-white/[0.02] px-4 rounded-lg">
                <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Operative</p>
                  <p className="text-sm font-black text-white uppercase truncate">{playerName}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Arena</p>
                  <p className="text-sm font-black text-white uppercase truncate">{gameLabel}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Match Status</p>
                  <p className="text-sm font-black text-accent uppercase">{isTournamentChampion ? 'Champion' : 'Victory'}</p>
                </div>
                <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm font-black text-white uppercase">{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</p>
                </div>
              </div>

              <div className="text-[9px] text-gray-500 font-black uppercase tracking-[0.3em] w-full text-center flex items-center justify-center gap-2">
                <Check className="w-3 h-3 text-gray-500" /> VERIFIED ON BLOCKCHAIN-SECURED LEDGER
              </div>
            </div>
          </div>
          {/* --- END EXPORTABLE CARD --- */}

          {/* Action Buttons */}
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleDownload}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 bg-accent hover:bg-accent/90 text-black font-black uppercase tracking-widest py-3 rounded-sm transition-colors disabled:opacity-50"
            >
              <Download size={18} className="w-5 h-5" />
              {isExporting ? 'Exporting...' : 'Save Image'}
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white font-black uppercase tracking-widest py-3 rounded-sm transition-colors border border-white/20"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
