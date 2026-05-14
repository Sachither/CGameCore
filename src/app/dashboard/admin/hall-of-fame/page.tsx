"use client";

import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { HofEntry, getHofWeekKey } from '@/lib/hof-service';
import { adminCrownWinnerAction } from '@/app/actions/hof-actions';
import { useAuth } from '@/components/auth/AuthProvider';
import { useToast } from '@/context/ToastContext';
import { Trophy, Shield, Trash2, CheckCircle, Loader2 } from 'lucide-react';

export default function AdminHofPage() {
  const { idToken } = useAuth();
  const toast = useToast();
  const [entries, setEntries] = useState<HofEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const weekKey = getHofWeekKey();

  useEffect(() => {
    const q = query(
      collection(db, "hall_of_fame_entries"),
      where("weekKey", "==", weekKey),
      orderBy("voteCount", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as HofEntry)));
      setLoading(false);
    });

    return () => unsub();
  }, [weekKey]);

  const handleCrownWinners = async () => {
    if (!idToken) return;
    if (!confirm("Are you sure? This will set winners for each category and DELETE all other entries for this week.")) return;

    setProcessing(true);
    try {
      const res = await adminCrownWinnerAction(idToken, weekKey);
      if (res.success) {
        toast.success("SUCCESSION COMPLETE", "Winners crowned and archives purged.");
      } else {
        toast.error("MISSION FAILED", res.error);
      }
    } catch (err) {
      toast.error("SYSTEM ERROR", "Admin protocol failure.");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
         <div>
            <div className="flex items-center gap-2 text-accent mb-2">
               <Shield className="w-4 h-4" />
               <span className="text-[10px] font-black uppercase tracking-widest">Admin Command Center</span>
            </div>
            <h1 className="text-4xl font-black text-main italic uppercase tracking-tighter">Hall of Fame <span className="text-accent">Audit</span></h1>
            <p className="text-sub text-xs uppercase tracking-widest font-bold">Week: {weekKey}</p>
         </div>

         <button 
           onClick={handleCrownWinners}
           disabled={processing || entries.length === 0}
           className="px-8 py-4 bg-accent hover:bg-accent-hover text-black font-black uppercase tracking-widest text-xs italic transition-all flex items-center gap-2 shadow-lg disabled:opacity-50"
         >
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            CROWN WINNERS & PURGE WEEK
         </button>
      </div>

      <div className="bg-surface border border-surface-border rounded-sm overflow-hidden">
         <table className="w-full text-left border-collapse">
            <thead>
               <tr className="bg-surface-hover border-b border-surface-border text-[10px] uppercase tracking-widest text-sub">
                  <th className="p-6 font-bold">Player</th>
                  <th className="p-6 font-bold">Category</th>
                  <th className="p-6 font-bold">Votes</th>
                  <th className="p-6 font-bold">Status</th>
                  <th className="p-6 font-bold">Link</th>
               </tr>
            </thead>
            <tbody className="text-sm">
               {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-surface-border/50 hover:bg-white/5 transition-colors">
                     <td className="p-6 flex items-center gap-3">
                        <div 
                          className="w-8 h-8 rounded-full border border-surface-border bg-black"
                          style={{
                            backgroundImage: `url('/avatar_collection.png')`,
                            backgroundSize: '400% 500%',
                            backgroundPosition: `${((entry.avatarId || 0) % 4) * 33.33}% ${Math.floor((entry.avatarId || 0) / 4) * 25}%`
                          }}
                        />
                        <span className="font-bold text-main">{entry.username}</span>
                     </td>
                     <td className="p-6 text-sub font-mono text-xs">{entry.category}</td>
                     <td className="p-6 font-black text-accent">{entry.voteCount}</td>
                     <td className="p-6">
                        {entry.status === 'WINNER' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/20 text-accent text-[9px] font-black uppercase rounded-sm border border-accent/20">
                             <CheckCircle className="w-3 h-3" /> WINNER
                          </span>
                        ) : (
                          <span className="text-gray-600 text-[10px] font-bold uppercase">Candidate</span>
                        )}
                     </td>
                     <td className="p-6">
                        <a href={entry.videoUrl} target="_blank" rel="noopener noreferrer" className="text-sub hover:text-accent transition-colors">
                           <Trash2 className="w-4 h-4" />
                        </a>
                     </td>
                  </tr>
               ))}
               {entries.length === 0 && (
                 <tr>
                    <td colSpan={5} className="p-20 text-center text-gray-700 text-xs font-bold uppercase tracking-widest italic">
                       No combat records found for this period.
                    </td>
                 </tr>
               )}
            </tbody>
         </table>
      </div>
    </div>
  );
}
