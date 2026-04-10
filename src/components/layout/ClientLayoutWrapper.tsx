"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar";
import Footer from "./Footer";
import UrgentAlertBanner from "./UrgentAlertBanner";

export default function ClientLayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname?.startsWith("/login") || pathname?.startsWith("/register");
  const isDashboard = pathname?.startsWith("/dashboard");
  const isAdmin = pathname?.startsWith("/admin");
  const isMatch = pathname?.startsWith("/match");
  const showChrome = !isAuthPage && !isDashboard && !isAdmin && !isMatch;

  return (
    <>
      <UrgentAlertBanner />
      {showChrome && <Navbar />}
      <main className="flex-grow">
        {children}
      </main>
      {showChrome && <Footer />}
    </>
  );
}
