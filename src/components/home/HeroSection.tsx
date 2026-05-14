import Link from 'next/link';
import HofHeroCarousel from './HofHeroCarousel';

export default function HeroSection() {
  return (
    <div className="relative overflow-hidden pt-40 pb-20 lg:pt-56 lg:pb-32">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center space-x-2 bg-surface border border-accent/30 rounded-full px-4 py-1.5 mb-8">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
              <span className="text-xs font-bold text-accent uppercase tracking-wider">Skill-Based Escrow Matchmaking</span>
            </div>
            
            <h1 className="text-6xl md:text-8xl lg:text-9xl font-black tracking-tighter mb-6 uppercase italic leading-[0.85]">
              Skill Into <br />
              <span className="text-accent">Profit.</span>
            </h1>
            
            <p className="mt-4 text-lg md:text-xl text-gray-400 max-w-2xl lg:mx-0 mx-auto mb-10 leading-relaxed font-medium">
              Africa's premier destination where gaming excellence translates to <span className="text-white font-bold">real-world earnings</span>. 
              Enlist in the world's most secured <span className="text-white font-bold">COD Mobile</span> and <span className="text-white font-bold">eFootball</span> arena.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
              <Link href="/register" className="w-full sm:w-auto bg-accent text-black px-12 py-5 rounded-sm text-lg font-black uppercase tracking-wider hover:bg-accent-hover transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,255,102,0.4)]">
                Start Earning Now
              </Link>
              <Link href="#how-it-works" className="w-full sm:w-auto bg-surface border border-surface-border text-white px-10 py-5 rounded-sm text-lg font-bold uppercase tracking-wider hover:bg-surface-hover transition-colors">
                View Rulebook
              </Link>
            </div>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-4">
             <HofHeroCarousel />
             <div className="flex flex-col items-center">
                <span className="text-[10px] font-black text-accent uppercase tracking-[0.3em]">Live Feed</span>
                <span className="text-[8px] text-sub uppercase font-bold tracking-widest mt-1 italic">Weekly Combat Champions</span>
             </div>
          </div>
        </div>
        
        <div className="mt-16 grid grid-cols-2 gap-4 md:grid-cols-4 border-t border-surface-border pt-10">
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-white">5-Min</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest mt-1">Match Payouts</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-white">100%</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest mt-1">Secured Escrow</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-white">Zero</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest mt-1">Pay-to-Win</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-3xl font-black text-accent mt-1">$1.00 USD</span>
            <span className="text-xs text-gray-400 uppercase tracking-widest mt-2">= 100 Coins</span>
          </div>
        </div>
      </div>
    </div>
  );
}
