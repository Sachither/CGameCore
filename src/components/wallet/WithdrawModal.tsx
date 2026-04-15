"use client";
import React, { useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import { validate, sanitize } from '@/lib/validation-utils';
import { validateNuban, validateCryptoAddressByNetwork } from '@/lib/address-validator';
import { getWithdrawalFee, isCryptoWithdrawalNetwork } from '@/lib/withdrawal-fees';
import { requestWithdrawalAction } from '@/lib/withdrawal-api';
import { getEffectiveRateAction } from '@/app/actions/rate-actions';
import { Landmark, Smartphone, Zap, Globe } from 'lucide-react';

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
  const fiatSupported = false; // ["NG", "GH", "KE", "ZA"].includes(profile?.country || "");
  
  const [gatewayType, setGatewayType] = useState<'BANK' | 'CRYPTO'>(fiatSupported ? 'BANK' : 'CRYPTO');
  const [withdrawalRate, setWithdrawalRate] = useState(1500);
  const matchesPlayed = profile?.totalMatches || 0;
  
  // TIERED LOGIC CONSTANTS
  const isTier1 = balance <= 500;
  const isTier2 = balance > 500 && balance <= 1000;
  const isTier3 = balance > 1000;

  const matchesRequired = isTier1 ? 1 : (isTier2 ? 2 : 0);
  const isEligibleByMatches = matchesPlayed >= matchesRequired;
  
  // ROLLOVER CALCULATION (Tier 3)
  const lifetimeDeposits = profile?.lifetimeDeposits || 0;
  const lifetimeWagered = profile?.lifetimeWagered || 0;
  const unWageredDeposits = Math.max(0, lifetimeDeposits - lifetimeWagered);
  const maxWithdrawable = isTier3 ? Math.max(0, balance - unWageredDeposits) : balance;

  const isEligibleToWithdraw = isTier3 ? (matchesPlayed >= 1) : isEligibleByMatches;

  // IDENTITY LOCK: Initialize from profile
  React.useEffect(() => {
    if (!isOpen) return;
    
    if (profile?.legalName) {
      const [first, ...rest] = profile.legalName.split(' ');
      setFirstName(first || '');
      setLastName(rest.join(' ') || '');
      setHasKYC(true);
    }
  }, [isOpen, profile?.legalName]);

  // REGIONAL RATE LOGIC
  React.useEffect(() => {
    if (!isOpen) return;

    if (profile?.currency) {
      getEffectiveRateAction(profile.currency, 'WITHDRAWAL').then(res => {
        if (res.success && res.rate) setWithdrawalRate(res.rate);
      });
    }

    // 🔒 REGIONAL GATE: Force Crypto for International users
    if (profile?.country && !fiatSupported) {
       setGatewayType('CRYPTO');
       setBankCode('USDT_SOL');
       setBankName('USDT (Solana)');
    }
  }, [isOpen, profile?.currency, profile?.country, fiatSupported]);

  // FEE LOGIC - Shared network fee map
  const isCrypto = gatewayType === 'CRYPTO';
  const withdrawalFee = getWithdrawalFee(bankCode);
  const isSupportedCryptoNetwork = isCrypto && isCryptoWithdrawalNetwork(bankCode);

  // INSTANT VALIDATION - Per-network crypto validation
  const cryptoValidation = isSupportedCryptoNetwork
    ? validateCryptoAddressByNetwork(accountNumber, bankCode)
    : { isValid: !isCrypto, format: isCrypto ? 'Select a valid crypto network' : '' };
  const isValidAddress = isCrypto 
    ? cryptoValidation.isValid
    : validateNuban(accountNumber, bankCode);

  const COUNTRY_BANKS: Record<string, {name: string, code: string}[]> = {
    'NG': [
      { name: 'OPay Digital Services',          code: '999992' },
      { name: 'Moniepoint MFB',                 code: '50515'  },
      { name: 'PalmPay',                        code: '999991' },
      { name: 'GTBank',                         code: '058'    },
      { name: 'UBA',                            code: '033'    },
      { name: 'Access Bank',                    code: '044'    },
      { name: 'First Bank',                     code: '011'    },
      { name: 'Zenith Bank',                    code: '057'    },
    ],
    'GH': [
      { name: 'MTN Mobile Money',               code: 'mtn'    },
      { name: 'Vodafone Cash',                  code: 'vod'    },
      { name: 'AirtelTigo Money',               code: 'atl'    },
      { name: 'GCB Bank',                       code: 'gcb'    },
      { name: 'Ecobank Ghana',                  code: 'eco'    },
    ],
    'KE': [
      { name: 'M-Pesa (Safaricom)',             code: 'mpesa'  },
      { name: 'Airtel Money',                   code: 'airtel' },
      { name: 'Equity Bank',                    code: 'eqy'    },
      { name: 'KCB Bank',                       code: 'kcb'    },
    ],
    'ZA': [
      { name: 'Standard Bank',                  code: 'std'    },
      { name: 'First National Bank (FNB)',      code: 'fnb'    },
      { name: 'Capitec Bank',                   code: 'cap'    },
      { name: 'ABSA Bank',                      code: 'abs'    },
      { name: 'Nedbank',                        code: 'ned'    },
    ]
  };

  const activeBanks = COUNTRY_BANKS[profile?.country || 'NG'] || COUNTRY_BANKS['NG'];

  if (!isOpen) return null;

  const numericCoins = Number(withdrawCoins) || 0;
  const netCoins = Math.max(0, numericCoins - withdrawalFee);
  
  // Real-time local currency payout display
  const localPayoutValue = (netCoins / 100) * withdrawalRate;
  const usdEquivalent = netCoins / 100;
  
  const isInvalidAmount = numericCoins > 0 && (numericCoins < 100); // Minimum $1.00
  const isOverBalance = numericCoins > balance;
  const isOverLimit = isTier3 && numericCoins > maxWithdrawable;

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
    if (!isValidAddress) {
       setError("Account validation failed. Check for typos.");
       return;
    }
    setIsProcessing(true);
    setError('');

    const amtErr = validate("AMOUNT", String(numericCoins));
    if (amtErr) { setError(amtErr); setIsProcessing(false); return; }

    if (bankName === '') {
      setError("Please select a target bank/wallet.");
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
                <div className="flex items-center gap-2">
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Available Balance: {balance} Coins</p>
                   {profile?.country && (
                      <div className="flex items-center gap-1 bg-white/10 px-1.5 py-0.5 rounded-full border border-white/20">
                         <Globe className="w-2 h-2 text-white" />
                         <span className="text-[7px] font-black text-white uppercase tracking-widest">{profile.country} Sector</span>
                      </div>
                   )}
                </div>
              </div>
           </div>
           
           <button onClick={onClose} className="text-gray-500 hover:text-white p-2 bg-surface hover:bg-surface-hover rounded-[3px] transition-colors">
             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
           </button>
        </div>

        {/* Dynamic Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
           
         {/* AML GATE: Tier-Aware Block */}
           {!isEligibleToWithdraw ? (
             <div className="flex flex-col items-center justify-center py-12 text-center space-y-6">
               <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto animate-pulse">
                 <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
               </div>
               <div>
                 <h3 className="text-lg font-black uppercase text-red-400 italic tracking-tighter mb-2">Vault Locked</h3>
                 <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed max-w-xs mx-auto">
                   {isTier1 ? (
                     <>Tier 1: High-stakes bot protection. You must <span className="text-white">play at least 1 match</span> before your first withdrawal.</>
                   ) : (
                     <>Tier 2: Trust verification. You must <span className="text-white">play at least 2 matches</span> to unlock this balance level.</>
                   )}
                 </p>
               </div>
               <div className="bg-black/50 border border-surface-border p-4 rounded-sm w-full">
                 <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest">Matches Played</p>
                 <p className="text-3xl font-black text-red-500 italic">{matchesPlayed} <span className="text-sm text-gray-500">/ {matchesRequired} required</span></p>
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
                   To comply with regulations, you must verify your Legal Name. <strong className="text-white">Your payout name MUST MATCH</strong> your identification. 
                 </p>
               </div>

               <div className="space-y-4">
                 <div>
                   <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Legal First Name</label>
                   <input 
                     type="text" 
                     value={firstName} 
                     onChange={e => setFirstName(e.target.value)}
                     disabled={hasKYC}
                     className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3 rounded-[3px] outline-none transition-all placeholder-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface"
                     placeholder="e.g. David"
                   />
                 </div>
                 <div>
                   <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Legal Surname (Last Name)</label>
                   <input 
                     type="text" 
                     value={lastName} 
                     onChange={e => setLastName(e.target.value)}
                     disabled={hasKYC}
                     className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3 rounded-[3px] outline-none transition-all placeholder-gray-800 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-surface"
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
                
                {/* Identity Locked Badge */}
                {profile?.isIdentityLocked && (
                   <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 px-3 py-2 rounded-sm shadow-inner mb-2">
                      <svg className="w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.033 11.854 11.854 0 01-2.15 11.758c.43 1.473 1.137 2.846 2.064 4.053C6.34 21.05 12 22 12 22s5.66-1.049 7.704-2.211c.927-1.207 1.634-2.58 2.064-4.053A11.854 11.854 0 0119.618 7.984z" /></svg>
                      <div className="flex-1">
                         <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest leading-none">Verified Identity</p>
                         <p className="text-[10px] text-green-500 font-black uppercase tracking-tighter mt-1 italic">{profile.legalName}</p>
                      </div>
                   </div>
                )}

                {/* Tier Info Breakdown */}
                {isTier3 && (
                   <div className="bg-blue-500/5 border border-blue-500/20 p-4 rounded-[3px] space-y-3">
                      <div className="flex justify-between items-center">
                         <span className="text-[9px] font-black uppercase text-blue-400 tracking-widest">Tier 3 Status</span>
                         <span className="text-[9px] font-black uppercase text-white bg-blue-500/20 px-2 py-0.5 rounded-full">1:1 Rollover</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/30 p-2 border border-white/5">
                           <p className="text-[8px] text-gray-500 uppercase font-bold">Deposited</p>
                           <p className="text-xs font-black text-white">{lifetimeDeposits} CR</p>
                        </div>
                        <div className="bg-black/30 p-2 border border-white/5">
                           <p className="text-[8px] text-gray-500 uppercase font-bold">Wagered</p>
                           <p className="text-xs font-black text-green-400">{lifetimeWagered} CR</p>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-white/5">
                         <div className="flex justify-between items-center">
                           <p className="text-[9px] text-gray-400 uppercase font-extrabold tracking-tight">Unlocked Balance</p>
                           <p className="text-sm font-black text-blue-400 italic">{maxWithdrawable} CR</p>
                         </div>
                         <div className="w-full bg-black/50 h-1.5 mt-1 rounded-full overflow-hidden">
                           <div className="bg-blue-500 h-full" style={{ width: `${Math.min(100, (maxWithdrawable / balance) * 100)}%` }}></div>
                         </div>
                      </div>
                   </div>
                )}

                {/* Gateway Toggle */}
                {fiatSupported && (
                   <div className="mb-6">
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1">Payment Protocol</label>
                      <div className="grid grid-cols-2 gap-2 p-1 bg-black/50 border border-surface-border rounded-sm">
                         <button 
                           onClick={() => { setGatewayType('BANK'); setBankCode(''); }}
                           className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 ${gatewayType === 'BANK' ? 'bg-white text-black' : 'text-gray-500 hover:text-white'}`}
                         >
                            {profile?.country === 'GH' || profile?.country === 'KE' ? <Smartphone className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                            {profile?.country === 'GH' || profile?.country === 'KE' ? 'Mobile Money' : 'Bank Transfer'}
                         </button>
                         <button 
                           onClick={() => { setGatewayType('CRYPTO'); setBankCode('USDT_SOL'); }}
                           className={`py-3 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2 ${gatewayType === 'CRYPTO' ? 'bg-[#F2A900] text-black shadow-[0_0_15px_rgba(242,169,0,0.3)]' : 'text-gray-500 hover:text-white'}`}
                         >
                            <Zap className="w-3.5 h-3.5" />
                            Crypto
                         </button>
                      </div>
                   </div>
                )}

                {/* Amount */}
                <div>
                   <label className="text-xs uppercase font-bold text-gray-400 tracking-widest block mb-3 flex justify-between">
                      Withdrawal Amount (Coins)
                      <button onClick={() => setWithdrawCoins(maxWithdrawable)} className="text-accent underline hover:text-white transition-colors">Max: {maxWithdrawable}</button>
                   </label>
                   <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-gray-500 text-lg">C</span>
                      <input 
                        type="number" 
                        value={withdrawCoins}
                        onChange={(e) => setWithdrawCoins(e.target.value)}
                        placeholder="1000" 
                        className={`w-full bg-black border ${isInvalidAmount || isOverBalance || isOverLimit ? 'border-red-500/50' : 'border-surface-border focus:border-white'} text-white font-black text-2xl pl-10 pr-4 py-4 rounded-[3px] outline-none transition-all placeholder-gray-800`}
                      />
                   </div>
                   {isInvalidAmount && <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Minimum withdrawal is 100 Coins.</p>}
                   {isOverBalance && <p className="text-[10px] text-red-500 font-bold tracking-widest uppercase mt-2">Insufficient Balance.</p>}
                   {isOverLimit && <p className="text-[10px] text-yellow-500 font-bold tracking-widest uppercase mt-2">Rollover Limit: Use matches to unlock the remaining {balance - maxWithdrawable} CR.</p>}
                </div>

                {/* Bank Details */}
                <div className="space-y-4 pt-4 border-t border-surface-border">
                  {gatewayType === 'BANK' && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1.5 flex justify-between">
                         <span>1. Destination {profile?.country === 'GH' || profile?.country === 'KE' ? 'Wallet' : 'Bank'}</span>
                      </label>
                      <select 
                         value={bankCode}
                         onChange={e => {
                           const selected = activeBanks.find(b => b.code === e.target.value);
                           setBankCode(e.target.value);
                           setBankName(selected?.name || e.target.value);
                         }}
                         className="w-full bg-black border border-surface-border focus:border-white text-white font-bold p-3.5 rounded-[3px] outline-none transition-all appearance-none cursor-pointer"
                      >
                         <option value="">Select {profile?.country === 'GH' || profile?.country === 'KE' ? 'Provider...' : 'Local Bank...'}</option>
                         {activeBanks.map(b => (
                           <option key={b.code} value={b.code}>{b.name}</option>
                         ))}
                      </select>
                    </div>
                  )}

                  {gatewayType === 'CRYPTO' && (
                    <div>
                      <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block mb-1.5">1. Target Network</label>
                      <select 
                         value={bankCode}
                         onChange={e => {
                           setBankCode(e.target.value);
                           setBankName(e.target.value);
                         }}
                         className="w-full bg-black border border-surface-border focus:border-[#F2A900] text-white font-bold p-3.5 rounded-[3px] outline-none transition-all appearance-none cursor-pointer"
                      >
                         <option value="USDT_SOL">USDT (Solana) - 10 Fee</option>
                         <option value="USDC_SOL">USDC (Solana) - 10 Fee</option>
                         <option value="SOL">Solana (SOL) - 10 Fee</option>
                         <option value="LTC">Litecoin (LTC) - 10 Fee</option>
                      </select>
                      <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">⚡ Best Value: Solana (USDT/USDC/SOL) - Near-zero fees + instant checkout</p>
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] uppercase font-bold text-gray-500 tracking-widest block justify-between flex mb-2">
                       <span>2. {isCrypto ? 'Wallet Address' : 'Account Number'}</span>
                       {bankCode && accountNumber && (
                          <span className={isValidAddress ? "text-green-500" : "text-red-500"}>
                             {isValidAddress ? "✓ Valid" : "✗ Invalid Format"}
                          </span>
                       )}
                    </label>
                    <input 
                      type="text" 
                      disabled={!bankCode}
                      value={accountNumber} 
                      onChange={e => {
                        let val = e.target.value;
                        if (!isCrypto) {
                           // For Banks: Strip non-digits and cap at 10
                           val = val.replace(/\D/g, '').slice(0, 10);
                        }
                        setAccountNumber(val);
                      }}
                      className={`w-full bg-black border ${bankCode && accountNumber && !isValidAddress ? 'border-red-500/50' : 'border-surface-border focus:border-white'} text-white font-mono font-bold text-xs md:text-sm p-3 rounded-[3px] outline-none transition-all placeholder-gray-800 tracking-widest disabled:opacity-50 disabled:cursor-not-allowed`}
                      placeholder={!bankCode ? "Select Gateway First..." : (isCrypto ? `E.g. ${cryptoValidation.format}` : "Enter 10-Digit Account Number...")}
                    />
                    {!bankCode && <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2 ml-1 animate-pulse">Select a bank or crypto gateway to enable this field</p>}
                    {bankCode && isCrypto && !isValidAddress && accountNumber && (
                      <p className="text-[9px] text-red-500 font-bold uppercase tracking-widest mt-2 ml-1">
                        Expected: {cryptoValidation.format}
                      </p>
                    )}
                    {bankCode && isCrypto && (
                      <p className="text-[9px] text-orange-500 font-bold uppercase tracking-widest mt-3 ml-1 bg-orange-500/5 p-2 rounded-[2px] border border-orange-500/20">
                        ⚠️ Confirm Address Carefully: Crypto transfers are <span className="text-red-400 font-black">irreversible</span>. Entry errors = permanent loss.
                      </p>
                    )}
                  </div>
                </div>

                {/* Ledger */}
                <div className="bg-surface border border-surface-border p-4 rounded-[3px] space-y-2 mt-4">
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                     <span>Withdrawal Breakdown</span>
                     <span className="text-white">{numericCoins} Coins Requested</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                     <span>Network & Service Fee</span>
                     <span className="text-red-500">-{withdrawalFee} Coins</span>
                  </div>
                  <div className="flex justify-between text-[10px] uppercase font-bold text-gray-400 tracking-widest">
                     <span>Net Amount</span>
                     <span className="text-green-400">= {netCoins} Coins</span>
                  </div>
                  <div className="w-full h-px border-dashed border-t border-surface-border my-2"></div>
                  <div className="flex justify-between items-center px-1 pt-2">
                     <span className="text-[10px] uppercase font-bold text-white tracking-widest">You Will Receive</span>
                     <span className="text-lg font-black font-mono text-accent tracking-tighter">
                        ≈ ${usdEquivalent.toFixed(2)} USD
                     </span>
                  </div>
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
                disabled={!isValidAddress || isInvalidAmount || isOverBalance || isOverLimit || numericCoins === 0 || bankCode === '' || isProcessing || !!success}
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
