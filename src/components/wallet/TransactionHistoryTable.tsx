"use client";
import React, { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { getWalletTransactionsAction } from "@/app/actions/wallet-actions";
import { Loader2, ArrowUpRight, ArrowDownLeft, Landmark } from "lucide-react";

interface Transaction {
  id: string;
  displayId: string;
  date: string;
  time: string;
  type: string;
  match: string;
  amount: string;
  status: string;
}

export default function TransactionHistoryTable() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    const fetch = async () => {
      if (!user) return;
      const idToken = await user.getIdToken();
      const result = await getWalletTransactionsAction(idToken);
      if (result.success) {
        setTransactions(result.transactions || []);
      }
      setLoading(false);
    };
    fetch();
  }, [user]);

  if (loading) {
    return (
      <div className="mt-10 bg-surface border border-surface-border rounded-[5px] p-12 flex justify-center items-center">
         <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="mt-10">
      <div className="flex justify-between items-end mb-6">
        <div>
           <h3 className="text-xl font-black italic uppercase tracking-tight text-main">Transaction Ledger</h3>
           <p className="text-xs text-sub font-bold tracking-widest uppercase mt-1">Real-time Accounting</p>
        </div>
      </div>
      
      <div className="bg-surface border border-surface-border rounded-[5px] overflow-hidden shadow-2xl transition-colors">
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-surface-hover border-b border-surface-border text-[10px] uppercase tracking-widest text-sub">
                <th className="p-5 font-bold">Ref ID</th>
                <th className="p-5 font-bold">Timestamp</th>
                <th className="p-5 font-bold">Category</th>
                <th className="p-5 font-bold hidden sm:table-cell">Operation</th>
                <th className="p-5 font-bold">Status</th>
                <th className="p-5 font-bold text-right">Credit / Debit</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {transactions.length === 0 ? (
                <tr>
                   <td colSpan={6} className="p-10 text-center text-sub text-[10px] uppercase font-bold tracking-widest italic opacity-40">
                      No tactical ledger entries found yet.
                   </td>
                </tr>
              ) : (
                transactions.map((tx, idx) => (
                  <tr key={`${tx.id}-${idx}`} className="border-b border-surface-border/50 hover:bg-surface-hover/50 transition-colors group">
                    <td className="p-5 font-mono text-sub text-xs">#{tx.displayId}</td>
                    <td className="p-5">
                      <div className="font-bold text-main">{tx.date}</div>
                      <div className="text-xs text-sub">{tx.time}</div>
                    </td>
                    <td className="p-5">
                      <div className={`text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                        tx.amount.startsWith('+') ? 'text-accent' : 
                        tx.type === 'Withdrawal' ? 'text-red-400' :
                        'text-sub'
                      }`}>
                        {tx.amount.startsWith('+') ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                        {tx.type}
                      </div>
                    </td>
                    <td className="p-5 text-sub text-xs uppercase hidden sm:table-cell font-black tracking-tight">{tx.match}</td>
                    <td className="p-5">
                      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest">
                        {tx.status === 'Pending' ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span> <span className="text-yellow-500">Processing</span></>
                        ) : tx.status === 'Rejected' ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> <span className="text-red-500 line-through">Rejected</span></>
                        ) : tx.status === 'Abandoned' ? (
                            <><span className="w-1.5 h-1.5 rounded-full bg-white/20"></span> <span className="text-sub/50">Abandoned</span></>
                        ) : (
                            <><span className="w-1.5 h-1.5 rounded-full bg-accent/30"></span> <span className="text-sub">Cleared</span></>
                        )}
                      </div>
                    </td>
                    <td className={`p-5 text-right font-mono font-black text-lg ${tx.amount.startsWith('+') ? 'text-accent' : 'text-main'}`}>
                      {tx.amount} <span className="text-[10px] opacity-30 italic">CR</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
