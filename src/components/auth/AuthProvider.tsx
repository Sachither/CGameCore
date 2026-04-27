"use client";
import React, { createContext, useContext, useEffect, useState, useRef } from "react";
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
  role?: 'USER' | 'MODERATOR' | 'ADMIN' | 'SUPER_ADMIN' | 'PARTNER';
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

  // 🔒 [SECURITY] PHASE 7: Periodic session activity updates
  useEffect(() => {
    if (!user || !idToken || !sessionId) return;

    const updateActivity = async () => {
/* try {
  await updateSessionActivityAction(idToken, sessionId);
} catch (error) {
  console.warn("[AuthProvider] Session activity update failed:", error);
} */
};

// Update session activity every 10 minutes
const interval = setInterval(updateActivity, 10 * 60 * 1000);

// Initial update
updateActivity();

return () => clearInterval(interval);
}, [user, idToken, sessionId]);

// Hydration-safe cache loading & Referral Tracking
useEffect(() => {
const cached = localStorage.getItem('cgame_profile');
if (cached) {
setProfile(JSON.parse(cached));
}

// 🔗 [REFERRAL TRACKING] Check URL for ?ref= or ?referral=
if (typeof window !== 'undefined') {
const params = new URLSearchParams(window.location.search);
const refCode = params.get('ref') || params.get('referral');
if (refCode) {
  console.log(`[AuthProvider] Referral link detected: ${refCode}. Persisting to neural cache.`);
  localStorage.setItem('pending_referral_code', refCode.toUpperCase());
  
  // Asynchronously resolve to UID for faster profile creation later
  fetch(`/api/identity-check?field=referralCode&value=${encodeURIComponent(refCode)}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.exists) {
        localStorage.setItem('pending_referral_uid', data.uid);
        console.log(`[AuthProvider] Referral resolved to UID: ${data.uid}`);
      }
    })
    .catch(err => console.error("Referral resolution failed:", err));
}
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
  /* try {
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
  } */
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
      setLoading(false);

      // AUTO-REDIRECT: If on auth pages, move to dashboard
      const currentPath = pathnameRef.current;
      if (currentPath === '/login' || currentPath === '/register' || currentPath === '/') {
        console.log(`[AuthProvider] Session active on "${currentPath}". Redirecting to Dashboard...`);
        router.replace('/dashboard');
      }
    } else {
       // 🔒 [SECURITY] PHASE 7: Secure self-healing profile creation
       // Skip if on registration page to avoid race condition with RegisterForm
       const currentPath = pathnameRef.current;
       console.log(`[AuthProvider] Missing profile detected. Current Path: "${currentPath}"`);
       if (currentPath === '/register' || currentPath === '/login') {
         console.log(`[AuthProvider] Profile missing but user on auth page (${currentPath}). Allowing form interaction.`);
         setLoading(false);
         return;
       }

       // Run only if profile is missing to prevent quota loops
       try {
         // Verify Firebase Auth user data before creating profile
         if (!firebaseUser.email) {
           console.error("[AuthProvider] Cannot create profile: No email from Firebase Auth");
           setLoading(false);
           return;
         }

         console.log("[AuthProvider] Profile missing. Initiating secure auto-repair...");

         // Check for pending referral (Influencer tracking)
         const pendingReferralUid = typeof window !== 'undefined' ? localStorage.getItem('pending_referral_uid') : null;

         // Create profile with verified Firebase Auth data only
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
         if (typeof window !== 'undefined') localStorage.removeItem('pending_referral_code');
         
         console.log("[AuthProvider] Secure profile created successfully.");
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
/* try {
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
} */
};

return (
<AuthContext.Provider value={{ user, profile, loading, idToken, sessionId, refreshProfile }}>
{children}
</AuthContext.Provider>
);
}

// Convenient hook for consuming auth context
export const useAuth = () => useContext(AuthContext);
