"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { useRouter, usePathname } from "next/navigation";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { validateSessionContextAction, updateSessionActivityAction } from "@/app/actions/session-actions";

// Shape of our extended user profile from Firestore
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
  createdAt: string;
  isAdmin?: boolean;
  isSuperAdmin?: boolean;
  role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN';
  country?: string; // e.g. 'NG', 'GH', 'ZA', 'KE'
  currency?: string; // e.g. 'NGN', 'GHS', 'ZAR', 'KES'
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
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // 🔒 [SECURITY] PHASE 7: Periodic session activity updates
  useEffect(() => {
    if (!user || !idToken || !sessionId) return;

    const updateActivity = async () => {
      try {
        await updateSessionActivityAction(idToken, sessionId);
      } catch (error) {
        console.warn("[AuthProvider] Session activity update failed:", error);
      }
    };

    // Update session activity every 10 minutes
    const interval = setInterval(updateActivity, 10 * 60 * 1000);

    // Initial update
    updateActivity();

    return () => clearInterval(interval);
  }, [user, idToken, sessionId]);

  // Hydration-safe cache loading
  useEffect(() => {
    const cached = localStorage.getItem('cgame_profile');
    if (cached) {
      setProfile(JSON.parse(cached));
    }
  }, []);

  useEffect(() => {
    let profileUnsub: () => void = () => {};

    const authUnsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        setIdToken(token);

        // 🔒 [SECURITY] PHASE 7: Validate session context on login
        try {
          const sessionResult = await validateSessionContextAction(token);
          if (sessionResult.success) {
            setSessionId(sessionResult.sessionId || null);
            console.log("[AuthProvider] Session validated:", sessionResult.sessionId);
          } else {
            console.warn("[AuthProvider] Session validation failed:", sessionResult.error);
            setSessionId(null);
          }
        } catch (error) {
          console.warn("[AuthProvider] Session validation error:", error);
          setSessionId(null);
        }
      } else {
        setIdToken(null);
      }
      
      // Cleanup previous profile listener if exists
      profileUnsub();

      if (firebaseUser) {
        // Set up real-time profile listener
        const docRef = doc(db, "users", firebaseUser.uid);
        profileUnsub = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
            // 🔒 [SECURITY] PHASE 7: Cache only non-sensitive data (remove balance, admin status)
            const safeProfileCache = {
              uid: profileData.uid,
              username: profileData.username,
              email: profileData.email,
              phone: profileData.phone,
              avatarId: profileData.avatarId,
              codTag: profileData.codTag,
              efootballTag: profileData.efootballTag,
              createdAt: profileData.createdAt,
              country: profileData.country,
              currency: profileData.currency,
              // Remove sensitive data: balanceCoins, isAdmin, role, isBanned, etc.
            };
            localStorage.setItem('cgame_profile', JSON.stringify(safeProfileCache));
            setLoading(false);

            // AUTO-REDIRECT: If on auth pages, move to dashboard
            if (pathname === '/login' || pathname === '/register' || pathname === '/') {
              console.log("[AuthProvider] Session active. Entering Dashboard...");
              router.push('/dashboard');
            }
          } else {
             // 🔒 [SECURITY] PHASE 7: Secure self-healing profile creation
             console.log(`[AuthProvider] Profile missing for ${firebaseUser.uid}. Secure auto-repairing...`);
             try {
               // Verify Firebase Auth user data before creating profile
               if (!firebaseUser.email) {
                 console.error("[AuthProvider] Cannot create profile: No email from Firebase Auth");
                 setLoading(false);
                 return;
               }

               // Create profile with verified Firebase Auth data only
               const secureProfile = {
                 uid: firebaseUser.uid,
                 username: firebaseUser.displayName || firebaseUser.email.split('@')[0] || "Player",
                 email: firebaseUser.email,
                 phone: firebaseUser.phoneNumber || null,
                 avatarId: Math.floor(Math.random() * 20),
                 balanceCoins: 0, // Start with 0 - no auto-rewards
                 totalWins: 0,
                 totalMatches: 0,
                 lifetimeDeposits: 0,
                 lifetimeWagered: 0,
                 createdAt: serverTimestamp(),
                 emailVerified: firebaseUser.emailVerified,
                 // Require email verification before granting benefits
                 verificationRequired: !firebaseUser.emailVerified,
               };
               await setDoc(docRef, secureProfile);
               console.log("[AuthProvider] Secure profile created successfully");
             } catch (err) {
               console.error("[AuthProvider] Secure auto-repair failed:", err);
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
        setSessionId(null); // Clear session on logout
        setLoading(false);
      }
    });

    return () => {
      authUnsub();
      profileUnsub();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    try {
      const docRef = doc(db, "users", user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const profileData = snap.data() as UserProfile;
        setProfile(profileData);
        // 🔒 [SECURITY] PHASE 7: Cache only non-sensitive data
        const safeProfileCache = {
          uid: profileData.uid,
          username: profileData.username,
          email: profileData.email,
          phone: profileData.phone,
          avatarId: profileData.avatarId,
          codTag: profileData.codTag,
          efootballTag: profileData.efootballTag,
          createdAt: profileData.createdAt,
          country: profileData.country,
          currency: profileData.currency,
        };
        localStorage.setItem('cgame_profile', JSON.stringify(safeProfileCache));
        console.log("[AuthProvider] Profile force-refreshed successfully.");
      }
    } catch (err) {
      console.error("[AuthProvider] Manual refresh failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, idToken, sessionId, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Convenient hook for consuming auth context
export const useAuth = () => useContext(AuthContext);
