"use client";
import RegisterForm from "@/components/auth/RegisterForm";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <RegisterForm />
    </div>
  );
}