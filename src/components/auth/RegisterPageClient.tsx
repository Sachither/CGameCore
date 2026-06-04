"use client";
import RegisterForm from "@/components/auth/RegisterForm";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

export default function RegisterPageClient() {
  const searchParams = useSearchParams();
  const { user, profile, loading, isSyncing } = useAuth();

  useEffect(() => {
    const code = searchParams.get('code');
    if (code) {
      localStorage.setItem('pending_referral_code', code);
      
      // Background lookup for Google Auth compatibility (requires UID)
      fetch(`/api/identity-check?field=referralCode&value=${encodeURIComponent(code)}`)
        .then(res => res.json())
        .then(data => {
          if (data.success && data.exists && data.uid) {
            localStorage.setItem('pending_referral_uid', data.uid);
          }
        })
        .catch(err => console.error("Referral lookup failed:", err));
    }
  }, [searchParams]);

  // 🛡️ Smart Flicker Suppression
  // Show loader if the auth system is still initializing or if the signed-in
  // user is still being checked for an existing Firestore profile.
  const shouldShowLoader = loading || isSyncing || (user && profile);

  if (shouldShowLoader) {
     return (
       <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
         <div className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
       </div>
     );
  }

  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <RegisterForm />
    </div>
  );
}