"use client";
import React, { useState, useEffect } from 'react';
import HofPublicFeed from "@/components/hall-of-fame/HofPublicFeed";
import BasecampView from "@/components/dashboard/BasecampView";
import { Trophy, Swords, Users, MessageSquare, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/components/auth/AuthProvider';
import Sidebar from "@/components/dashboard/Sidebar";
import CommunityChat from '@/components/community/CommunityChat';

export default function UnifiedTacticalRoot() {
  const [activeTab, setActiveTab] = useState<'HOF' | 'DASHBOARD' | 'COMMUNITY'>('HOF');
  const { user } = useAuth();
  
  // Sidebar state for Root Dashboard
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Sync state with URL hashes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '').toUpperCase();
      if (['HOF', 'DASHBOARD', 'COMMUNITY'].includes(hash)) {
        setActiveTab(hash as any);
      } else {
        setActiveTab('HOF');
        if (window.location.pathname === '/') {
          window.history.replaceState(null, '', '#hof');
        }
      }
    };

    handleHashChange(); // Initial check
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  return (
    <div className="flex flex-col w-full bg-black min-h-screen pt-24">
      {/* Redundant Sub-Nav removed - Now managed by Navbar.tsx */}

      {/* Main Content Area */}
      <main className="flex-1 relative">
        {activeTab === 'HOF' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
            <HofPublicFeed />
          </div>
        )}

        {activeTab === 'DASHBOARD' && (
          <div className="flex min-h-screen">
            {/* Sidebar restored to Dashboard view */}
            <Sidebar 
              collapsed={collapsed} 
              setCollapsed={setCollapsed} 
              mobileOpen={mobileOpen} 
              setMobileOpen={setMobileOpen} 
            />
            
            <div className={`flex-1 transition-all duration-300 ${collapsed ? 'md:ml-20' : 'md:ml-64'} px-4 md:px-8 py-10 animate-in fade-in slide-in-from-bottom-4`}>
              <BasecampView />
            </div>
          </div>
        )}

        {activeTab === 'COMMUNITY' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-5xl mx-auto px-4 py-10 space-y-6">
            <div className="shrink-0 text-center md:text-left mb-8">
              <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter text-white">
                Community <span className="text-accent">War Room</span>
              </h1>
              <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">
                Tactical Communication & Global Intel Feed
              </p>
            </div>
            <div className="h-[750px] md:h-[850px] w-full">
               <CommunityChat />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
