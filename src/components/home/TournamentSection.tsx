import Link from 'next/link';
import { Trophy, Target, ShieldCheck, Zap, Info } from 'lucide-react';

export default function TournamentSection() {
  const tournaments = [
    {
      game: "COD Mobile",
      prize: "$300.00",
      status: "Active Now",
      icon: <Target className="w-8 h-8 text-accent" />,
      tagline: "Pro Series Championship"
    },
    {
      game: "eFootball",
      prize: "$400.00",
      status: "Active Now",
      icon: <Zap className="w-8 h-8 text-blue-400" />,
      tagline: "Elite Cup Season 1"
    }
  ];

  return (
    <section className="relative py-24 overflow-hidden bg-black border-y border-surface-border">
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-accent/5 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-blue-500/5 blur-[100px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/4" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center text-center mb-16">
          <div className="inline-flex items-center gap-2 bg-accent/10 border border-accent/30 rounded-full px-4 py-1 mb-6">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
            </span>
            <span className="text-[10px] font-black text-accent uppercase tracking-widest">Active Deployment</span>
          </div>

          <h2 className="text-4xl md:text-6xl font-black uppercase italic tracking-tighter text-white mb-6">
            CASH <span className="text-accent">PRIZE</span> POOLS
          </h2>
          <p className="text-gray-400 max-w-2xl text-lg font-medium leading-relaxed">
            The arena is open. Operatives are currently competing for the highest stakes on the continent.
            Secure your slot and secure the bag.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16 px-4 md:px-0">
          {tournaments.map((t, i) => (
            <div key={i} className="group relative bg-surface border border-surface-border p-10 hover:border-accent/40 transition-all duration-300 rounded-sm">
              <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <Trophy className="w-24 h-24 text-white" />
              </div>

              <div className="flex items-center gap-4 mb-6">
                <div className="p-3 bg-black/50 border border-surface-border rounded-sm group-hover:border-accent/20 transition-colors">
                  {t.icon}
                </div>
                <div>
                  <div className="text-xs font-black text-accent uppercase tracking-widest leading-none mb-1">{t.status}</div>
                  <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{t.tagline}</div>
                </div>
              </div>

              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter mb-2">{t.game}</h3>
              <div className="text-5xl font-black text-white tracking-widest mb-6">
                {t.prize}
              </div>

              <div className="flex items-center gap-3 py-4 border-t border-surface-border">
                <ShieldCheck className="w-4 h-4 text-accent" />
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Verified Payout via Flutterwave/Nowpayments</span>
              </div>
            </div>
          ))}
        </div>

        {/* Commitment Fee Explanation */}
        <div className="max-w-4xl mx-auto mb-16">
          <div className="bg-surface/50 border border-surface-border p-8 rounded-sm relative overflow-hidden">
            <div className="absolute top-1/2 left-0 -translate-y-1/2 w-1 h-12 bg-accent" />
            <div className="flex flex-col md:flex-row items-center gap-8">
              <div className="flex-shrink-0 w-16 h-16 bg-accent/5 border border-accent/20 rounded-full flex items-center justify-center">
                <Info className="w-8 h-8 text-accent" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-black text-white uppercase tracking-wider mb-2">The $1.00 Commitment Policy</h4>
                <p className="text-sm text-gray-400 leading-relaxed font-bold">
                  Registration is 100% Free. However, a <span className="text-white font-black">$1.00 (100 Coins)</span> commitment fee is required only when joining a tournament.
                  We <span className="text-accent underline">do not</span> take your money upon registration; the fee simply ensures every participant is professional, prevents ghost-players from clogging the brackets,
                  and allows us to verify your identity for instant cash withdrawals.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center">
          <Link href="/register" className="group relative inline-flex items-center justify-center transition-all active:scale-95">
            <div className="absolute -inset-1 bg-accent/40 blur-lg rounded-full opacity-70 group-hover:opacity-100 transition-opacity animate-pulse" />
            <div className="relative bg-accent text-black px-12 py-5 rounded-sm text-xl font-black uppercase tracking-tighter flex items-center gap-3">
              <span>Join the deployment</span>
              < Zap className="w-5 h-5 fill-black" />
            </div>
          </Link>
          <p className="mt-6 text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em]">No ghost players. no drama. just high-stakes combat.</p>
        </div>
      </div>
    </section>
  );
}
