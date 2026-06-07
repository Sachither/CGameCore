import { Suspense } from "react";
import ResetPasswordForm from "@/components/auth/ResetPasswordForm";

export const metadata = {
  title: "Reset Password | CGameCore",
  description: "Set your new CGameCore account password to restore access",
};

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" />}>
      <div className="min-h-[calc(100vh-80px)] pt-32 pb-20 flex items-center justify-center px-4">
        <ResetPasswordForm />
      </div>
    </Suspense>
  );
}
