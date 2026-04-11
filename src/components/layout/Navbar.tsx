import Link from 'next/link';
import PWAInstallButton from './PWAInstallButton';

export default function Navbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-surface-border bg-background/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="text-2xl font-black tracking-tighter uppercase italic text-main">
              CGame<span className="text-accent">Core</span>
            </Link>
          </div>
          <div className="hidden md:flex space-x-8">
            <Link href="/#how-it-works" className="text-sub hover:text-accent font-medium transition-colors text-sm uppercase tracking-wide">How it Works</Link>
            <Link href="/rules" className="text-sub hover:text-accent font-medium transition-colors text-sm uppercase tracking-wide">Games & Rules</Link>
            <Link href="/faq" className="text-sub hover:text-accent font-medium transition-colors text-sm uppercase tracking-wide">FAQ</Link>
          </div>
          <div className="flex items-center space-x-2 sm:space-x-4">
            <PWAInstallButton />
            <Link href="/login" className="text-sub text-sm font-bold hover:text-main transition-colors uppercase tracking-wide">Login</Link>
            <Link href="/register" className="bg-accent text-black px-6 py-2 rounded-sm text-sm font-black uppercase tracking-wider hover:bg-accent-hover transition-transform hover:-translate-y-0.5 shadow-[0_0_15px_rgba(0,255,102,0.4)]">
              Play Now
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
