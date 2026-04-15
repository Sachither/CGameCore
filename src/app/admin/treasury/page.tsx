"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getPendingWithdrawalsAction, adminApproveWithdrawalAction, adminRejectWithdrawalAction, getUserAuditHistoryAction, getPlatformTransactionsAction } from "@/app/actions/admin-actions";
import { Landmark, Loader2, CheckCircle2, XCircle, Clock, AlertTriangle, User, Search, Target, ShieldAlert, ExternalLink, Trophy, Skull, Calendar, ArrowUpRight, ArrowDownLeft, Wallet, History, ReceiptText } from "lucide-react";

export default function AdminTreasuryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'WITHDRAWALS' | 'TRANSACTIONS'>('WITHDRAWALS');
  const [tickets, setTickets] = useState<any[]>([]);
  const [platformTransactions, setPlatformTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  
  // Big Data States
  const [transactionLimit, setTransactionLimit] = useState(50);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadMoreLoading, setLoadMoreLoading] = useState(false);
  
  // Custom Modals
  const [ticketToApprove, setTicketToApprove] = useState<any>(null);
  const [ticketToReject, setTicketToReject] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Audit States
  const [isAuditOpen, setAuditOpen] = useState(false);
  const [auditUid, setAuditUid] = useState<string | null>(null);
  const [auditUsername, setAuditUsername] = useState("");
  const [auditData, setAuditData] = useState<any[]>([]);
  const [auditJoinDate, setAuditJoinDate] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  const fetchData = useCallback(async (isLoadMore = false) => {
    if (!user) return;
    if (!isLoadMore) setLoading(true);
    else setLoadMoreLoading(true);

    const idToken = await user.getIdToken();
    
    if (activeTab === 'WITHDRAWALS') {
      const result = await getPendingWithdrawalsAction(idToken);
      if (result.success) setTickets(result.tickets || []);
    } else {
      const result = await getPlatformTransactionsAction(idToken, transactionLimit);
      if (result.success) setPlatformTransactions(result.transactions || []);
    }
    setLoading(false);
    setLoadMoreLoading(false);
  }, [user, activeTab, transactionLimit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const confirmApprove = async () => {
    if (!user || !ticketToApprove) return;
    setProcessingId(ticketToApprove.id);
    setFeedback("");
    const idToken = await user.getIdToken();
    const result = await adminApproveWithdrawalAction(idToken, ticketToApprove.id);
    if (result.success) {
      setFeedback("✓ Automatic payout initiated. Ticket Approved & Closed.");
      await fetchData();
    } else {
      setFeedback(`✗ Error: ${result.error}`);
    }
    setProcessingId(null);
    setTicketToApprove(null);
  };

  const confirmReject = async () => {
    if (!user || !ticketToReject || !rejectReason.trim()) return;
    setProcessingId(ticketToReject.id);
    setFeedback("");
    const idToken = await user.getIdToken();
    const result = await adminRejectWithdrawalAction(idToken, ticketToReject.id, rejectReason);
    if (result.success) {
      setFeedback("✓ Ticket Rejected & Coins Refunded.");
      await fetchData();
    } else {
      setFeedback(`✗ Error: ${result.error}`);
    }
    setProcessingId(null);
    setTicketToReject(null);
    setRejectReason("");
  };

  const handleOpenAudit = async (uid: string, username: string) => {
    setAuditUid(uid);
    setAuditUsername(username);
    setAuditOpen(true);
    setAuditLoading(true);
    setAuditData([]);

    if (!user) return;
    const idToken = await user.getIdToken();
    const result = await getUserAuditHistoryAction(idToken, uid);
    if (result.success) {
      setAuditData(result.audit || []);
      setAuditJoinDate(result.joinDate || null);
    }
    setAuditLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em] mb-1">Admin Command Center</p>
          <h1 className="text-4xl font-black text-white italic uppercase tracking-tighter">
            Platform <span className="text-red-400">Treasury</span>
          </h1>
          <p className="text-gray-600 text-[10px] uppercase font-bold tracking-widest mt-1">
            Manual Payout Queue & Operator Withdrawals
          </p>
        </div>
        <div className="bg-[#0a0a0a] border border-white/5 px-6 py-3 rounded-sm flex items-center gap-3">
           <Landmark className="w-5 h-5 text-yellow-500" />
           <div>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest leading-none">Pending Liquidity</p>
              <p className="text-white font-black italic uppercase tracking-tighter text-lg mt-0.5">
                 $ {tickets.reduce((acc, t) => acc + (t.amountCoins / 100), 0).toFixed(2)} USD
              </p>
           </div>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-4 mb-8 border-b border-white/5 pb-px">
         <button 
           onClick={() => setActiveTab('WITHDRAWALS')}
           className={`pb-4 px-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'WITHDRAWALS' ? 'text-red-400' : 'text-gray-500 hover:text-white'}`}
         >
            Withdrawal Queue ({tickets.length})
            {activeTab === 'WITHDRAWALS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />}
         </button>
         <button 
           onClick={() => setActiveTab('TRANSACTIONS')}
           className={`pb-4 px-2 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'TRANSACTIONS' ? 'text-red-400' : 'text-gray-500 hover:text-white'}`}
         >
            Transaction Ledger
            {activeTab === 'TRANSACTIONS' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-red-400 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />}
         </button>
      </div>

      {feedback && (
        <div className={`mb-6 px-4 py-3 rounded-sm border text-[10px] font-black uppercase tracking-widest ${feedback.startsWith("✓") ? "bg-green-500/10 border-green-500/30 text-green-400" : "bg-red-500/10 border-red-500/30 text-red-400"}`}>
          {feedback}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-24">
          <Loader2 className="w-6 h-6 text-gray-600 animate-spin" />
        </div>
      ) : activeTab === 'WITHDRAWALS' ? (
        <>
          {/* Security */}
          <div className="bg-yellow-500/10 border-2 border-yellow-500/30 p-5 rounded-sm shadow-[0_0_30px_rgba(234,179,8,0.15)] mb-8 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-yellow-500 mb-1">Automated Payout APi Active</h3>
              <p className="text-[11px] font-bold text-gray-400 leading-relaxed max-w-3xl">
                Clicking <span className="text-green-400 font-black">APPROVE</span> will automatically trigger a real transfer via the <span className="text-white font-black">Designated Payout API</span> directly to the user's destination account. Clicking <span className="text-red-400 font-black">REJECT</span> will automatically refund the coins back into their app wallet for them to play with again.
              </p>
            </div>
          </div>

           {tickets.length === 0 ? (
            <div className="bg-[#0a0a0a] border border-white/5 rounded-sm py-24 flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-green-500/20 mb-4" />
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">No pending withdrawals in the queue</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-2 custom-scrollbar">
              {tickets.map((t) => {
                // Crypto network fee map
                const cryptoFeeMap: Record<string, number> = {
                  'USDT_TRC20': 100,
                  'USDC_SOL': 10,
                  'USDT_POLYGON': 50,
                  'USDT_ETH': 200,
                  'BTC': 500,
                  'ETH': 300
                };
                
                const isCrypto = ['USDT_TRC20', 'USDC_SOL', 'USDT_POLYGON', 'USDT_ETH', 'BTC', 'ETH'].includes(t.bankName);
                const fee = isCrypto ? (cryptoFeeMap[t.bankName] || 100) : 10;
                const netCoins = Math.max(0, t.amountCoins - fee);
                const netUSD = (netCoins / 100).toFixed(2);
                
                return (
                <div key={t.id} className="bg-[#0a0a0a] border border-white/5 hover:border-white/20 transition-all rounded-sm overflow-hidden flex flex-col md:flex-row">
                   
                   {/* Left Column: User & Amount (Darker) */}
                   <div className="bg-black/40 p-6 md:w-64 shrink-0 border-b md:border-b-0 md:border-r border-white/5 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-4">
                         <Clock className="w-3.5 h-3.5 text-yellow-500" />
                         <span className="text-[9px] text-yellow-500 font-black uppercase tracking-widest">Pending</span>
                      </div>
                      <div>
                         <p className="text-3xl font-black text-white italic tracking-tighter leading-none mb-1">
                            $ {netUSD} USD
                         </p>
                         <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                            {t.amountCoins.toLocaleString()} Coins Deducted
                         </p>
                         {isCrypto && (
                           <p className="text-[9px] text-gray-600 font-bold uppercase tracking-widest mt-2">
                              Fee: -{fee} Coins = {netCoins.toLocaleString()} Net
                           </p>
                         )}
                      </div>
                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center gap-2 text-gray-400 max-w-full overflow-hidden">
                         <User className="w-3.5 h-3.5 shrink-0" />
                         <span className="text-[10px] font-black uppercase tracking-widest truncate">{t.username}</span>
                      </div>
                   </div>

                   {/* Center Column: Banking Logic */}
                   <div className="p-6 flex-1 flex flex-col justify-center">
                      <div className="grid grid-cols-2 gap-6">
                         <div>
                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">
                              {isCrypto ? 'Network' : 'Bank Name'}
                            </p>
                            <p className="text-sm font-bold text-white tracking-widest uppercase">{t.bankName}</p>
                         </div>
                         <div>
                            <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mb-1">
                              {isCrypto ? 'Wallet Address' : 'Account Number'}
                            </p>
                            <p className={`font-mono font-black text-white tracking-widest break-all ${isCrypto ? 'text-xs' : 'text-2xl'}`}>
                              {t.accountNumber}
                            </p>
                         </div>
                         <div className="col-span-2">
                             <div className="flex items-center gap-2 mb-1">
                                <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Beneficiary Legal Name</p>
                                {t.isVerifiedIdentity && (
                                   <div className="flex items-center gap-1 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                                      <ShieldAlert className="w-2.5 h-2.5 text-green-500" />
                                      <span className="text-[7px] font-black text-green-500 uppercase">Verified Identity</span>
                                   </div>
                                )}
                             </div>
                             <p className="text-sm font-bold text-yellow-500 tracking-widest uppercase">{t.legalName}</p>
                          </div>
                      </div>
                   </div>

                   {/* Right Column: Actions */}
                   <div className="p-6 md:w-56 shrink-0 bg-black/20 border-t md:border-t-0 md:border-l border-white/5 flex flex-col gap-3 justify-center">
                      <button
                        disabled={processingId !== null}
                        onClick={() => setTicketToApprove(t)}
                        className="w-full py-4 bg-green-500/10 hover:bg-green-500/20 border border-green-500/20 text-green-400 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {processingId === t.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Execute Payout
                      </button>
                      <button
                        onClick={() => handleOpenAudit(t.uid, t.username)}
                        className="w-full py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-sm transition-all flex items-center justify-center gap-2"
                      >
                        <Search className="w-3.5 h-3.5" />
                        Audit Player
                      </button>
                      <button
                        disabled={processingId !== null}
                        onClick={() => setTicketToReject(t)}
                        className="w-full py-2.5 bg-red-500/5 hover:bg-red-500/10 border border-red-500/20 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Reject & Refund
                      </button>
                   </div>
                </div>
              );
              })}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-6">
           {/* Ledger Controls */}
           <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="relative w-full md:w-96">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                 <input 
                   type="text"
                   placeholder="Filter by Operative / Reference..."
                   value={searchQuery}
                   onChange={(e) => setSearchQuery(e.target.value)}
                   className="w-full bg-[#0a0a0a] border border-white/5 rounded-sm py-3 pl-10 pr-4 text-[11px] text-white font-bold outline-none focus:border-red-500/40 transition-all uppercase tracking-widest"
                 />
              </div>
              <div className="flex items-center gap-2">
                 <ReceiptText className="w-4 h-4 text-gray-600" />
                 <span className="text-[9px] text-gray-600 font-black uppercase tracking-widest">Displaying {platformTransactions.length} records</span>
              </div>
           </div>

           <div className="bg-[#0a0a0a] border border-white/5 rounded-sm overflow-hidden">
             <div className="max-h-[60vh] overflow-auto custom-scrollbar">
              <table className="w-full text-left border-collapse">
                 <thead className="bg-black border-b border-white/5 text-[9px] text-gray-500 font-black uppercase tracking-widest sticky top-0 z-10">
                    <tr>
                       <th className="px-6 py-4 bg-black">Timestamp</th>
                       <th className="px-6 py-4 bg-black">Operative</th>
                       <th className="px-6 py-4 bg-black">Action Type</th>
                       <th className="px-6 py-4 bg-black">Fiat Amount ($)</th>
                       <th className="px-6 py-4 bg-black">Coins (CR)</th>
                       <th className="px-6 py-4 bg-black text-right">Reference</th>
                    </tr>
                 </thead>
                 <tbody className="text-[11px] font-bold">
                    {platformTransactions
                     .filter(tx => 
                        !searchQuery || 
                        tx.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tx.reference?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        tx.id.toLowerCase().includes(searchQuery.toLowerCase())
                     )
                     .map((tx) => (
                       <tr key={tx.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors leading-normal text-gray-300">
                          <td className="px-6 py-4 text-gray-500 font-mono">
                             {new Date(tx.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="px-6 py-4">
                             <div className="flex items-center gap-2">
                                <div className="w-5 h-5 rounded-full bg-red-500/20 flex items-center justify-center">
                                   <User className="w-2.5 h-2.5 text-red-400" />
                                </div>
                                <span className="text-white uppercase italic tracking-tighter">{tx.username || 'Anonymous'}</span>
                             </div>
                          </td>
                          <td className="px-6 py-4 uppercase tracking-widest text-[9px]">
                             <span className={tx.type === 'DEPOSIT' ? 'text-blue-400' : 'text-yellow-500'}>
                                {tx.type} {tx.gateway ? `(${tx.gateway})` : ''}
                             </span>
                          </td>
                          <td className="px-6 py-4 text-white">
                             $ {Math.abs(tx.amount / 100).toFixed(2)} USD
                          </td>
                          <td className="px-6 py-4">
                             <span className={tx.amount > 0 ? 'text-green-400' : 'text-red-400'}>
                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()} <span className="opacity-40 tracking-widest text-[8px]">CR</span>
                             </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                             <span className="text-[9px] text-gray-600 font-mono uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-sm">
                                {tx.reference?.slice(0, 12) || tx.id.slice(0, 10).toUpperCase()}
                             </span>
                          </td>
                       </tr>
                    ))}
                    {platformTransactions.length === 0 && (
                       <tr>
                          <td colSpan={6} className="py-24 text-center">
                             <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest">No recent platform transactions found.</p>
                          </td>
                       </tr>
                    )}
                 </tbody>
              </table>
             </div>
           </div>

           {/* Load More Button */}
           <div className="flex justify-center">
              <button 
                onClick={() => setTransactionLimit(prev => prev + 50)}
                disabled={loadMoreLoading}
                className="group flex flex-col items-center gap-3 py-6"
              >
                 <div className="bg-white/5 group-hover:bg-red-500/20 border border-white/5 group-hover:border-red-500/40 p-3 rounded-full transition-all">
                    {loadMoreLoading ? <Loader2 className="w-4 h-4 text-red-400 animate-spin" /> : <History className="w-4 h-4 text-gray-500 group-hover:text-red-400" />}
                 </div>
                 <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-600 group-hover:text-white transition-colors">Load Next 50 Records</span>
              </button>
           </div>
        </div>
      )}

      {/* Audit Modal */}
      {isAuditOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setAuditOpen(false)} />
          <div className="relative bg-[#0a0a0a] border border-white/10 w-full max-w-4xl max-h-[85vh] flex flex-col rounded-sm overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 bg-black flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-red-500/10 rounded-sm">
                     <Target className="w-6 h-6 text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white italic uppercase tracking-tighter">Forensic Audit: <span className="text-red-400">{auditUsername}</span></h2>
                    <div className="flex items-center gap-3">
                       <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">UID: {auditUid}</p>
                       {auditJoinDate && (
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-400 font-bold uppercase tracking-widest pl-3 border-l border-white/10">
                             <Calendar className="w-3.5 h-3.5 text-red-400" />
                             Joined: {new Date(auditJoinDate).toLocaleDateString()}
                          </div>
                       )}
                    </div>
                  </div>
               </div>
               <button onClick={() => setAuditOpen(false)} className="p-2 hover:bg-white/5 rounded-sm transition-colors">
                  <XCircle className="w-6 h-6 text-gray-500" />
               </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
               {auditLoading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                     <Loader2 className="w-8 h-8 text-red-400 animate-spin" />
                     <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] animate-pulse">Scanning Combat Logs...</p>
                  </div>
               ) : auditData.length === 0 ? (
                  <div className="py-20 text-center">
                     <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest leading-relaxed"> No combat records found for this operative. <br/> Highly suspicious for a withdrawal request. </p>
                  </div>
               ) : (
                  <div className="space-y-3">
                     <div className="bg-red-500/5 border border-red-500/10 p-4 rounded-sm flex items-center gap-3 mb-6">
                        <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-[10px] text-red-400/80 font-bold uppercase tracking-widest leading-relaxed">
                           Review recent wins for consistency. Cross-reference the "Proof" link to ensure screenshot validity.
                        </p>
                     </div>

                     <table className="w-full text-left">
                        <thead className="text-[9px] text-gray-500 font-black uppercase tracking-widest border-b border-white/5">
                           <tr>
                              <th className="pb-4 font-black">Timestamp</th>
                              <th className="pb-4 font-black">Match</th>
                              <th className="pb-4 font-black">Stake</th>
                              <th className="pb-4 font-black">Result</th>
                              <th className="pb-4 font-black">Claim</th>
                              <th className="pb-4 font-black text-right">Evidence</th>
                           </tr>
                        </thead>
                        <tbody className="text-[11px] font-bold">
                           {auditData.map((m, i) => (
                              <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                                 <td className="py-4 text-gray-500 font-mono">
                                    {new Date(m.createdAt).toLocaleDateString()} <br/>
                                    <span className="text-[9px] opacity-50">{new Date(m.createdAt).toLocaleTimeString()}</span>
                                 </td>
                                  <td className="py-4">
                                    {m.type === 'MATCH' ? (
                                       <>
                                          <p className="text-white uppercase italic tracking-tighter font-black">{m.game}</p>
                                          <p className="text-[9px] text-gray-500 uppercase">{m.format}</p>
                                       </>
                                    ) : m.type === 'FINANCE_ADJUST' ? (
                                       <div className="flex items-center gap-2">
                                          <Wallet className="w-3.5 h-3.5 text-blue-400" />
                                          <div>
                                             <p className="text-blue-400 uppercase italic tracking-tighter font-black">BALANCE ADJUST</p>
                                             <p className="text-[8px] text-gray-600 uppercase font-bold">Manual Update</p>
                                          </div>
                                       </div>
                                    ) : (
                                       <div className="flex items-center gap-2">
                                          <Landmark className="w-3.5 h-3.5 text-orange-400" />
                                          <div>
                                             <p className="text-orange-400 uppercase italic tracking-tighter font-black">WITHDRAWAL</p>
                                             <p className="text-[8px] text-gray-600 uppercase font-bold">Bank Transfer</p>
                                          </div>
                                       </div>
                                    )}
                                 </td>
                                 <td className="py-4 text-white font-black">
                                    <span className={m.isWinner || m.fee > 0 ? "text-green-400" : "text-red-400"}>
                                       {m.fee > 0 ? '+' : ''}{m.fee} CR
                                    </span>
                                 </td>
                                 <td className="py-4">
                                    {m.type === 'MATCH' ? (
                                       m.isWinner ? (
                                          <div className="flex items-center gap-1.5 text-accent">
                                             <Trophy className="w-3 h-3" />
                                             <span className="uppercase tracking-tighter font-black italic text-[12px]">WIN (+{m.reward})</span>
                                          </div>
                                       ) : (
                                          <div className="flex items-center gap-1.5 text-gray-600">
                                             <Skull className="w-3 h-3" />
                                             <span className="uppercase tracking-tighter">LOSS</span>
                                          </div>
                                       )
                                    ) : (
                                       <div className={`flex items-center gap-1.5 ${m.status === 'APPROVED' || m.status === 'COMPLETED' ? 'text-green-400' : m.status === 'PENDING' ? 'text-yellow-400' : 'text-red-400'}`}>
                                          {m.status === 'APPROVED' || m.status === 'COMPLETED' ? <CheckCircle2 className="w-3 h-3" /> : m.status === 'PENDING' ? <Clock className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                                          <span className="uppercase tracking-tighter font-black text-[10px]">{m.status}</span>
                                       </div>
                                    )}
                                 </td>
                                 <td className="py-4 uppercase tracking-widest font-black text-[9px]">
                                    <span className={m.claim === 'WIN' ? 'text-accent' : m.claim === 'LOSS' ? 'text-red-500' : 'text-gray-500 font-normal italic'}>
                                       {m.claim}
                                    </span>
                                 </td>
                                 <td className="py-4 text-right">
                                    {m.proofUrl ? (
                                       <a 
                                          href={m.proofUrl} 
                                          target="_blank" 
                                          className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-400 text-[10px] font-black uppercase tracking-widest rounded-sm transition-all"
                                       >
                                          Proof <ExternalLink className="w-3 h-3" />
                                       </a>
                                    ) : (
                                       <span className="text-[9px] text-gray-700 italic uppercase">Log Entry</span>
                                    )}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </div>
               )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 bg-black flex justify-end">
               <button 
                  onClick={() => setAuditOpen(false)}
                  className="px-8 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-sm transition-all"
               >
                  Close Dossier
               </button>
            </div>

          </div>
        </div>
      )}

      {/* Approve Modal */}
      {ticketToApprove && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-green-500/30 w-full max-w-sm p-6 rounded-sm shadow-[0_0_50px_rgba(34,197,94,0.15)] flex flex-col pt-8">
             <div className="mx-auto w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4">
                <Landmark className="w-8 h-8 text-green-400" />
             </div>
             <h3 className="text-xl font-black italic uppercase text-center text-white mb-2 tracking-tighter">Execute Automated Payout?</h3>
             <p className="text-xs text-gray-400 text-center uppercase tracking-widest font-bold leading-relaxed mb-6">
                You are about to initiate an automatic transfer of <span className="text-white">$ {(ticketToApprove.amountCoins / 100).toFixed(2)} USD</span> to <span className="text-white block break-all max-w-full">{ticketToApprove.accountNumber}</span>.
             </p>
             <div className="flex gap-3">
                <button 
                  onClick={() => setTicketToApprove(null)} 
                  className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmApprove} 
                  className="flex-1 py-3 bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 text-green-400 rounded-sm text-xs font-black uppercase tracking-widest transition-all"
                >
                  Confirm Payout
                </button>
             </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {ticketToReject && (
        <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4">
          <div className="bg-surface border-2 border-red-500/30 w-full max-w-sm p-6 rounded-sm shadow-[0_0_50px_rgba(239,68,68,0.15)] flex flex-col pt-8">
             <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
                <ShieldAlert className="w-8 h-8 text-red-500" />
             </div>
             <h3 className="text-xl font-black italic uppercase text-center text-white mb-2 tracking-tighter">Reject Withdrawal</h3>
             <p className="text-xs text-gray-400 text-center uppercase tracking-widest font-bold mb-6 leading-relaxed">
                Provide a reason for blocking this withdrawal. The {ticketToReject.amountCoins.toLocaleString()} coins will be automatically refunded to {ticketToReject.username}'s wallet.
             </p>
             <input 
               type="text" 
               className="w-full bg-[#0a0a0a] border border-white/10 rounded-sm py-3 px-4 text-sm text-white font-bold outline-none focus:border-red-500 transition-colors mb-6"
               placeholder="E.g., Suspicious activity, Name mismatch..."
               value={rejectReason}
               onChange={(e) => setRejectReason(e.target.value)}
             />
             <div className="flex gap-3">
                <button 
                  onClick={() => setTicketToReject(null)} 
                  className="flex-1 py-3 text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmReject} 
                  disabled={!rejectReason.trim()}
                  className="flex-1 py-3 bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 text-red-500 rounded-sm text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Reject & Refund
                </button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
}
