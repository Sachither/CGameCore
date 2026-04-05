import RegisterForm from "@/components/auth/RegisterForm";

export const metadata = {
  title: "Register | CGameCore",
  description: "Create your account and start playing high stakes matches.",
};

export default function RegisterPage() {
  return (
    <div className="min-h-[calc(100vh-80px)] pt-10 pb-20 flex items-center justify-center px-4">
      <RegisterForm />
    </div>
  );
}
