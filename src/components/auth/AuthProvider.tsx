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
  idToken: string | null;
  sessionId: string | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
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
  const redirectCooldown = useRef<number>(0);

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
            // Don't set loading false yet - allow registration or auto-repair to happen
            // But if on dashboard, we might need a fallback
            if (pathnameRef.current.startsWith('/dashboard')) {
               // Initializing for a new user who just signed up
               setIsInitialized(true); 
               setLoading(false);
            }
          }
        }, (err) => {
          console.error("[AuthProvider] Profile Sync Error:", err);
          setLoading(false);
          setIsInitialized(true);
        });
      } else {
        // GUEST STATE
        setUser(null);
        setProfile(null);
        setIdToken(null);
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, []);

  // 3. [NAVIGATION BRAIN] The only place redirects are allowed
  useEffect(() => {
    // 🛡️ Guard 1: Wait for full initialization
    if (!isInitialized || loading) return;

    // 🛡️ Guard 2: Redirect Cooldown (Prevent loops)
    const now = Date.now();
    if (now - redirectCooldown.current < 1500) {
      console.log("[AuthProvider] Navigation logic debounced to prevent loop.");
      return;
    }

    const currentPath = pathname;
    const isDashboard = currentPath.startsWith('/dashboard') || 
                        currentPath.startsWith('/match') || 
                        currentPath.startsWith('/profile') || 
                        currentPath.startsWith('/wallet') ||
                        currentPath.startsWith('/admin');
                        
    const isAuthPage = currentPath === '/login' || 
                       currentPath === '/register' || 
                       currentPath === '/';

    // SCENARIO A: GUEST on Protected Route
    if (!user && isDashboard) {
      // 🕵️ Persistence Check: If we have a cache, give Firebase 2 more seconds to find the user
      const hasCache = localStorage.getItem('cgame_profile');
      if (hasCache) {
         console.warn("[AuthProvider] User null but cache exists. Holding for re-auth...");
         return;
      }

      console.warn("[AuthProvider] Redirecting GUEST to Login from:", currentPath);
      redirectCooldown.current = now;
      router.replace('/login');
      return;
    }

    // SCENARIO B: LOGGED IN on Auth Page
    if (user && isAuthPage) {
      // Exception: Allow /register for profile creation phase
      if (currentPath === '/register' && !profile) return;

      console.log("[AuthProvider] Redirecting AUTHED to Dashboard from:", currentPath);
      redirectCooldown.current = now;
      router.replace('/dashboard');
      return;
    }
  }, [user, profile, loading, isInitialized, pathname, router]);

  const refreshProfile = async () => {
    if (!user) return;
    const docRef = doc(db, "users", user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      setProfile(snap.data() as UserProfile);
    }
  };

  const contextValue = useMemo(() => ({
    user, profile, loading, idToken, sessionId, refreshProfile
  }), [user, profile, loading, idToken, sessionId]);

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
