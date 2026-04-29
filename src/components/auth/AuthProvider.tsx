"use client";
import React, { createContext, useContext, useEffect, useState, useRef, useMemo } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

export interface UserProfile {
  uid: string;
  username: string;
  email: string;
  phone?: string;
  avatarId: number;
  balanceCoins: number;
  totalWins?: number;
  totalMatches?: number;
  lifetimeDeposits?: number;
  lifetimeWagered?: number;
  codTag?: string;
  efootballTag?: string;
  createdAt: any;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'PARTNER';
  country?: string;
  currency?: string;
  isBanned?: boolean;
  legalName?: string;
  isIdentityLocked?: boolean;
  banReason?: string;
  suspendedUntil?: any;
  intervention?: {
    active: boolean;
    matchId?: string;
    message?: string;
    adminName?: string;
    createdAt?: any;
  };
  ping?: {
    active: boolean;
    matchId?: string;
    from?: string;
    message?: string;
    timestamp?: any;
  };
  referredBy?: string;
  myReferralCode?: string;
  partnerExpiresAt?: any;
}

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isSyncing: boolean;
  idToken: string | null;
  sessionId: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isSyncing: false,
  idToken: null,
  sessionId: null,
  refreshProfile: async () => { },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // 🔄 Track internal auth lifecycle
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const redirectCooldown = useRef<number>(0);
  const sessionStartRef = useRef(Date.now()); // 🛡️ Session Grace Period Tracker

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // 1. [HYDRATION] Load cached profile instantly to prevent flicker
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('cgame_profile');
    if (cached) {
      try {
        const data = JSON.parse(cached);
        setProfile(data);
        console.log("[AuthProvider] Hydrated from cache:", data.username);
      } catch (e) {
        localStorage.removeItem('cgame_profile');
      }
    }
  }, []);

  // 2. [AUTH OBSERVER] Single source of truth for Firebase
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("[AuthProvider] Auth State Changed:", firebaseUser?.email || "GUEST");

      if (firebaseUser) {
        setUser(firebaseUser);
        setProfile(null); // 🛡️ Clear old profile immediately to prevent stale redirects
        // Reset session start time when a new user is detected
        sessionStartRef.current = Date.now();

        const token = await firebaseUser.getIdToken();
        setIdToken(token);

        // Subscribe to Firestore Profile
        const docRef = doc(db, "users", firebaseUser.uid);
        if (profileUnsub) profileUnsub();

        profileUnsub = onSnapshot(docRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);

            // Sync cache
            const safeCache = {
              uid: data.uid,
              username: data.username,
              avatarId: data.avatarId,
              balanceCoins: data.balanceCoins,
              role: data.role,
              isBanned: data.isBanned,
              suspendedUntil: data.suspendedUntil,
              country: data.country,
              currency: data.currency
            };
            localStorage.setItem('cgame_profile', JSON.stringify(safeCache));

            setLoading(false);
            setIsInitialized(true);
          } else {
            console.warn("[AuthProvider] No Firestore profile found for authed user.");
            // Always initialize so the UI can render (e.g. Navbar showing 'Finish Enlistment')
            setIsInitialized(true);
            setLoading(false);
          }
        }, (err) => {
          console.error("[AuthProvider] Profile Sync Error:", err);
          setLoading(false);
          setIsInitialized(true);
        });
      } else {
        // GUEST STATE
        if (profileUnsub) {
          profileUnsub();
          profileUnsub = null;
        }
        setUser(null);
        setProfile(null);
        setIdToken(null);
        setLoading(false);
        setIsSyncing(false); // 🛡️ Ensure syncing stops on logout
        setIsInitialized(true);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  // 3. [NAVIGATION BRAIN] The only place redirects are allowed
  // 🧠 TACTICAL NAVIGATION BRAIN
  useEffect(() => {
    // Guard: Wait for system readiness
    if (!isInitialized || loading) return;

    // Guard: Anti-loop cooldown
    const now = Date.now();
    if (now - redirectCooldown.current < 3000) return;

    const currentPath = pathname || "/";
    const isAuthPage = currentPath === '/' || currentPath.startsWith('/login') || currentPath.startsWith('/register');
    const isDashboard = currentPath.startsWith('/dashboard') || currentPath.startsWith('/match') ||
      currentPath.startsWith('/profile') || currentPath.startsWith('/admin');

    // LOGIC 1: Guest Access Control (with persistence grace)
    if (!user) {
      if (isDashboard) {
        // 🛡️ Persistence Grace: Allow 3 seconds for Firebase to recover from cache
        // This prevents "flicker" kicks on mobile reloads
        const sessionTime = (Date.now() - sessionStartRef.current) / 1000;
        if (sessionTime < 5) {
          console.log("[Auth] User null but session fresh. Holding for cache recovery...");
          return;
        }

        console.warn("[Auth] Guest detected on protected route. Redirecting to login.");
        redirectCooldown.current = now;
        router.replace('/login');
      }
      return;
    }

    // LOGIC 2: Authenticated User (Orphan vs Operative)
    if (user) {
      const sessionTime = (Date.now() - sessionStartRef.current) / 1000;

      // A: User lacks a Firestore profile
      if (!profile) {
        const gracePeriod = isDashboard ? 8 : 3;

        if (sessionTime < gracePeriod) {
          if (!isSyncing) setIsSyncing(true);
          return;
        }

        // Grace period expired - Definitely an orphan
        if (isSyncing) setIsSyncing(false);
        if (!currentPath.startsWith('/register')) {
          console.warn("[Auth] Orphan account detected after grace period. Forcing enlistment.");
          redirectCooldown.current = now;
          router.replace('/register');
        }
        return;
      }

      // B: User has a profile (Operative)
      if (isSyncing) setIsSyncing(false);

      // If they are on any auth/landing page (including register), they should be in the dashboard
      if (isAuthPage) {
        console.log("[Auth] Operative detected on auth page. Redirecting to Basecamp.");
        redirectCooldown.current = now;
        router.replace('/dashboard');
        return;
      }

      // C: Banned check
      if (profile?.isBanned && currentPath !== '/banned' && isDashboard) {
        redirectCooldown.current = now;
        router.replace('/banned');
      }
    }
  }, [user, profile?.uid, loading, isInitialized, pathname, router]);

  const refreshProfile = async () => {
    if (!user) return;
    console.log("[AuthProvider] Manual profile refresh triggered. Resetting grace period...");
    sessionStartRef.current = Date.now(); // 🛡️ Grant fresh grace period for propagation

    try {
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        setProfile(snap.data() as UserProfile);
        console.log("[AuthProvider] Profile synchronized successfully.");
      } else {
        console.warn("[AuthProvider] Profile document missing during refresh.");
      }
    } catch (err) {
      console.error("[AuthProvider] Manual refresh failed:", err);
    }
  };

  const contextValue = useMemo(() => ({
    user, profile, loading, isSyncing, idToken, sessionId, refreshProfile
  }), [user, profile, loading, isSyncing, idToken, sessionId]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
