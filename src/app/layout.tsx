import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/context/ToastContext";
import GlobalInterventionOverlay from "@/components/layout/GlobalInterventionOverlay";
import MatchReadyDispatcher from "@/components/match/MatchReadyDispatcher";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CGameCore | High Stakes Mobile Gaming",
  description: "Play CODM and eFootball for real money. Skill-based matchmaking with automated Escrow.",
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'default',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col bg-background text-foreground scroll-smooth">
        <AuthProvider>
          <ToastProvider>
            <GlobalInterventionOverlay />
            <MatchReadyDispatcher />
            <PushNotificationManager />
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
