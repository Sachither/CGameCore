"use client";
import React from "react";
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

  return (
    <AdminGuard>
      <div className="min-h-screen bg-black flex">
        {/* Sidebar */}
        <aside className="w-64 bg-[#0a0a0a] border-r border-white/5 flex flex-col shrink-0 fixed h-full z-40">
          {/* Logo */}
          <div className="p-6 border-b border-white/5">
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
              className="mt-2 flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-gray-600 hover:text-white transition-colors px-3 py-2"
            >
              <LogOut className="w-3 h-3" />
              Back to Player Dashboard
            </Link>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 ml-64 p-8 min-h-screen">
          {/* Security Banner */}
          <div className="flex items-center gap-2 mb-8 bg-red-500/5 border border-red-500/10 px-4 py-2 rounded-sm">
            <AlertTriangle className="w-3 h-3 text-red-500/60 shrink-0" />
            <p className="text-[9px] text-red-500/60 font-black uppercase tracking-[0.2em]">
              Restricted Zone — All actions are logged and audited. Misuse will result in immediate revocation of access.
            </p>
          </div>
          {children}
        </main>
      </div>
    </AdminGuard>
  );
}
