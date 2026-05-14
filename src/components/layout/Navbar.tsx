"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import PWAInstallButton from './PWAInstallButton';
import { useAuth } from '@/components/auth/AuthProvider';
import { getTierFromWins } from '@/lib/tier-utils';
import { Trophy, Swords, Users, Menu, X, ArrowLeft, PlayCircle } from 'lucide-react';
import { subscribeToUserActiveMatch, Match } from '@/lib/match-service';

export default function Navbar() {
  const { user, profile, loading, isSyncing } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const [mounted, setMounted] = useState(false);
  const [currentHash, setCurrentHash] = useState('');

  useEffect(() => {
    setMounted(true);
    setCurrentHash(window.location.hash);

    const handleHashChange = () => {
      setCurrentHash(window.location.hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Subscribe to active match for Resume Match button
  useEffect(() => {
    if (!user) {
      setActiveMatch(null);
      return;
    }
    const unsub = subscribeToUserActiveMatch(user.uid, (match) => {
      setActiveMatch(match);
    });
    return () => unsub();
  }, [user]);

  const navLinks = [
    { name: 'Hall of Fame', href: '/#hof', icon: Trophy },
    { name: 'Dashboard', href: '/dashboard', icon: Swords },
    { name: 'Community', href: '/dashboard/community', icon: Users },
  ];

  const isActive = (href: string) => {
    if (!mounted) return false;

    // Handle Hall of Fame #hof hash specifically
    if (href === '/#hof') {
      return pathname === '/' && currentHash === '#hof';
    }

    // Exact matches always win
    if (pathname === href) return true;

    // Special case: Community is a sub-path of Dashboard, but should be exclusive
    if (href === '/dashboard' && pathname.startsWith('/dashboard/community')) {
      return false;
    }

    // Sub-path matching for other dashboard routes (Wallet, Matches, etc.)
    return pathname.startsWith(href + '/');
  };

  const showGoBack = mounted && pathname !== '/';

  return (
    <nav className="fixed top-0 w-full z-[100] border-b border-white/5 bg-black/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          
          {/* Left Section: Branding */}
          <div className="flex items-center gap-4">
            <Link href="/" className="text-2xl font-black tracking-tighter uppercase italic text-main shrink-0">
              CGame<span className="text-accent">Core</span>
            </Link>
          </div>
          
          {/* Center Section: Unified Tactical Menu */}
          <div className="flex items-center gap-1 sm:gap-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const active = isActive(link.href);
              
              return (
                <Link 
                  key={link.href}
                  href={link.href}
                  title={link.name}
                  className={`flex items-center gap-2 font-bold transition-all text-[9px] sm:text-[10px] uppercase tracking-[0.1em] sm:tracking-widest px-2.5 sm:px-4 py-2 rounded-sm border ${
                    active 
                      ? 'text-accent border-accent/20 bg-accent/5 shadow-[0_0_15px_rgba(0,255,102,0.1)]' 
                      : 'text-sub border-transparent hover:text-accent hover:border-accent/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="hidden min-[500px]:inline">{link.name}</span>
                </Link>
              );
            })}

            {/* Resume Match Button */}
            {activeMatch && (
              <Link 
                href={`/match/${activeMatch.id}`}
                title="Resume Active Match"
                className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-4 sm:py-2 bg-accent-aware/10 border border-accent/30 text-accent-aware text-[10px] font-black uppercase tracking-widest rounded-sm animate-pulse hover:bg-accent-aware/20 transition-all shadow-[0_0_20px_rgba(0,255,102,0.1)] ml-1"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline ml-2">Resume Match</span>
              </Link>
            )}
          </div>

          {/* Right Section: Actions & Profile */}
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>
            
            {loading || isSyncing ? (
              <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin"></div>
            ) : user ? (
              <Link
                href="/profile"
                className="flex items-center gap-3 group"
              >
                <div className="flex flex-col items-end text-right">
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-main truncate max-w-[100px] group-hover:text-accent transition-colors italic">
                    {profile?.username || user.displayName || "OPERATIVE"}
                  </span>
                  <div className="flex items-center gap-1.5 leading-none mt-0.5">
                    <span className="text-[8px] font-black uppercase tracking-widest text-accent">
                      {getTierFromWins(profile?.totalWins || 0).label.split(':')[0]}
                    </span>
                  </div>
                </div>
                
                <div className="w-10 h-10 rounded-[3px] bg-black border border-white/20 group-hover:border-accent flex items-center justify-center rotate-45 overflow-hidden shadow-lg transition-all">
                  <div className="w-[300%] h-[300%] -rotate-45"
                      style={{
                         backgroundImage: `url('/avatar_collection.png')`,
                         backgroundSize: '400% 500%',
                         backgroundPosition: `${(profile?.avatarId || 0) % 4 * 33.33}% ${Math.floor((profile?.avatarId || 0) / 4) * 25}%`
                      }}
                  />
                </div>
              </Link>
            ) : (
              <div className="flex items-center gap-3">
                <Link href="/login" className="text-sub text-[10px] font-black hover:text-accent transition-colors uppercase tracking-widest border border-white/5 px-3 py-2 rounded-sm hover:border-accent/10">Sign In</Link>
                <Link href="/register" className="bg-accent text-black px-4 py-2 rounded-sm text-[10px] font-black uppercase tracking-widest hover:bg-accent-hover transition-transform shadow-[0_0_15px_rgba(0,255,102,0.4)] hidden sm:block">
                  Enlist
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </nav>
  );
}
