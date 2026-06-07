import { Suspense } from "react";
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm";

export const metadata = {
  title: "Forgot Password | CGameCore",
  description: "Reset your CGameCore account password to restore access",
};

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
      <div className="min-h-[calc(100vh-80px)] pt-32 pb-20 flex items-center justify-center px-4">
        <ForgotPasswordForm />
      </div>
    </Suspense>
  );
}
