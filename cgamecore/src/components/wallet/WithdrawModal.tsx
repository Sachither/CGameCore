"use client";
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { requestWithdrawalAction } from '@/app/actions/wallet-actions';
import { validate, sanitize } from '@/lib/validation-utils';

export default function WithdrawModal({ isOpen, onClose, balance }: { isOpen: boolean, onClose: () => void, balance: number }) {
  // KYC States
  const [hasKYC, setHasKYC] = useState(false); // Mock condition: false = forces name input
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  
  // Withdrawal States
  const [withdrawCoins, setWithdrawCoins] = useState<number | string>('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const { user, profile } = useAuth();

  const isEligibleToWithdraw = (profile?.totalMatches || 0) >= 1;

  const NIGERIAN_BANKS = [
    { name: 'OPay Digital Services',          code: '999992' },
    { name: 'Moniepoint Microfinance (MFB)',  code: '50515'  },
    { name: 'PalmPay',                        code: '999991' },
    { name: 'Guaranty Trust Bank (GTBank)',   code: '058'    },
    { name: 'United Bank for Africa (UBA)',   code: '033'    },
    { name: 'Access Bank',                    code: '044'    },
    { name: 'First Bank of Nigeria',          code: '011'    },
    { name: 'Zenith Bank',                    code: '057'    },
    { name: 'Wema Bank',                      code: '035'    },
    { name: 'Kuda Microfinance Bank',         code: '50211'  },
  ];

  if (!isOpen) return null;

  const numericCoins = Number(withdrawCoins) || 0;
  const nairaEquivalent = numericCoins * 15;
  const isInvalidAmount = numericCoins > 0 && numericCoins < 100;
  const isOverBalance = numericCoins > balance;

  const handleKYCSubmit = () => {
    const sFirst = sanitize(firstName);
    const sLast = sanitize(lastName);
    if (sFirst && sLast) {
      setFirstName(sFirst);
      setLastName(sLast);
      setHasKYC(true);
    } else {
      setError("Please enter valid legal names.");
    }
  };

  const handleWithdrawal = async () => {
    if (!user) return;
    setIsProcessing(true);
    setError('');

    const amtErr = validate("AMOUNT", String(numericCoins));
    if (amtErr) { setError(amtErr); setIsProcessing(false); return; }

    const accErr = validate("ACCOUNT_NUMBER", accountNumber);
    if (accErr) { setError(accErr); setIsProcessing(false); return; }

    if (bankName === '') {
      setError("Please select a target bank.");
      setIsProcessing(false);
      return;
    }
    try {
      const idToken = await user.getIdToken();
      const result = await requestWithdrawalAction(
        idToken,
        numericCoins,
        bankName,
        bankCode,
        accountNumber,
        `${firstName} ${lastName}`
      );

      if (!result.success) {
        setError(result.error || "Failed to process request.");
      } else {
        setSuccess("Payout Requested Successfully! It is now pending admin security review.");
        setTimeout(() => {
           onClose();
           // Reset form
           setSuccess('');
           setWithdrawCoins('');
        }, 3000);
      }
    } catch (e: any) {
      setError(e.message || "Network error. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-surface border border-surface-border rounded-xl shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-black border-b border-surface-border p-5 flex justify-between items-center z-10 shrink-0">
           <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
             </div>
             <div>
               <h2 className="text-xl font-black italic uppercase tracking-tighter text-white">Withdraw Funds</h2>
               <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Available Balance: {balance} Coins</p>
             </div>
           </div>
           
           <button onClick={onClose} className="text-gray-500 hover:text-white p-2 bg-surface hover:bg-surface-hover rounded-[3px] transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        {/* Dynamic Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           
         {/* AML GATE: Block if user has never played */}
           {!isEligibleToWithdraw ? (
             <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
               <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto animate-pulse">
                 <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
               <div>
                 <h3 className="text-lg font-black uppercase text-red-400 italic tracking-tighter mb-2">Vault Locked</h3>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                   You must <span className="text-white">play at least 1 match</span> before you can withdraw. This protects the platform from financial abuse.
                 </p>
               </div>
               <div className="bg-black/50 border border-surface-border p-4 rounded-sm w-full">
                 <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Matches Played</p>
                 <p className="text-3xl font-black text-red-500 italic">{profile?.totalMatches || 0} <span className="text-sm text-gray-500">/ 1 required</span></p>
               </div>
               <button onClick={onClose} className="w-full py-3 bg-surface border border-surface-border text-gray-400 hover:text-white font-black uppercase tracking-widest text-[10px] rounded-sm transition-colors">
                 Go Play a Match First
               </button>
             </div>
           ) : !hasKYC ? (
             /* KYC SETUP STATE */
             <div className="space-y-6">
               <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-[3px]">
                 <h3 className="text-xs font-black uppercase tracking-widest text-yellow-500 flex items-center gap-2 mb-2">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                   Identity KYC Required
                 </h3>
                 <p className="text-[10px] text-gray-400 uppercase tracking-wide font-bold leading-relaxed">
                   To comply with Escrow regulations, you must verify your Legal Name. <strong className="text-white">Your withdrawal Bank Account Name MUST EXACTLY MATCH</strong> the name you provide below. Any mismatch will instantly bounce and incur a penalty routing fee.
                 </p>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Legal First Name</label>
                   <input 
                     type="text" 
                     value={firstName} onChange={e => setFirstName(e.target.value)}
                     className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3 rounded-[3px] outline-none transition-all placeholder-gray-800"
                     placeholder="e.g. David"
                   />
                 </div>
                 <div>
                   <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Legal Surname (Last Name)</label>
                   <input 
                     type="text" 
                     value={lastName} onChange={e => setLastName(e.target.value)}
                     className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3 rounded-[3px] outline-none transition-all placeholder-gray-800"
                     placeholder="e.g. CGame"
                   />
                 </div>
                 
                 <button 
                    disabled={!firstName.trim() || !lastName.trim()}
                    onClick={handleKYCSubmit}
                    className="w-full mt-4 bg-white hover:bg-gray-200 disabled:bg-surface disabled:text-gray-500 disabled:border-surface-border text-black font-black uppercase tracking-widest py-4 rounded-[3px] transition-all"
                 >
                    Lock Identity Details
                 </button>
               </div>
             </div>
           ) : (
             /* ACTUAL WITHDRAWAL STATE */
             <div className="space-y-6">
                
                {/* KYC Header Confirmed */}
                <div className="bg-black/50 border border-surface-border p-3 rounded-[3px] flex items-center justify-between">
                   <div className="flex items-center gap-2">
                     <svg className="w-4 h-4 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                     <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Verified Identity:</span>
                   </div>
                   <span className="text-white font-black italic uppercase tracking-tighter">{firstName} {lastName}</span>
                </div>

                {/* Amount */}
                <div>
                   <label className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3 flex justify-between">
                      Withdrawal Amount (Coins)
                      <button onClick={() => setWithdrawCoins(balance)} className="text-accent underline hover:text-white transition-colors">Max: {balance}</button>
                   </label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-500 text-lg">C</span>
                      <input 
                        type="number" 
                        value={withdrawCoins}
                        onChange={(e) => setWithdrawCoins(e.target.value)}
                        placeholder="100" 
                        className={`w-full bg-black border ${isInvalidAmount || isOverBalance ? 'border-red-500/50' : 'border-surface-border focus:border-white'} text-white font-black text-2xl pl-10 pr-4 py-4 rounded-[3px] outline-none transition-all placeholder-gray-800`}
                      />
                   </div>
                   {isInvalidAmount && <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Minimum withdrawal is 100 Coins.</p>}
                   {isOverBalance && <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Insufficient Coin Balance.</p>}
                </div>

                {/* Bank Details */}
                <div className="space-y-4 pt-4 border-t border-surface-border">
                   <div>
                     <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">Select Destination Bank</label>
                     <select 
                        value={bankCode}
                        onChange={e => {
                          const selected = NIGERIAN_BANKS.find(b => b.code === e.target.value);
                          setBankCode(e.target.value);
                          setBankName(selected?.name || '');
                        }}
                        className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3.5 rounded-[3px] outline-none transition-all appearance-none cursor-pointer"
                     >
                        <option value="">Select Bank</option>
                        {NIGERIAN_BANKS.map(b => (
                          <option key={b.code} value={b.code}>{b.name}</option>
                        ))}
                     </select>
                   </div>
                   <div>
                     <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-2">10-Digit Account Number</label>
                     <input 
                       type="text" 
                       maxLength={10}
                       value={accountNumber} onChange={e => setAccountNumber(e.target.value)}
                       className="w-full bg-black border border-surface-border focus:border-white text-white font-mono font-bold text-lg p-3 rounded-[3px] outline-none transition-all placeholder-gray-800 tracking-widest"
                       placeholder="0000000000"
                     />
                   </div>
                </div>

                {/* Ledger */}
                <div className="bg-surface border border-surface-border p-4 rounded-[3px] space-y-2 mt-4">
                   <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                      <span>Conversion Ratio</span>
                      <span className="text-white">1 Coin = ₦15</span>
                   </div>
                   <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                      <span>Processing Fee</span>
                      <span className="text-accent">Free (0 Coins)</span>
                   </div>
                   <div className="w-full h-px border-dashed border-t border-surface-border my-2"></div>
                   <div className="flex justify-between items-center px-1">
                      <span className="text-[10px] uppercase font-bold text-white tracking-widest">Total Fiat Payout</span>
                      <span className="text-lg font-black font-mono text-white tracking-tighter">₦ {nairaEquivalent.toLocaleString()}</span>
                   </div>
                   <p className="text-[8px] text-yellow-500/80 font-bold uppercase tracking-widest mt-3 pt-3 border-t border-surface-border leading-relaxed text-center">
                     Payouts are manually reviewed for security to prevent win-trading. Please allow up to 24 hours for funds to hit your bank account.
                   </p>
                </div>

                {error && <p className="text-center text-[10px] text-red-500 font-bold uppercase tracking-widest">{error}</p>}
                {success && <p className="text-center text-[10px] text-green-400 font-bold uppercase tracking-widest">{success}</p>}
             </div>
           )}
        </div>

        {/* Action */}
        {isEligibleToWithdraw && hasKYC && (
          <div className="p-6 bg-black border-t border-surface-border shrink-0">
             <button 
                disabled={isInvalidAmount || isOverBalance || numericCoins === 0 || accountNumber.length < 10 || bankCode === '' || isProcessing || !!success}
                onClick={handleWithdrawal}
                className="w-full bg-white hover:bg-gray-200 disabled:bg-surface disabled:text-gray-500 disabled:border overflow-hidden disabled:border-surface-border disabled:shadow-none transition-all py-4 rounded-[3px] text-black font-black uppercase tracking-widest shadow-[0_0_20px_rgba(255,255,255,0.2)] flex justify-center items-center h-14"
             >
                {isProcessing ? (
                  <svg className="animate-spin h-5 w-5 text-black" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                ) : (
                  "Submit Payout Request"
                )}
             </button>
          </div>
        )}
      </div>
    </div>
  );
}
