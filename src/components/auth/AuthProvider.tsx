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

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Hydration-safe cache loading
  useEffect(() => {
    const cached = localStorage.getItem('cgame_profile');
    if (cached) {
      try {
        setProfile(JSON.parse(cached));
      } catch (e) {
        console.error("[AuthProvider] Cache parse error:", e);
      }
    }
  }, []);

  // 🔗 [REFERRAL TRACKING] Only runs when pathname changes (e.g. landing with ?ref=)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const refCode = params.get('ref') || params.get('referral');
    
    if (refCode) {
      console.log(`[AuthProvider] Tactical Referral Detected: ${refCode}. Validating...`);
      localStorage.setItem('pending_referral_code', refCode.toUpperCase());
      fetch(`/api/identity-check?field=referralCode&value=${encodeURIComponent(refCode)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.exists && data.uid) {
             console.log(`[AuthProvider] Referral Valid: ${data.username} (${data.uid})`);
             localStorage.setItem('pending_referral_uid', data.uid);
          }
        })
        .catch(err => console.error("[AuthProvider] Referral check failed:", err));
    }
  }, [pathname]);

  // 🛡️ [CORE AUTH & PROFILE SESSION] Persistent across navigations
  useEffect(() => {
    let profileUnsub: (() => void) | null = null;

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);

        // Subscribing to user profile in real-time
        const docRef = doc(db, "users", firebaseUser.uid);
        
        if (profileUnsub) profileUnsub();
        
        profileUnsub = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserProfile;
            setProfile(data);
            
            // Cache a safe version for speed
            const safeProfileCache = {
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
            localStorage.setItem('cgame_profile', JSON.stringify(safeProfileCache));
            setLoading(false);
          } else {
             // 🔒 [SECURITY] PHASE 7: Secure self-healing profile creation
             if (pathnameRef.current === '/register' || pathnameRef.current === '/login') {
               setLoading(false);
               return;
             }

             try {
               if (!firebaseUser.email) {
                 setLoading(false);
                 return;
               }

               console.log("[AuthProvider] Profile missing. Initiating auto-repair...");
               const pendingReferralUid = localStorage.getItem('pending_referral_uid');

               const secureProfile = {
                 uid: firebaseUser.uid,
                 username: firebaseUser.displayName || firebaseUser.email.split('@')[0] || "Player",
                 usernameLower: (firebaseUser.displayName || firebaseUser.email.split('@')[0] || "Player").toLowerCase(),
                 email: firebaseUser.email,
                 phone: firebaseUser.phoneNumber || null,
                 avatarId: Math.floor(Math.random() * 20),
                 balanceCoins: 0,
                 totalWins: 0,
                 totalMatches: 0,
                 lifetimeDeposits: 0,
                 lifetimeWagered: 0,
                 createdAt: serverTimestamp(),
                 emailVerified: firebaseUser.emailVerified,
                 verificationRequired: !firebaseUser.emailVerified,
                 referredBy: pendingReferralUid || null,
               };
               
               await setDoc(docRef, secureProfile, { merge: true });
               if (pendingReferralUid) localStorage.removeItem('pending_referral_uid');
               localStorage.removeItem('pending_referral_code');
             } catch (err) {
               console.error("[AuthProvider] Auto-repair failed:", err);
               setLoading(false);
             }
          }
        }, (err) => {
           console.error("[AuthProvider] Snapshot error:", err);
           setLoading(false);
        });
      } else {
        setProfile(null);
        localStorage.removeItem('cgame_profile');
        setSessionId(null);
        setIdToken(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      if (profileUnsub) profileUnsub();
    };
  }, [router]);

  // 🚦 [UNIFIED NAVIGATION BRAIN] Centralized redirect logic
  useEffect(() => {
    if (loading) return;

    const isDashboard = pathname.startsWith('/dashboard') || pathname.startsWith('/match') || pathname.startsWith('/profile') || pathname.startsWith('/wallet');
    const isAuthPage = pathname === '/login' || pathname === '/register' || pathname === '/';

    // 1. [GUEST -> LOGIN] Kick out of protected areas if no user
    if (!user && isDashboard) {
      console.log("[AuthProvider] Unauthorized access. Redirecting to Login...");
      router.replace('/login');
      return;
    }

    // 2. [LOGGED IN -> DASHBOARD] Move to dashboard if already authed
    if (user && isAuthPage) {
      // EXCEPTION: Allow /register only if profile is still missing (new signup)
      if (pathname === '/register' && !profile) return;
      
      console.log("[AuthProvider] Session active. Moving to Dashboard...");
      router.replace('/dashboard');
    }
  }, [user, profile, loading, pathname, router]);

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
