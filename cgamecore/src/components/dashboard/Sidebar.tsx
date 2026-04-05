"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: any) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/');
    } catch (err) {
      console.error("Sign out failed:", err);
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') return true;
    if (path !== '/dashboard' && pathname?.startsWith(path)) return true;
    return false;
  };

  const activeLinkClass = `flex items-center text-accent bg-accent/10 border border-accent/20 rounded-sm font-bold tracking-wide transition-all shadow-[inset_2px_0_0_0_#00FF66] ${collapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-3'}`;
  const inactiveLinkClass = `flex items-center text-sub hover:text-main hover:bg-surface-hover rounded-sm font-bold tracking-wide transition-all ${collapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-3'}`;

  return (
    <aside className={`fixed inset-y-0 left-0 bg-surface border-r border-surface-border z-40 transition-all duration-300 ease-in-out ${collapsed ? 'w-20' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="h-full flex flex-col pt-8">
        
        <div className={`px-6 mb-10 flex items-center justify-center`}>
          <button 
            type="button"
            onClick={() => {
              setCollapsed(!collapsed);
              if (mobileOpen) setMobileOpen(false);
            }} 
            className="text-2xl font-black tracking-tighter uppercase italic text-main flex items-center justify-center space-x-2 w-full hover:opacity-80 transition-opacity outline-none"
          >
            <span className="w-3 h-3 rounded-full bg-accent animate-pulse shadow-[0_0_10px_rgba(0,255,102,0.8)] shrink-0"></span>
            {!collapsed && <span>CGame<span className="text-accent">Core</span></span>}
          </button>
        </div>
        
        <nav className="flex-1 px-4 space-y-2">
           <Link href="/dashboard" className={isActive('/dashboard') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
             </svg>
             {!collapsed && <span>Dashboard</span>}
           </Link>
           <Link href="/dashboard/tournaments" className={isActive('/dashboard/tournaments') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/tournaments') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
             </svg>
             {!collapsed && <span>Tournaments</span>}
           </Link>
           <Link href="/dashboard/matches" className={isActive('/dashboard/matches') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/matches') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
             </svg>
             {!collapsed && <span>My Matches</span>}
           </Link>
           <Link href="/dashboard/wallet" className={isActive('/dashboard/wallet') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/wallet') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
             </svg>
             {!collapsed && <span>Wallet</span>}
           </Link>
           <Link href="/dashboard/leaderboards" className={isActive('/dashboard/leaderboards') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/leaderboards') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
             </svg>
             {!collapsed && <span>Leaderboards</span>}
           </Link>
        </nav>
        
        <div className="p-4 mt-auto mb-4 border-t border-surface-border">
           <button 
             onClick={handleLogout}
             className={`flex items-center text-sub hover:text-[#EA4335] w-full rounded-sm font-bold tracking-wide transition-all mt-4 ${collapsed ? 'justify-center p-3' : 'space-x-3 px-4 py-3'}`}
           >
             <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
             </svg>
             {!collapsed && <span>Sign Out</span>}
           </button>
        </div>
      </div>
    </aside>
  );
}
