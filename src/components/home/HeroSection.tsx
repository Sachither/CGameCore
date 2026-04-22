import Link from 'next/link';

export default function HeroSection() {
  return (
    <div className="relative overflow-hidden pt-40 pb-20 lg:pt-56 lg:pb-32">
      {/* Background glow effects */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/20 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <div className="inline-flex items-center space-x-2 bg-surface border border-accent/30 rounded-full px-4 py-1.5 mb-8">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <span className="text-xs font-bold text-accent uppercase tracking-wider">Skill-Based Escrow Matchmaking</span>
        </div>
        
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase italic">
          Stop Playing <br className="hidden md:block" />
          <span className="text-accent">For Free.</span>
        </h1>
        
        <p className="mt-4 text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10">
          Join Africa's highest-stakes competitive ladder. Back your skills with real money in 
          <span className="text-white font-bold"> COD Mobile</span> and 
          <span className="text-white font-bold"> eFootball</span>. Our automated AI Escrow system ensures you get paid for every win.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="w-full sm:w-auto bg-accent text-black px-8 py-4 rounded-sm text-lg font-black uppercase tracking-wider hover:bg-accent-hover transition-all hover:scale-105 shadow-[0_0_20px_rgba(0,255,102,0.4)]">
            Start Earning Now
          </Link>
          <Link href="#how-it-works" className="w-full sm:w-auto bg-surface border border-surface-border text-white px-8 py-4 rounded-sm text-lg font-bold uppercase tracking-wider hover:bg-surface-hover transition-colors">
            View Rulebook
          </Link>
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
