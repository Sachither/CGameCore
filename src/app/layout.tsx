import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ClientLayoutWrapper from "@/components/layout/ClientLayoutWrapper";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { ToastProvider } from "@/context/ToastContext";
import GlobalInterventionOverlay from "@/components/layout/GlobalInterventionOverlay";
import MatchReadyDispatcher from "@/components/match/MatchReadyDispatcher";
import PushNotificationManager from "@/components/notifications/PushNotificationManager";
import QuickPingOverlay from "@/components/notifications/QuickPingOverlay";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.cgamecore.online'),
  title: {
    default: "CGameCore | High Stakes Mobile Gaming",
    template: "%s | CGameCore",
  },
  description: "Play CODM and eFootball for real money. Enter automated escrow tournaments, verify scores, and win real cash payouts on Africa's premier gaming platform.",
  keywords: ["Esports", "CODM tournaments", "eFootball tournaments", "play for money", "gaming escrow", "competitive mobile gaming", "crypto gaming", "Nigeria esports"],
  openGraph: {
    title: "CGameCore | High Stakes Mobile Gaming",
    description: "Play CODM and eFootball for real money. Enter automated escrow tournaments, verify scores, and win real cash payouts.",
    url: "https://www.cgamecore.online",
    siteName: "CGameCore",
    images: [
      {
        url: "/web-app-manifest-512x512.png", // Fallback OPenGraph image using existing 512 logo
        width: 512,
        height: 512,
        alt: "CGameCore Logo",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CGameCore | High Stakes Mobile Gaming",
    description: "Compete in high stakes CODM & eFootball matches. Secure escrow and instant payouts.",
    images: ["/web-app-manifest-512x512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "CGame",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/favicon.svg?v=1", type: "image/svg+xml" },
      { url: "/favicon.ico?v=1", sizes: "any" },
      { url: "/favicon-96x96.png?v=1", sizes: "96x96", type: "image/png" },
      { url: "/web-app-manifest-192x192.png?v=1", sizes: "192x192", type: "image/png" },
      { url: "/web-app-manifest-512x512.png?v=1", sizes: "512x512", type: "image/png" },
    ],
    apple: { url: "/apple-touch-icon.png?v=1", sizes: "180x180" },
    shortcut: "/favicon.ico?v=1",
  },
  other: {
    'mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'theme-color': '#000000',
    'msapplication-TileColor': '#000000',
    'msapplication-config': '/browserconfig.xml',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
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
            <QuickPingOverlay />
            <ClientLayoutWrapper>
              {children}
            </ClientLayoutWrapper>
          </ToastProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
