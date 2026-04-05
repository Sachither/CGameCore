"use client";
import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, getDoc, onSnapshot, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

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
  codTag?: string;
  efootballTag?: string;
  createdAt: string;
  isAdmin?: boolean;
  role?: 'USER' | 'MODERATOR' | 'ADMIN';
  isBanned?: boolean;
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
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

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
      
      // Cleanup previous profile listener if exists
      profileUnsub();

      if (firebaseUser) {
        // Set up real-time profile listener
        const docRef = doc(db, "users", firebaseUser.uid);
        profileUnsub = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);
            // Cache for next session/refresh
            localStorage.setItem('cgame_profile', JSON.stringify(profileData));
            setLoading(false);
          } else {
             // SELF-HEALING: Profile missing? Create it now.
             console.log(`[AuthProvider] Profile missing for ${firebaseUser.uid}. Auto-repairing...`);
             try {
               const defaultProfile = {
                 uid: firebaseUser.uid,
                 username: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Player",
                 email: firebaseUser.email || "",
                 avatarId: Math.floor(Math.random() * 20),
                 balanceCoins: 0,
                 totalWins: 0,
                 totalMatches: 0,
                 createdAt: serverTimestamp(),
               };
               await setDoc(docRef, defaultProfile);
               // The snapshot listener will fire again with the new data automatically
             } catch (err) {
               console.error("[AuthProvider] Auto-repair failed (Check Firestore Rules!):", err);
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
        localStorage.setItem('cgame_profile', JSON.stringify(profileData));
        console.log("[AuthProvider] Profile force-refreshed successfully.");
      }
    } catch (err) {
      console.error("[AuthProvider] Manual refresh failed:", err);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// Convenient hook for consuming auth context
export const useAuth = () => useContext(AuthContext);
