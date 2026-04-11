import { Suspense } from "react";
import LoginPageClient from "@/components/auth/LoginPageClient";

export const metadata = {
  title: "Login | CGameCore",
  description: "Sign in to you CGameCore account and start earning",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
      <LoginPageClient />
    </Suspense>
  );
}
