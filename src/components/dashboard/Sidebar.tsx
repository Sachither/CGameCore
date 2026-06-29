"use client";
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useState, useEffect } from 'react';

export default function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }: any) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  // --- NOTIFICATION INTEL LISTENER ---
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      where("isRead", "==", false)
    );
    const unsub = onSnapshot(q, (snap) => {
      setUnreadCount(snap.size);
    }, (err) => {
      console.error("[SidebarIntel] Notification count error:", err);
    });
    return () => unsub();
  }, [user]);

  const isModerator = profile?.isAdmin || profile?.role === 'MODERATOR' || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';

  // 🔒 [CONTRACT CHECK] Verify if Partner Contract is still active
  const partnerExpiryDate = profile?.partnerExpiresAt?.seconds 
    ? new Date(profile.partnerExpiresAt.seconds * 1000) 
    : (profile?.partnerExpiresAt ? new Date(profile.partnerExpiresAt) : null);
  const isPartnerActive = profile?.role === 'PARTNER' && partnerExpiryDate && partnerExpiryDate > new Date();

  const handleLogout = async () => {
    try {
      // Clear all session/storage data first (iOS-specific fix)
      if (typeof window !== 'undefined') {
        localStorage.clear();
        sessionStorage.clear();
        // Clear all cookies by setting expiration to past
        document.cookie.split(";").forEach((c) => {
          document.cookie = c.replace(/^ +/, "").replace(/=.*/, `=;expires=${new Date().toUTCString()};path=/`);
        });
      }
      
      // Sign out from Firebase
      await signOut(auth);
      
      // Wait briefly for auth state to update before redirect
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Force hard redirect (works better on iOS Safari)
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
    } catch (err) {
      console.error("Sign out failed:", err);
      // Force redirect even if error occurs
      if (typeof window !== 'undefined') {
        window.location.href = '/';
      }
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
    <aside className={`fixed inset-y-0 left-0 bg-surface border-r border-surface-border z-40 transition-all duration-300 ease-in-out pt-16 ${collapsed ? 'w-20' : 'w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
      <div className="h-full min-h-0 flex flex-col pt-4">
        
        <div className={`px-6 mt-10 mb-8 flex items-center justify-center`}>
          <button 
            type="button"
            onClick={() => {
              setCollapsed(!collapsed);
              if (mobileOpen) setMobileOpen(false);
            }} 
            title={collapsed ? 'Expand Tactical Sidebar' : 'Minimize Tactical Sidebar'}
            aria-label={collapsed ? 'Expand Tactical Sidebar' : 'Minimize Tactical Sidebar'}
            className="flex items-center justify-center p-2 rounded-sm bg-white/5 border border-white/5 hover:border-accent/20 hover:text-accent transition-all outline-none group shadow-lg"
          >
            {collapsed ? (
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              </svg>
            ) : (
              <svg className="w-4 h-4 transition-transform group-hover:scale-110" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
              </svg>
            )}
          </button>
        </div>
        
        <nav className="flex-1 min-h-0 overflow-y-auto px-4 space-y-2 pb-4 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <Link href="/dashboard" className={isActive('/dashboard') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
              <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              {!collapsed && <span>Dashboard</span>}
            </Link>
            <Link href="/dashboard/hall-of-fame" className={isActive('/dashboard/hall-of-fame') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
              <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/hall-of-fame') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" />
              </svg>
              {!collapsed && <span>Hall of Fame</span>}
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
           {isPartnerActive && (
             <Link href="/dashboard/partner" className={isActive('/dashboard/partner') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
               <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/partner') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
               </svg>
               {!collapsed && <span>Partner Portal</span>}
             </Link>
           )}
           <Link href="/dashboard/support" className={isActive('/dashboard/support') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
             <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/support') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z" />
             </svg>
             {!collapsed && <span>Support</span>}
           </Link>
           {isModerator && (
             <Link href="/dashboard/moderator-hub" className={isActive('/dashboard/moderator-hub') ? activeLinkClass : inactiveLinkClass} onClick={() => setMobileOpen(false)}>
               <svg className={`w-5 h-5 shrink-0 ${isActive('/dashboard/moderator-hub') ? 'text-accent' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
               </svg>
               {!collapsed && <span>Moderator Hub</span>}
             </Link>
           )}
        </nav>
        
        {user && (
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
        )}
      </div>
    </aside>
  );
}
