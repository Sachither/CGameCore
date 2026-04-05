"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, Trophy, ChevronLeft, Search, Filter } from 'lucide-react';

interface LeagueListing {
  id: string;
  game: string;
  title: string;
  challengeFee: number;
  totalPool: number;
  playerCount: number;
  quota: number;
  status: 'FILLING' | 'ACTIVE' | 'COMPLETED';
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<LeagueListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "leagues"),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ 
        id: d.id, 
        ...d.data() 
      } as LeagueListing));
      setLeagues(docs);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <Link 
        href="/dashboard" 
        className="flex items-center gap-2 text-sub hover:text-accent transition-colors text-[10px] font-black uppercase tracking-widest group"
      >
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Return to Basecamp
      </Link>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-surface-border">
        <div>
          <h1 className="text-4xl font-black text-main italic tracking-tighter uppercase mb-2">Competitive <span className="text-accent">Circuits</span></h1>
          <p className="text-xs text-sub uppercase tracking-widest font-bold">Join professional leagues and claim your share of the massive prize pools.</p>
        </div>
        <div className="bg-surface border border-surface-border p-1 rounded-sm flex">
           <button className="px-6 py-2 bg-accent text-black text-[10px] font-black uppercase tracking-widest rounded-sm">All Arenas</button>
           <button className="px-6 py-2 text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">Tournaments</button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           {[1,2,3,4,5,6].map(i => (
             <div key={i} className="h-64 bg-surface animate-pulse rounded-sm border border-surface-border" />
           ))}
        </div>
      ) : leagues.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {leagues.map((t) => {
            const progress = Math.min(((t.playerCount || 0) / (t.quota || 16)) * 100, 100);
            return (
              <div key={t.id} className="group relative bg-surface border border-surface-border hover:border-accent/40 rounded-sm transition-all overflow-hidden flex flex-col shadow-2xl">
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-20 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="p-6 flex-1">
                  <div className="flex justify-between items-start mb-6">
                    <span className="text-[8px] font-black uppercase tracking-widest px-2 py-1 bg-black border border-surface-border text-gray-400 rounded-sm">
                      {t.game}
                    </span>
                    <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-1 rounded-sm ${t.status === 'FILLING' ? 'bg-accent/10 text-accent animate-pulse' : 'bg-blue-500/10 text-blue-400'}`}>
                      {t.status}
                    </span>
                  </div>

                  <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter mb-1 group-hover:text-accent transition-colors leading-none">
                    {t.title || `${t.game} Elite League`}
                  </h3>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-8">Professional Grade Engagement</p>

                  <div className="space-y-6">
                    <div className="flex justify-between items-end border-b border-surface-border/50 pb-4">
                      <div className="text-[9px] text-sub font-black uppercase tracking-widest">Prize Pool Grant</div>
                      <div className="text-2xl font-black text-accent italic tracking-tight">{Math.floor((t.totalPool || 0) * 0.8).toLocaleString()} CR</div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-widest">
                        <span className="text-gray-500">Deployment Status</span>
                        <span className="text-white">{t.playerCount || 0} / {t.quota || 16} PLYRs</span>
                      </div>
                      <div className="h-1 bg-black rounded-full overflow-hidden border border-surface-border">
                        <div 
                          className="h-full bg-accent shadow-[0_0_10px_rgba(0,255,102,0.5)] transition-all duration-1000" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 pt-0">
                  <button 
                    disabled={t.status !== "FILLING"}
                    className="w-full py-4 bg-white hover:bg-accent text-black font-black uppercase tracking-widest text-[10px] rounded-sm transition-all disabled:opacity-20 disabled:cursor-not-allowed active:scale-95 shadow-lg group-hover:shadow-accent/10"
                  >
                    {t.status === "ACTIVE" ? "Battle In Progress" : `Enter Qualifiers (${t.challengeFee} CR)`}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-surface border border-surface-border p-20 rounded-sm text-center">
           <Trophy className="w-12 h-12 text-gray-800 mx-auto mb-4 opacity-20" />
           <h3 className="text-lg font-black text-main italic uppercase mb-2">No Active Circuits</h3>
           <p className="text-xs text-sub uppercase font-bold tracking-widest">Professional leagues will appear here once recruitment begins.</p>
        </div>
      )}
    </div>
  );
}
