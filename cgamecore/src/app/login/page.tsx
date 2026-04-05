import LoginForm from "@/components/auth/LoginForm";

export const metadata = {
  title: "Login | CGameCore",
  description: "Sign in to you CGameCore account and start earning",
};

export default function LoginPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <LoginForm />
    </div>
  );
}
