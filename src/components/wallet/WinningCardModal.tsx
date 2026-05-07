import React, { useRef, useState } from 'react';
import { Trophy, Download, Share2, X, Check, Target, Zap, Landmark } from 'lucide-react';
import { toPng } from 'html-to-image';

interface WinningCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
  game: string;
  amount: string;
  date: string;
  txId: string;
  currency?: string;
  cardType?: 'VICTORY' | 'WITHDRAWAL';
}

export default function WinningCardModal({
  isOpen,
  onClose,
  username,
  game,
  amount,
  date,
  txId,
  currency = 'USD',
  cardType = 'VICTORY'
}: WinningCardModalProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fiatValue, setFiatValue] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchFiat = async () => {
      const crAmount = parseFloat(amount.replace(/,/g, ''));
      if (isNaN(crAmount)) return;
      
      const targetCurrency = currency && currency.toUpperCase() !== 'OTHERS' ? currency.toUpperCase() : 'USD';
      
      if (targetCurrency === 'USD') {
        setFiatValue(`$${(crAmount / 100).toFixed(2)}`);
        return;
      }

      try {
        const { getEffectiveRateAction } = await import('@/app/actions/rate-actions');
        const res = await getEffectiveRateAction(targetCurrency, 'WITHDRAWAL');
        if (res.success && res.rate) {
          const fiat = (crAmount / 100) * res.rate;
          setFiatValue(`≈ ${fiat.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${targetCurrency}`);
        } else {
          setFiatValue(`$${(crAmount / 100).toFixed(2)}`); // fallback
        }
      } catch (e) {
        setFiatValue(`$${(crAmount / 100).toFixed(2)}`);
      }
    };
    if (isOpen) fetchFiat();
  }, [isOpen, amount, currency]);

  if (!isOpen) return null;

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
      link.download = `CGame_${isWithdrawal ? 'Payout' : 'Victory'}_${txId}.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error('Failed to generate image', e);
    }
    setIsExporting(false);
  };

  const handleShare = async () => {
    const text = cardType === 'WITHDRAWAL' 
      ? `I just withdrew ${amount} CR to my local account on cgamecore.online! 💸\nFast & secure payouts.\nJoin the elite combat arena today!`
      : `I just secured ${amount} CR playing ${game} on cgamecore.online! 🏆\nMatch ID: ${txId}\nJoin the elite combat arena today!`;
    
    if (navigator.share) {
      try {
        await navigator.share({
          title: cardType === 'WITHDRAWAL' ? 'CGame Payout!' : 'CGame Victory!',
          text: text,
          url: 'https://cgamecore.online'
        });
      } catch (e) {
        console.error('Error sharing', e);
      }
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isCodm = game.toUpperCase().includes('CODM');
  const isWithdrawal = cardType === 'WITHDRAWAL';

  return (
    <div className="fixed inset-0 z-[100] overflow-y-auto scrollbar-hide">
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
          <div className={`absolute top-0 right-0 w-80 h-80 opacity-20 blur-[100px] rounded-full -mt-20 -mr-20 ${isWithdrawal ? 'bg-green-500' : 'bg-accent'}`} />
          <div className={`absolute bottom-0 left-0 w-80 h-80 opacity-10 blur-[100px] rounded-full -mb-20 -ml-20 ${isWithdrawal ? 'bg-blue-600' : 'bg-blue-500'}`} />
          
          {/* Overlay Texture */}
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />

          <div className="relative z-10 flex flex-col items-center text-center">
            {/* Header: Logo & Site */}
            <div className="flex items-center gap-3 mb-10 w-full justify-between border-b border-white/5 pb-4">
              <div className="text-[11px] font-black italic tracking-[0.3em] text-white uppercase flex items-center gap-2">
                <Trophy className={`w-4 h-4 ${isWithdrawal ? 'text-green-400' : 'text-accent'}`} /> CGAMECORE
              </div>
              <div className="text-[9px] font-black tracking-[0.2em] text-gray-400 uppercase bg-white/5 px-3 py-1 rounded-full border border-white/10">
                cgamecore.online
              </div>
            </div>

            {/* Icon */}
            <div className={`w-28 h-28 rounded-full bg-black border border-white/10 shadow-[0_0_80px_rgba(0,255,102,0.1)] flex items-center justify-center mb-6 relative group`}>
              <div className={`absolute inset-0 border-2 rounded-full animate-ping opacity-20 ${isWithdrawal ? 'border-green-500/30' : 'border-accent/20'}`} />
              {isWithdrawal ? <Landmark className="w-12 h-12 text-green-400" /> : isCodm ? <Target className="w-12 h-12 text-accent" /> : <Zap className="w-12 h-12 text-blue-400" />}
            </div>

            {/* Victory Title */}
            <h2 className="text-4xl font-black text-white italic uppercase tracking-tighter leading-none mb-2 drop-shadow-lg">
              {isWithdrawal ? 'PAYOUT' : 'MATCH'} <span className={isWithdrawal ? 'text-green-400' : 'text-accent'}>{isWithdrawal ? 'SECURED' : 'VICTORY'}</span>
            </h2>
            <p className="text-[11px] text-gray-400 font-bold uppercase tracking-widest mb-8">
              {isWithdrawal ? 'FUNDS SUCCESSFULLY CLEARED' : 'TACTICAL CLEARANCE GRANTED'}
            </p>

            {/* Amount */}
            <div className="w-full bg-black/50 backdrop-blur-sm border border-white/10 py-6 rounded-lg mb-8 relative overflow-hidden shadow-inner">
               <div className={`absolute left-0 top-0 w-1.5 h-full ${isWithdrawal ? 'bg-green-400' : 'bg-accent'}`} />
               <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mb-1">{isWithdrawal ? 'Total Withdrawn' : 'Prize Secured'}</p>
               <div className="flex flex-col items-center justify-center">
                 <h3 className={`text-[3.5rem] font-black italic tracking-tighter leading-none drop-shadow-md ${isWithdrawal ? 'text-green-400' : 'text-accent'}`}>
                    {amount} <span className="text-xl text-white opacity-90">CR</span>
                 </h3>
                 {fiatValue && (
                   <div className={`text-[11px] font-black uppercase tracking-widest mt-3 px-4 py-1.5 rounded-sm border ${isWithdrawal ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-accent/10 text-accent/90 border-accent/20'}`}>
                     {fiatValue}
                   </div>
                 )}
               </div>
            </div>

            {/* Details Grid */}
            <div className="w-full grid grid-cols-2 gap-y-6 gap-x-4 text-left border-t border-b border-white/5 py-5 mb-6 bg-white/[0.02] px-4 rounded-lg">
               <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Operative</p>
                  <p className="text-sm font-black text-white uppercase truncate">{username}</p>
               </div>
               <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">{isWithdrawal ? 'Destination' : 'Arena'}</p>
                  <p className="text-sm font-black text-white uppercase truncate">{game}</p>
               </div>
               <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Date</p>
                  <p className="text-sm font-black text-white uppercase">{date}</p>
               </div>
               <div>
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">{isWithdrawal ? 'Ref ID' : 'Operation Ref'}</p>
                  <p className="text-[11px] font-mono font-black text-gray-400 uppercase">#{txId}</p>
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
            className="flex-1 bg-surface-hover hover:bg-surface border border-surface-border text-white py-4 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
          >
            {isExporting ? <Trophy className="w-4 h-4 animate-spin text-accent" /> : <Download className="w-4 h-4 text-accent" />}
            {isExporting ? 'Generating...' : 'Save Image'}
          </button>
          
          <button
            onClick={handleShare}
            className="flex-1 bg-accent hover:bg-accent-aware text-black py-4 rounded-sm text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,255,102,0.2)] transition-all flex items-center justify-center gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
            {copied ? 'Link Copied!' : 'Share Win'}
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
