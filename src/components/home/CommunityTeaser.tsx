import React from 'react';
import { MessageSquare, Users, Zap, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function CommunityTeaser() {
  const mockMessages = [
    { user: "Draken_99", text: "Who's ready for the eFootball tournament? 🔥", role: "Elite" },
    { user: "Sarah_Ops", text: "Just cashed out my win! CGame is the best.", role: "Moderator" },
    { user: "Ghost_Killer", text: "CODM 1v1 anyone? I'm in the general lobby.", role: "Pro" },
  ];

  return (
    <div className="py-24 bg-black overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          
          {/* Text Content: Benefits Focused */}
          <div className="flex-1 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-accent/10 border border-accent/20 rounded-full mb-6">
              <Users className="w-4 h-4 text-accent" />
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-accent">Active Operational Hub</span>
            </div>
            
            <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-6 leading-none">
              Don't Just Play, <br />
              <span className="text-accent">Belong.</span>
            </h2>
            
            <p className="text-lg text-gray-400 mb-8 max-w-xl leading-relaxed">
              CGameCore isn't just a platform—it's Africa's largest high-stakes social arena. 
              Find teammates, challenge rivals, and get real-time intelligence in our **War Room Chat**.
            </p>

            <ul className="space-y-4 mb-10">
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-accent" />
                </div>
                <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Real-time Matchmaking & Intel</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center">
                  <ShieldCheck className="w-3 h-3 text-accent" />
                </div>
                <span className="text-sm font-bold text-gray-300 uppercase tracking-widest">Verified Pro Community</span>
              </li>
            </ul>

            <Link href="/dashboard/community" className="inline-flex items-center gap-3 bg-white text-black px-8 py-4 rounded-sm text-sm font-black uppercase tracking-widest hover:bg-accent transition-all group">
              Join the War Room
              <MessageSquare className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </Link>
          </div>

          {/* Visual: Mock Chat Interface */}
          <div className="flex-1 w-full lg:max-w-md">
            <div className="relative">
              {/* Background Glow */}
              <div className="absolute inset-0 bg-accent/20 blur-[80px] rounded-full" />
              
              <div className="relative bg-[#0a0a0a] border border-white/10 rounded-sm p-4 shadow-2xl rotate-3 hover:rotate-0 transition-transform duration-500">
                <div className="flex items-center justify-between mb-6 border-b border-white/5 pb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-accent animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-white">General War Room</span>
                  </div>
                  <div className="flex gap-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white/10" />
                  </div>
                </div>

                <div className="space-y-4">
                  {mockMessages.map((msg, i) => (
                    <div key={i} className="animate-in slide-in-from-right fade-in duration-700" style={{ animationDelay: `${i * 200}ms` }}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-500">{msg.user}</span>
                        <span className="text-[7px] font-bold px-1.5 py-0.5 bg-white/5 rounded-sm text-accent uppercase tracking-tighter">{msg.role}</span>
                      </div>
                      <div className="bg-white/[0.03] border border-white/5 p-3 rounded-2xl rounded-tl-none text-xs text-gray-300 font-medium">
                        {msg.text}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-8 flex gap-2">
                  <div className="flex-1 h-8 bg-white/5 border border-white/10 rounded-full" />
                  <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
                    <Zap className="w-4 h-4 text-black" />
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
