import { Suspense } from "react";
import RegisterPageClient from "@/components/auth/RegisterPageClient";

export const metadata = {
  title: "Register | CGameCore",
  description: "Create your account and start playing high stakes matches.",
};

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
      <RegisterPageClient />
    </Suspense>
  );
}
