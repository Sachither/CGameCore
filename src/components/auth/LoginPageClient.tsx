"use client";
import LoginForm from "@/components/auth/LoginForm";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

export default function LoginPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // SECURITY: Relaxed to prevent aggressive reloads during development/ngrok sessions
    /*
    if (searchParams.toString()) {
      router.replace('/login');
    }
    */
  }, [searchParams, router]);

  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}