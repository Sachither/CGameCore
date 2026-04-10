"use client";
import RegisterForm from "@/components/auth/RegisterForm";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function RegisterPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // SECURITY: Relaxed to prevent aggressive reloads during development/ngrok sessions
    // If sensitive data detection is needed, we should check for specific keys instead
    /*
    if (searchParams.toString()) {
      router.replace('/register');
    }
    */
  }, [searchParams, router]);

  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <RegisterForm />
    </div>
  );
}