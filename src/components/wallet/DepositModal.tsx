"use client";
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { verifyPaystackPaymentAction, createPendingDepositAction } from '@/app/actions/paystack-actions';
import { createNowPaymentInvoiceAction } from '@/app/actions/nowpayments-actions';
import { Globe, AlertTriangle } from 'lucide-react';

// Tactical Paystack Integration (Inline popup)
const PAYSTACK_PUB_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

export default function DepositModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, profile, refreshProfile } = useAuth();
  const [amountUsd, setAmountUsd] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'FIAT' | 'CRYPTO'>('CRYPTO');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  const fiatSupported = ["NG", "GH", "KE", "ZA"].includes(profile?.country || "");

  // 🔒 REGIONAL GATE: Force Crypto for non-fiat regions
  React.useEffect(() => {
    if (profile?.country && !fiatSupported) {
      setPaymentMethod('CRYPTO');
    }
  }, [profile?.country, fiatSupported]);

  if (!isOpen) return null;

  const numericUsd = Number(amountUsd) || 0;
  const coinsGenerated = Math.floor(numericUsd * 100);
  const minRequired = paymentMethod === 'CRYPTO' ? 3 : 1;
  const isInvalid = numericUsd > 0 && numericUsd < minRequired;

  const loadPaystack = () => {
    return new Promise((resolve) => {
      if ((window as any).PaystackPop) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://js.paystack.co/v1/inline.js";
      script.onload = () => resolve(true);
      document.body.appendChild(script);
    });
  };

  const handleDeposit = async () => {
    if (!user || numericUsd < minRequired) return;
    
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const idToken = await user.getIdToken();

      if (paymentMethod === 'FIAT') {
        // --- PAYSTACK FLOW ---
        const handshake = await createPendingDepositAction(idToken, numericUsd);
        if (!handshake.success) {
          setErrorMessage(handshake.error || "Handshake Failed.");
          setIsProcessing(false);
          return;
        }

        const reference = handshake.reference;

        await loadPaystack();
        const PaystackPop = (window as any).PaystackPop;
        
        const handler = PaystackPop.setup({
          key: PAYSTACK_PUB_KEY,
          email: user.email || "sabastinechika123@gmail.com",
          amount: Math.round((handshake.localAmount || 0) * 100), 
          currency: handshake.currency || "NGN", 
          reference: reference, 
          onClose: () => {
             setIsProcessing(false);
             setErrorMessage("Transaction Suspended. Return to confirm later if paid.");
          },
          callback: function(response: any) {
            (async () => {
              const result = await verifyPaystackPaymentAction(idToken, response.reference);
              if (result.success) {
                setSuccess(true);
                await refreshProfile();
                setTimeout(() => {
                  onClose();
                  setSuccess(false);
                  setAmountUsd('');
                }, 3000);
              } else {
                setErrorMessage(result.error || "Gateway Link Error.");
              }
              setIsProcessing(false);
            })();
          }
        });
        handler.openIframe();
      } else {
        // --- CRYPTO FLOW (NowPayments) ---
        const result = await createNowPaymentInvoiceAction(idToken, numericUsd);
        if (result.success && result.invoice_url) {
           // Redirect strictly to NowPayments Secure Invoice
           window.location.href = result.invoice_url;
        } else {
           setErrorMessage(result.error || "Failed to initialize Crypto Gateway.");
           setIsProcessing(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Gateway Initialization Failed.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-surface border border-surface-border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col custom-scrollbar max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-black border-b border-surface-border p-5 flex justify-between items-center z-10 shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
             </div>
              <div>
                <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Deposit Funds</h2>
                <div className="flex items-center gap-2">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Load your Vault</p>
                   {profile?.country && (
                      <div className="flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 rounded-full border border-blue-500/20">
                         <Globe className="w-2 h-2 text-blue-400" />
                         <span className="text-[7px] font-black text-blue-400 uppercase tracking-widest">{profile.country} Sector</span>
                      </div>
                   )}
                </div>
              </div>
           </div>
           
           <button onClick={onClose} className="text-gray-500 hover:text-white p-2 bg-surface hover:bg-surface-hover rounded-[3px] transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 overflow-y-auto">
           {success && (
             <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,102,0.2)]">
                   <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">${numericUsd.toFixed(2)} Deposited</h3>
                <p className="text-[10px] text-accent font-bold uppercase tracking-widest">+ {coinsGenerated.toLocaleString()} Coins added to vault</p>
             </div>
           )}

            {errorMessage && (
              <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-[3px] text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
                {errorMessage}
              </div>
            )}

           {/* Rate Transparency */}
           <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 px-4 py-2 rounded-sm mb-4">
              <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Universal Rate</span>
              <span className="text-[10px] text-blue-400 font-black italic uppercase tracking-tighter">100 Coins = $1.00 USD</span>
           </div>

           {/* Gateway Selector */}
           {fiatSupported && (
              <div className="mb-4">
                 <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">Select Gateway</label>
                 <div className="flex gap-2 p-1 bg-black/50 border border-surface-border rounded-md">
                    <button 
                      onClick={() => setPaymentMethod('FIAT')}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-sm transition-all ${paymentMethod === 'FIAT' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-gray-500 hover:text-white'}`}
                    >
                       Instant Pay (Card / Bank / Mobile)
                    </button>
                    <button 
                      onClick={() => setPaymentMethod('CRYPTO')}
                      className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-sm transition-all ${paymentMethod === 'CRYPTO' ? 'bg-[#F2A900] text-black shadow-[0_0_15px_rgba(242,169,0,0.4)]' : 'text-gray-500 hover:text-white'}`}
                    >
                       Crypto
                    </button>
                 </div>
              </div>
           )}

           {/* Crypto Selection Info */}
           {paymentMethod === 'CRYPTO' && (
             <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="bg-[#F2A900]/10 border border-[#F2A900]/30 p-4 rounded-sm mb-4">
                   <h4 className="text-[10px] font-black uppercase text-[#F2A900] mb-2 flex items-center gap-2">
                     <AlertTriangle className="w-3.5 h-3.5" />
                     Network Fee Warning
                   </h4>
                   <p className="text-[9px] text-gray-300 font-bold uppercase tracking-widest leading-relaxed">
                     You (the sender) are responsible for the network/gas fee. This fee goes to the blockchain miners, not the platform.
                   </p>
                   <div className="mt-3 pt-3 border-t border-[#F2A900]/20">
                      <p className="text-[9px] text-white font-black uppercase tracking-widest">
                        Recommended: Use <span className="text-[#F2A900]">TRX (Tron)</span> or <span className="text-[#F2A900]">LTC (Litecoin)</span> to keep fees under $0.10.
                      </p>
                   </div>
                </div>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em] mb-4 text-center">
                  You will choose your specific coin on the next page.
                </p>
             </div>
           )}

           <div>
              <label className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3">Amount to Deposit (USD)</label>
              <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">$</span>
                 <input 
                   type="number" 
                   value={amountUsd}
                   onChange={(e) => setAmountUsd(e.target.value)}
                   placeholder="1.00" 
                   disabled={isProcessing}
                   className={`w-full bg-black border ${isInvalid ? 'border-red-500/50' : 'border-surface-border focus:border-white'} text-white font-black text-2xl pl-10 pr-4 py-4 rounded-[3px] outline-none transition-all placeholder-gray-800 disabled:opacity-50`}
                 />
              </div>
              
               {isInvalid ? (
                 <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Minimum {paymentMethod === 'CRYPTO' ? 'crypto' : ''} deposit is ${minRequired.toFixed(2)} USD.</p>
               ) : (
                 <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-2">Minimum {paymentMethod === 'CRYPTO' ? 'crypto' : ''} deposit: ${minRequired.toFixed(2)} USD</p>
               )}
           </div>

           <div className="grid grid-cols-3 gap-2">
              {[1, 10, 50].map(amt => (
                <button 
                  key={amt} 
                  onClick={() => setAmountUsd(amt.toString())}
                  disabled={isProcessing}
                  className="bg-black/50 border border-surface-border hover:border-white hover:bg-black text-[11px] font-bold text-gray-400 py-2 rounded-[3px] uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  +${amt}
                </button>
              ))}
           </div>

           <div className="bg-white/5 border border-white/10 p-4 rounded-[3px] flex items-center justify-between">
              <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">You Will Receive:</span>
              <span className="font-black text-xl text-white font-mono tracking-tighter">
                {numericUsd > 0 ? coinsGenerated.toLocaleString() : '0'} <span className="text-gray-500 text-sm">COINS</span>
              </span>
           </div>
        </div>

        {/* Action */}
        <div className="p-6 bg-black border-t border-surface-border shrink-0">
           <button 
              disabled={numericUsd < minRequired || isProcessing || success}
              onClick={handleDeposit}
              className={`w-full disabled:bg-surface disabled:text-gray-500 disabled:border overflow-hidden disabled:border-surface-border disabled:shadow-none transition-all py-4 rounded-[3px] text-white font-black uppercase tracking-widest flex justify-center items-center h-14 ${
                paymentMethod === 'FIAT' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-[#F2A900] text-black hover:bg-[#F2A900]/80 shadow-[0_0_20px_rgba(242,169,0,0.3)]'
              }`}
           >
              {isProcessing ? (
                <svg className="animate-spin h-5 w-5 text-current" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                paymentMethod === 'FIAT' ? "Confirm & Pay securely" : "Continue to Crypto Checkout"
              )}
           </button>
        </div>
      </div>
    </div>
  );
}
