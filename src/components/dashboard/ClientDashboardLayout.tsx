"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "./Sidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { subscribeToUserActiveMatch, Match } from "@/lib/match-service";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import SystemBanner from "./SystemBanner";

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const router = useRouter();

  // Register push notifications for this device
  usePushNotifications(user?.uid);

  // Route Protection: Redirect if not logged in (with a grace period for loading)
  useEffect(() => {
    // Only redirect if we've mounted and we're sure there's no user session
    if (loading) return;
    
    setHasMounted(true);
    if (!user) {
      console.warn("[DashboardLayout] No session detected. Redirecting to Entry Point...");
      router.push('/login');
    }
  }, [user, loading, router]);

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

  // Calculate avatar position from avatarId (0-19)
  const avatarX = (profile?.avatarId || 0) % 4;
  const avatarY = Math.floor((profile?.avatarId || 0) / 4);

  // Skeleton UI components
  const TextSkeleton = ({ width }: { width: string }) => (
    <div className={`h-4 bg-surface-hover animate-pulse rounded-sm ${width}`}></div>
  );
  
  const AvatarSkeleton = () => (
    <div className="w-10 h-10 bg-surface-hover animate-pulse rounded-[3px] rotate-45 border border-surface-border"></div>
  );

  return (
    <div className="flex min-h-screen bg-background w-full overflow-x-hidden">
      <Sidebar 
        collapsed={collapsed} 
        setCollapsed={setCollapsed} 
        mobileOpen={mobileOpen} 
        setMobileOpen={setMobileOpen} 
      />
      
      {/* Overlay for mobile sidebar */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/80 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${collapsed ? 'md:ml-20' : 'md:ml-64'} min-w-0 w-full`}>
        
        {/* Mobile Header Toggle */}
        <div className="md:hidden bg-surface border-b border-surface-border p-4 flex items-center justify-between z-20 relative w-full transition-colors">
            <div className="text-xl font-black uppercase italic flex items-center gap-2 text-main">
              <span className="w-2 h-2 rounded-full bg-accent-aware animate-pulse shadow-[0_0_10px_rgba(0,255,102,0.8)]"></span>
              CGame<span className="text-accent-aware">Core</span>
            </div>
            
            <div className="flex items-center gap-4">
              {activeMatch && (
                <div 
                  className="bg-accent-aware/10 border border-accent/20 px-3 py-1 rounded-full flex items-center gap-2 animate-pulse cursor-pointer hover:bg-accent-aware/20 transition-all" 
                  onClick={() => router.push(`/match/${activeMatch.id}`)}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-aware"></span>
                  <span className="text-[9px] font-black uppercase text-accent-aware tracking-widest">
                     {activeMatch.round && activeMatch.round !== 'NONE' ? activeMatch.round : "Live Match"}
                  </span>
                </div>
              )}
              
              <Link href="/profile" className="flex items-center">
                 {!hasMounted || (loading && !profile) ? (
                   <div className="w-8 h-8 bg-surface-hover animate-pulse rounded-[3px] rotate-45"></div>
                 ) : (
                   <div className="w-8 h-8 rounded-[3px] bg-black border border-accent flex items-center justify-center rotate-45 overflow-hidden hover:scale-105 transition-all">
                      <div 
                         className="w-[300%] h-[300%] -rotate-45"
                         style={{
                           backgroundImage: `url('/avatar_collection.png')`,
                           backgroundSize: '400% 500%',
                           backgroundPosition: `${avatarX * 33.33}% ${avatarY * 25}%`
                         }}
                      />
                   </div>
                 )}
              </Link>
              
              <button onClick={() => setMobileOpen(!mobileOpen)} className="text-main p-1 ml-1 border-l border-surface-border pl-3">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
        </div>

        {/* Desktop Top Bar (Utilities) */}
        <div className="hidden md:flex bg-background border-b border-surface-border py-4 px-6 items-center justify-between w-full relative z-20 transition-colors">
           <button onClick={() => router.back()} className="text-sub hover:text-main transition-colors flex items-center gap-2 text-sm font-bold uppercase tracking-widest p-2 -ml-2 rounded-sm hover:bg-surface-hover">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Go Back
           </button>

            <div className="flex items-center gap-6">
               {activeMatch && (
                 <Link href={`/match/${activeMatch.id}`} className="bg-accent-aware/10 border border-accent/20 px-4 py-2 rounded-sm flex items-center gap-3 group cursor-pointer hover:bg-accent-aware/20 hover:border-accent/40 transition-all">
                    <div className="relative">
                       <div className="absolute inset-0 bg-accent-aware blur-[8px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                       <span className="relative w-2 h-2 rounded-full bg-accent-aware block animate-pulse"></span>
                    </div>
                    <span className="text-[10px] font-black uppercase text-accent-aware tracking-[0.2em]">
                       Resume Match {activeMatch.round && activeMatch.round !== 'NONE' ? `· ${activeMatch.round}` : ''}
                    </span>
                 </Link>
               )}

              <Link href="/profile" className="flex items-center gap-3 cursor-pointer group">
                 <div className="flex flex-col items-end">
                    {!hasMounted || (loading && !profile) ? (
                      <div className="space-y-1.5 items-end flex flex-col">
                        <TextSkeleton width="w-24" />
                        <TextSkeleton width="w-12" />
                      </div>
                    ) : (
                      <>
                        <span className="text-sm font-black text-main italic uppercase tracking-tighter group-hover:text-accent-aware transition-colors">
                          {profile?.username || user?.displayName || "Player"}
                        </span>
                        <span className="text-[10px] text-accent-aware font-bold uppercase tracking-widest leading-none">Pro Tier</span>
                      </>
                    )}
                 </div>
                 
                 {!hasMounted || (loading && !profile) ? (
                   <AvatarSkeleton />
                 ) : (
                   <div className="w-10 h-10 rounded-[3px] bg-black border border-surface-border flex items-center justify-center rotate-45 overflow-hidden group-hover:border-accent transition-colors shadow-lg">
                      <div className="w-[300%] h-[300%] -rotate-45"
                          style={{
                             backgroundImage: `url('/avatar_collection.png')`,
                             backgroundSize: '400% 500%',
                             backgroundPosition: `${avatarX * 33.33}% ${avatarY * 25}%`
                          }}
                      />
                   </div>
                 )}
              </Link>
           </div>
        </div>

        <SystemBanner />

        <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-32 w-full max-w-full overflow-x-hidden min-w-0">
          {children}
        </main>
        
        {/* Real-time Global Elements */}
      </div>
    </div>
  );
}
