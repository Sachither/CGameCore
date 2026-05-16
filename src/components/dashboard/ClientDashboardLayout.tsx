"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "./Sidebar";
import { useAuth } from "@/components/auth/AuthProvider";
import { subscribeToUserActiveMatch, Match } from "@/lib/match-service";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import SystemBanner from "./SystemBanner";
import CommunityIntelOverlay from "../notifications/CommunityIntelOverlay";
import QuickPingOverlay from "../notifications/QuickPingOverlay";
import { Menu } from "lucide-react";

export default function ClientDashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeMatch, setActiveMatch] = useState<Match | null>(null);
  const router = useRouter();

  // Register push notifications for this device
  usePushNotifications(user?.uid);

  // Route Protection: Graceful Mounting
  useEffect(() => {
    if (!loading) {
      setHasMounted(true);
    }
  }, [loading]);

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

      {/* Floating Mobile Sidebar Toggle */}
      {!mobileOpen && (
        <button 
          onClick={() => setMobileOpen(true)}
          className="md:hidden fixed bottom-24 left-6 z-[100] w-12 h-12 rounded-full bg-accent text-black flex items-center justify-center shadow-[0_0_20px_rgba(0,255,102,0.4)] border border-accent/20 hover:scale-105 active:scale-95 transition-all"
          aria-label="Open Mobile Menu"
        >
          <Menu className="w-6 h-6" />
        </button>
      )}

      {/* Main Content Area */}
      <div 
        className={`flex-1 flex flex-col transition-all duration-300 pt-16 ${collapsed ? 'md:ml-20' : 'md:ml-64'} min-w-0 w-full`}
        style={{ '--sidebar-width': collapsed ? '80px' : '256px' } as React.CSSProperties}
      >
        
        <SystemBanner />
 
         <main className="flex-1 p-4 sm:p-6 lg:p-10 pb-32 pt-4 w-full max-w-full overflow-x-hidden min-w-0">

          {children}
        </main>
        
        {/* Real-time Global Elements */}
        <CommunityIntelOverlay />
        <QuickPingOverlay />
      </div>
    </div>
  );
}
