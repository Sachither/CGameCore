"use client";
import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import { db } from '@/lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { verifyFlutterwavePaymentAction, createPendingFlutterwaveDepositAction } from '@/app/actions/flutterwave-actions';
import { createNowPaymentInvoiceAction, checkNowPaymentStatusAction } from '@/app/actions/nowpayments-actions';
import { Globe, AlertTriangle, RefreshCw, Loader2 } from 'lucide-react';

// Tactical Flutterwave V3 Integration (Inline popup)
const FLW_PUB_KEY = process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY;

export default function DepositModal({
  isOpen,
  onClose,
  isSuccessRedirect = false
}: {
  isOpen: boolean,
  onClose: () => void,
  isSuccessRedirect?: boolean
}) {
  const { user, profile, refreshProfile } = useAuth();
  const [amountUsd, setAmountUsd] = useState<number | string>('');
  const [paymentMethod, setPaymentMethod] = useState<'FIAT' | 'CRYPTO'>('CRYPTO');
  const [isProcessing, setIsProcessing] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [orderReference, setOrderReference] = useState<string | null>(null);
  const [isReceiptMode, setIsReceiptMode] = useState(false);
  const [confirmedUsd, setConfirmedUsd] = useState<number>(0);

  const fiatSupported = true; // RE-ENABLED: Paystack UI was hidden, now transit to Flutterwave
  const numericUsd = Number(amountUsd) || 0;
  const coinsGenerated = Math.floor(numericUsd * 100);
  const minRequired = paymentMethod === 'CRYPTO' ? 1 : 1; // Testing: Reduced to $1.00 for SOL/LTC
  const isInvalid = numericUsd > 0 && numericUsd < minRequired;

  // 🔒 REGIONAL GATE: Force Crypto for non-fiat regions
  React.useEffect(() => {
    if (profile?.country && !fiatSupported) {
      setPaymentMethod('CRYPTO');
    }
  }, [profile?.country, fiatSupported]);

  // 🚀 REDIRECT RECOVERY: Detect if we've returned from a gateway (MoMo/Crypto)
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (!isOpen || success) return;

    // 1. Detect Flutterwave Direct Redirects (e.g. Ghana MoMo)
    const urlStatus = searchParams.get('status');
    const urlRef = searchParams.get('tx_ref') || searchParams.get('transaction_id');

    if (urlStatus === 'successful' && urlRef) {
      console.log("[DepositModal] Resuming from Flutterwave redirect:", urlRef);
      setOrderReference(urlRef);
      setIsReceiptMode(true);
      setIsProcessing(true); // Hold on spinner until Listener finds database record
      return;
    }

    // 2. Detect Legacy/Crypto Redirect (Success Link)
    if (isSuccessRedirect) {
      // Check for cached crypto context
      const cached = localStorage.getItem('last_crypto_order');
      if (cached && !orderReference) {
        const { reference, amount } = JSON.parse(cached);
        if (reference) {
          setOrderReference(reference);
          setIsReceiptMode(true);
          setIsProcessing(true);
          return;
        }
      }
    }
  }, [isOpen, searchParams, isSuccessRedirect, success, orderReference]);

  // 🕒 AUTO-DISMISS: Close and reset modal after success
  React.useEffect(() => {
    if (success && isOpen) {
      const timer = setTimeout(() => {
        localStorage.removeItem('last_crypto_order');
        onClose();
        // Reset local states after close animation (approx 300ms)
        setTimeout(() => {
          setSuccess(false);
          setIsReceiptMode(false);
          setAmountUsd('');
          setConfirmedUsd(0);
          setStatusMessage("");
          setOrderReference(null);
          localStorage.removeItem('last_fiat_amount');
          localStorage.removeItem('last_fiat_reference');
          localStorage.removeItem('last_crypto_order');
        }, 500);
      }, 7000); // 7 seconds to allow reading the message

      return () => clearTimeout(timer);
    }
  }, [success, isOpen, onClose]);

  // 📡 REAL-TIME TRANSACTION LISTENER
  // This is a background backup for the success confirmation
  React.useEffect(() => {
    if (!orderReference || success || !isOpen) return;

    console.log("[DepositModal] Attaching real-time listener to:", orderReference);
    const unsubscribe = onSnapshot(doc(db, "transactions", orderReference), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        console.log("[DepositModal] Receiver Status update:", data.status);

        if (data.status === 'COMPLETED') {
          console.log("[DepositModal] ✅ Database confirmation received. Amount:", data.fiatAmount);
          const fallbackAmt = Number(localStorage.getItem('last_fiat_amount')) || 0;
          const finalAmt = data.fiatAmount || fallbackAmt || Number(amountUsd) || 0;
          setConfirmedUsd(finalAmt);
          setIsProcessing(false);
          setSuccess(true);
          refreshProfile();
        }
      }
    });

    return () => unsubscribe();
  }, [orderReference, success, isOpen, refreshProfile]);

  const handleManualCheck = async () => {
    if (!user || !orderReference) return;
    setIsCheckingStatus(true);
    setStatusMessage("Checking with Payment APIs...");

    try {
      const idToken = await user.getIdToken();
      let result;

      if (orderReference?.startsWith('CGC-FW-')) {
        // --- FLUTTERWAVE MANUAL RECOVERY ---
        setIsReceiptMode(true);
        setStatusMessage("Verifying record with Flutterwave...");
        result = await verifyFlutterwavePaymentAction(idToken, orderReference);

        if (result.success) {
          setStatusMessage("Confirmed! Synchronizing Vault...");
          if (result.fiatAmount) setConfirmedUsd(result.fiatAmount);
          setSuccess(true); // FORCE Success Screen NOW
          await refreshProfile();
        } else {
          setStatusMessage(result.error || "Payment record not ready yet.");
        }
      } else {
        // --- NOWPAYMENTS MANUAL RECOVERY ---
        setStatusMessage("Checking NowPayments network...");
        result = await checkNowPaymentStatusAction(idToken, orderReference);

        if (result.success && result.status === 'COMPLETED') {
          setStatusMessage("Confirmed! Balance updated.");
          setSuccess(true); // FORCE Success Screen NOW
          await refreshProfile();
          setTimeout(() => setStatusMessage(""), 3000);
        } else {
          setStatusMessage(result.message || result.error || "Payment still processing.");
          setTimeout(() => setStatusMessage(""), 4000);
        }
      }
    } catch (err) {
      console.error(err);
      setStatusMessage("Verification failed. Try again shortly.");
    } finally {
      setIsCheckingStatus(false);
    }
  };

  if (!isOpen) return null;

  const loadFlutterwave = () => {
    return new Promise((resolve) => {
      if ((window as any).FlutterwaveCheckout) return resolve(true);
      const script = document.createElement("script");
      script.src = "https://checkout.flutterwave.com/v3.js";
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
        console.log("[Flutterwave] Starting handshake for amount:", numericUsd);
        const handshake = await createPendingFlutterwaveDepositAction(idToken, numericUsd);

        if (!handshake.success) {
          console.error("[Flutterwave] Handshake failed:", handshake.error);
          setErrorMessage(handshake.error || "Handshake Failed.");
          setIsProcessing(false);
          return;
        }

        const txRef = handshake.reference;
        setOrderReference(txRef ?? null);
        localStorage.setItem('last_fiat_reference', txRef || "");
        localStorage.setItem('last_fiat_amount', numericUsd.toString());
        console.log("[Flutterwave] Handshake successful. Reference:", txRef);

        await loadFlutterwave();
        const FlutterwaveCheckout = (window as any).FlutterwaveCheckout;

        if (!FlutterwaveCheckout) {
          console.error("[Flutterwave] Library failed to load.");
          setErrorMessage("Payment library failed to load. Check your internet.");
          setIsProcessing(false);
          return;
        }

        if (!FLW_PUB_KEY) {
          console.error("[Flutterwave] CRITICAL: NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY is missing from .env.local!");
          setErrorMessage("Gateway Configuration Error (Missing Public Key).");
          setIsProcessing(false);
          return;
        }

        console.log("[Flutterwave] Opening Gateway Popup...");

        const country = profile?.country || 'NG';
        let paymentOptions = "card, account, banktransfer, ussd";
        if (country === 'GH') paymentOptions = "card, mobilemoneygh";
        else if (country === 'KE') paymentOptions = "card, mpesa";
        else if (country === 'ZA') paymentOptions = "card, banktransfer";

        FlutterwaveCheckout({
          public_key: FLW_PUB_KEY,
          tx_ref: txRef,
          amount: handshake.localAmount || 0,
          currency: handshake.currency || "NGN",
          payment_options: paymentOptions,
          redirect_url: window.location.origin + window.location.pathname + "?status=redirect_check",
          customer: {
            email: user.email || "sabastinechika123@gmail.com",
            name: profile?.username || "CGame Operative",
          },
          customizations: {
            title: "CGameCore Wallet",
            description: `Vault Deposit (${coinsGenerated.toLocaleString()} Coins)`,
            logo: "https://cgamecore.vercel.app/logo.png",
          },
          meta: {
            uid: user.uid,
            platform_handshake: txRef
          },
          onclose: () => {
            setIsProcessing(false);
            setIsReceiptMode(true); // Now we start waiting for confirmation
            if (!success) {
              setErrorMessage("");
              setStatusMessage("WAITING FOR CONFIRMATION: Verify your transfer in your bank app. Your coins will appear here automatically once credited.");
            }
          },
          callback: function (data: any) {
            (async () => {
              const fwId = data.transaction_id || data.id;
              const result = await verifyFlutterwavePaymentAction(idToken, fwId.toString(), txRef);

              if (result.success) {
                if (result.fiatAmount) setConfirmedUsd(result.fiatAmount);
                setSuccess(true); // FORCE Success Screen NOW
                await refreshProfile();
              } else {
                setErrorMessage(result.error || "Gateway verification stalled.");
              }
              setIsProcessing(false);
            })();
          }
        });
      } else {
        // --- CRYPTO FLOW ---
        const result = await createNowPaymentInvoiceAction(idToken, numericUsd);
        if (result.success && result.invoice_url) {
          setOrderReference(result.reference || null);
          if (result.reference) {
            localStorage.setItem('last_crypto_order', JSON.stringify({
              reference: result.reference,
              amount: numericUsd
            }));
          }
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
        <div className="p-6 space-y-6 flex-1 overflow-y-auto min-h-[300px]">
          {(success || isReceiptMode) && (
            <div className="absolute inset-0 z-20 bg-black/95 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 animate-in zoom-in duration-300">
              {!success ? (
                <>
                  <Loader2 className="w-12 h-12 text-accent animate-spin mb-6" />
                  <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-2">Verifying Payment</h3>
                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-[0.2em]">Please wait. Retrieving verified receipt from the network...</p>
                </>
                ) : (
                <>
                  <div className="w-24 h-24 rounded-full bg-accent/20 border-2 border-accent flex items-center justify-center mb-6 shadow-[0_0_50px_rgba(0,255,102,0.4)] animate-bounce">
                    <svg className="w-12 h-12 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={4} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <h3 className="text-3xl font-black text-white italic uppercase tracking-tighter mb-2">
                    ${(confirmedUsd || Number(amountUsd) || 0).toFixed(2)} Secured
                  </h3>
                  <div className="flex items-center gap-2 mb-6">
                    <div className="h-[2px] w-8 bg-accent" />
                    <p className="text-[11px] text-accent font-black uppercase tracking-[0.2em]">
                      + {Math.floor((confirmedUsd || Number(amountUsd) || 0) * 100).toLocaleString()} Coins Credited
                    </p>
                    <div className="h-[2px] w-8 bg-accent" />
                  </div>
                  <div className="bg-accent/10 border border-accent/20 px-4 py-2 rounded-full mb-6">
                    <p className="text-[9px] text-accent font-black uppercase tracking-widest">Transaction Verified by Nexus Protocol</p>
                  </div>
                </>
              )}

              <div className="mt-8 flex flex-col items-center gap-3 w-full max-w-[220px]">
                <button
                  onClick={handleManualCheck}
                  disabled={isCheckingStatus}
                  className="w-full h-10 bg-accent/20 hover:bg-accent/30 border border-accent/40 rounded-full flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isCheckingStatus ? (
                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                  ) : (
                    <RefreshCw className="w-4 h-4 text-accent" />
                  )}
                  <span className="text-[9px] font-black text-white uppercase tracking-widest">Manual Verify</span>
                </button>

                {statusMessage && (
                  <p className="text-[8px] text-gray-400 font-bold uppercase tracking-widest animate-pulse text-center">{statusMessage}</p>
                )}

                <button
                  onClick={onClose}
                  className="text-[9px] font-black text-gray-500 hover:text-white uppercase tracking-widest mt-4"
                >
                  Close Window
                </button>
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-[3px] text-red-500 text-[10px] font-black uppercase tracking-widest text-center animate-pulse">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-between items-center bg-blue-500/5 border border-blue-500/10 px-4 py-2 rounded-sm mb-4">
            <span className="text-[9px] text-gray-500 font-bold uppercase tracking-[0.2em]">Universal Rate</span>
            <span className="text-[10px] text-blue-400 font-black italic uppercase tracking-tighter">100 Coins = $1.00 USD</span>
          </div>

          {fiatSupported && (
            <div className="mb-4">
              <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">Select Gateway</label>
              <div className="flex gap-2 p-1 bg-black/50 border border-surface-border rounded-md">
                <button
                  onClick={() => setPaymentMethod('FIAT')}
                  className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest rounded-sm transition-all ${paymentMethod === 'FIAT' ? 'bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]' : 'text-gray-500 hover:text-white'}`}
                >
                  Local Gateway
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

          <div>
            <label className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3">Amount to Deposit (USD)</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-400 text-lg">$</span>
              <input
                type="number"
                value={amountUsd}
                min="0"
                onKeyDown={(e) => {
                  if (['e', 'E', '-', '+'].includes(e.key)) {
                    e.preventDefault();
                  }
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '' || Number(val) >= 0) {
                    setAmountUsd(val);
                  }
                }}
                placeholder="1.00"
                disabled={isProcessing}
                className={`w-full bg-black border ${isInvalid ? 'border-red-500/50' : 'border-surface-border focus:border-white'} text-white font-black text-2xl pl-10 pr-4 py-4 rounded-[3px] outline-none transition-all placeholder-gray-800 disabled:opacity-50`}
              />
            </div>
            {isInvalid && <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Minimum deposit is ${minRequired.toFixed(2)} USD.</p>}
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
            className={`w-full disabled:bg-surface transition-all py-4 rounded-[3px] text-white font-black uppercase tracking-widest flex justify-center items-center h-14 ${paymentMethod === 'FIAT' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_0_20px_rgba(37,99,235,0.3)]' : 'bg-[#F2A900] text-black hover:bg-[#F2A900]/80'
              }`}
          >
            {isProcessing && !orderReference ? (
              <Loader2 className="animate-spin h-5 w-5 text-current" />
            ) : (
              paymentMethod === 'FIAT' ? "Confirm & Pay" : "Continue to Crypto"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
