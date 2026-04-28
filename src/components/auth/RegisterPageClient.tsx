"use client";
import RegisterForm from "@/components/auth/RegisterForm";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useAuth } from "./AuthProvider";

export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();

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

  // 🛡️ Flicker Suppression: Hide the form the moment authentication is detected.
  // This prevents the form from being visible during the 3-5s profile creation window.
  if (user || loading) {
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