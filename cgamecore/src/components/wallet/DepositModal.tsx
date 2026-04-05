"use client";
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { verifyPaystackPaymentAction, createPendingDepositAction } from '@/app/actions/paystack-actions';

// Tactical Paystack Integration (Inline popup)
const PAYSTACK_PUB_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY;

export default function DepositModal({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) {
  const { user, refreshProfile } = useAuth();
  const [amountNaira, setAmountNaira] = useState<number | string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  
  if (!isOpen) return null;

  const numericNaira = Number(amountNaira) || 0;
  const coinsGenerated = Math.floor(numericNaira / 15);
  const isInvalid = numericNaira > 0 && numericNaira < 1500;

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
    if (!user || numericNaira < 1500) return;
    
    setIsProcessing(true);
    setErrorMessage("");

    try {
      const idToken = await user.getIdToken();

      // 1. Create Handshake with Server (Pre-Auth)
      const handshake = await createPendingDepositAction(idToken, numericNaira);
      if (!handshake.success) {
        setErrorMessage(handshake.error || "Handshake Failed.");
        setIsProcessing(false);
        return;
      }

      const reference = handshake.reference;

      // 2. Load and Open Paystack
      await loadPaystack();
      const PaystackPop = (window as any).PaystackPop;
      
      const handler = PaystackPop.setup({
        key: PAYSTACK_PUB_KEY,
        email: user.email || "sabastinechika123@gmail.com",
        amount: Math.round(numericNaira * 100), // Kobo
        currency: "NGN",
        reference: reference, // USE OUR BACKEND-GENERATED REFERENCE
        onClose: () => {
          setIsProcessing(false);
          setErrorMessage("Transaction Suspended. Return to confirm later if paid.");
        },
        callback: function(response: any) {
          // Success! Verify on server
          (async () => {
            const result = await verifyPaystackPaymentAction(idToken, response.reference);
            
            if (result.success) {
              setSuccess(true);
              await refreshProfile();
              setTimeout(() => {
                onClose();
                setSuccess(false);
                setAmountNaira('');
              }, 3000);
            } else {
              setErrorMessage(result.error || "Gateway Link Error.");
            }
            setIsProcessing(false);
          })();
        }
      });

      handler.openIframe();
    } catch (err: any) {
      console.error(err);
      setErrorMessage("Gateway Initialization Failed.");
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      
      <div className="relative w-full max-w-md bg-surface border border-surface-border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="bg-black border-b border-surface-border p-5 flex justify-between items-center z-10">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
             </div>
             <div>
               <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Deposit Funds</h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Load your Wallet Balance</p>
             </div>
           </div>
           
           <button onClick={onClose} className="text-gray-500 hover:text-white p-2 bg-surface hover:bg-surface-hover rounded-[3px] transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 flex-1 relative">
           {success && (
             <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-300">
                <div className="w-20 h-20 rounded-full bg-accent/20 border border-accent/50 flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,255,102,0.2)]">
                   <svg className="w-10 h-10 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-2">₦{numericNaira.toLocaleString()} Deposited</h3>
                <p className="text-[10px] text-accent font-bold uppercase tracking-widest">+ {coinsGenerated.toLocaleString()} Coins added to vault</p>
             </div>
           )}

           {errorMessage && (
             <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-[3px] text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
               {errorMessage}
             </div>
           )}

           <div>
              <label className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3">Amount to Deposit (₦)</label>
              <div className="relative">
                 <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">₦</span>
                 <input 
                   type="number" 
                   value={amountNaira}
                   onChange={(e) => setAmountNaira(e.target.value)}
                   placeholder="1500" 
                   disabled={isProcessing}
                   className={`w-full bg-black border ${isInvalid ? 'border-red-500/50' : 'border-surface-border focus:border-blue-500'} text-white font-black text-2xl pl-10 pr-4 py-4 rounded-[3px] outline-none transition-all placeholder-gray-800 disabled:opacity-50`}
                 />
              </div>
              
              {isInvalid ? (
                <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Minimum deposit is ₦1,500.</p>
              ) : (
                <p className="text-[10px] text-gray-500 font-bold tracking-widest uppercase mt-2">Minimum deposit: ₦1,500</p>
              )}
           </div>

           <div className="grid grid-cols-3 gap-2">
              {[1500, 4500, 15000].map(amt => (
                <button 
                  key={amt} 
                  onClick={() => setAmountNaira(amt.toString())}
                  disabled={isProcessing}
                  className="bg-black/50 border border-surface-border hover:border-blue-500/50 hover:bg-black text-[10px] font-bold text-gray-400 py-2 rounded-[3px] uppercase tracking-widest transition-colors disabled:opacity-50"
                >
                  +₦{amt.toLocaleString()}
                </button>
              ))}
           </div>

           <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-[3px] flex items-center justify-between">
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">You Will Receive:</span>
              <span className="font-black text-xl text-white font-mono tracking-tighter">
                {numericNaira > 0 ? coinsGenerated.toLocaleString() : '0'} <span className="text-blue-400 text-sm">COINS</span>
              </span>
           </div>
        </div>

        {/* Action */}
        <div className="p-6 bg-black border-t border-surface-border">
           <button 
              disabled={numericNaira < 1500 || isProcessing || success}
              onClick={handleDeposit}
              className="w-full bg-blue-500 hover:bg-blue-400 disabled:bg-surface disabled:text-gray-500 disabled:border overflow-hidden disabled:border-surface-border disabled:shadow-none transition-all py-4 rounded-[3px] text-white font-black uppercase tracking-widest shadow-[0_0_20px_rgba(59,130,246,0.3)] flex justify-center items-center h-14"
           >
              {isProcessing ? (
                <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                "Confirm & Pay with Paystack"
              )}
           </button>
        </div>
      </div>
    </div>
  );
}
