"use client";
import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AdminGuard from "@/components/auth/AdminGuard";
import { useAuth } from "@/components/auth/AuthProvider";
import {
  LayoutDashboard,
  Flame,
  Gavel,
  Users,
  Shield,
  LogOut,
  AlertTriangle,
  Landmark,
  Swords,
  MessageSquare,
  Trophy,
  Menu,
  X,
  Command,
} from "lucide-react";

const navItems = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/promo", label: "Promo Ops", icon: Flame },
  { href: "/admin/disputes", label: "Tribunal", icon: Gavel },
  { href: "/admin/matches", label: "Matches", icon: Swords },
  { href: "/admin/treasury", label: "Treasury", icon: Landmark },
  { href: "/admin/users", label: "Operators", icon: Users },
  { href: "/admin/messages", label: "Comms Link", icon: MessageSquare },
  { href: "/admin/tickets", label: "Support Tickets", icon: AlertTriangle },
  { href: "/admin/hall-of-fame", label: "Hall of Fame", icon: Trophy },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { profile } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [floatingMenuOpen, setFloatingMenuOpen] = useState(false);

  return (
    <AdminGuard>
      <div className="min-h-screen bg-black flex flex-col md:flex-row">
        {/* Mobile Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a] border-b border-white/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-red-500/20 border border-red-500/40 rounded-sm flex items-center justify-center">
              <Shield className="w-3 h-3 text-red-400" />
            </div>
            <p className="text-red-400 font-black italic uppercase tracking-tight text-xs">Command Center</p>
          </div>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-gray-500 hover:text-white transition-colors"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Sidebar */}
        <aside className={`w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col shrink-0 fixed md:relative h-full md:h-auto z-40 transition-transform duration-300 md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          {/* Logo */}
          <div className="p-6 border-b border-white/5 mt-16 md:mt-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-red-500/20 border border-red-500/40 rounded-sm flex items-center justify-center">
                <Shield className="w-4 h-4 text-red-400" />
              </div>
              <div>
                <p className="text-[10px] text-red-400 font-black uppercase tracking-[0.3em]">Admin</p>
                <p className="text-white font-black italic uppercase tracking-tight text-sm leading-none">
                  Command Center
                </p>
              </div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map(({ href, label, icon: Icon, exact }) => {
              const isActive = exact ? pathname === href : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-sm text-[11px] font-black uppercase tracking-widest transition-all ${
                    isActive
                      ? "bg-red-500/10 text-red-400 border border-red-500/20"
                      : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-white/5">
            <div className="flex items-center gap-3 bg-white/5 px-3 py-2.5 rounded-sm">
              <div className="w-7 h-7 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center shrink-0">
                <Shield className="w-3 h-3 text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-[10px] font-black uppercase tracking-widest truncate">
                  {profile?.username || "Admin"}
                </p>
                <p className="text-red-400/60 text-[8px] font-bold uppercase tracking-widest">
                  Root Administrator
                </p>
              </div>
            </div>
            <Link
              href="/dashboard"
              onClick={() => setMobileMenuOpen(false)}
              className="mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors px-3 py-2"
            >
              <LogOut className="w-3 h-3" />
              Back to Player Dashboard
            </Link>
          </div>
        </aside>

        {/* Mobile Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Main Content */}
        <main className="flex-1 w-full pt-20 md:pt-0 p-4 md:p-8 min-h-screen">
          {/* Security Banner */}
          <div className="flex items-center gap-2 mb-8 bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-sm">
            <AlertTriangle className="w-3 h-3 text-red-500/60 shrink-0" />
            <p className="text-[9px] text-red-500/60 font-black uppercase tracking-[0.2em]">
              Restricted Zone — All actions are logged and audited. Misuse will result in immediate revocation of access.
            </p>
          </div>
          {children}
        </main>

        {/* Floating Command Menu Button */}
        <div className="fixed bottom-6 right-6 z-50">
          {floatingMenuOpen && (
            <div
              className="fixed inset-0"
              onClick={() => setFloatingMenuOpen(false)}
            />
          )}
          
          {floatingMenuOpen && (
            <div className="absolute bottom-16 right-0 bg-[#0a0a0a] border border-white/10 rounded-sm shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-200 min-w-[240px]">
              <div className="bg-red-500/10 border-b border-white/5 p-3">
                <p className="text-[9px] text-red-400 font-black uppercase tracking-widest">Admin Commands</p>
              </div>
              <nav className="p-2 space-y-1">
                {navItems.map(({ href, label, icon: Icon }) => {
                  const isActive = pathname === href || pathname.startsWith(href);
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setFloatingMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-sm text-[10px] font-black uppercase tracking-widest transition-all ${
                        isActive
                          ? "bg-red-500/10 text-red-400 border border-red-500/20"
                          : "text-gray-500 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{label}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>
          )}

          <button
            onClick={() => setFloatingMenuOpen(!floatingMenuOpen)}
            className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.4)] border border-red-500/20 hover:scale-110 active:scale-95 transition-all"
            aria-label="Admin Command Menu"
          >
            {floatingMenuOpen ? <X className="w-6 h-6" /> : <Command className="w-6 h-6" />}
          </button>
        </div>
      </div>
    </AdminGuard>
  );
}
