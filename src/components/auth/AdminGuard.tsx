"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import { Loader2 } from "lucide-react";

export default function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [hasChecked, setHasChecked] = useState(false);
  const [checkTimeout, setCheckTimeout] = useState(false);

  useEffect(() => {
    // Set a longer timeout for mobile - wait up to 10 seconds for Firestore profile
    const timeout = setTimeout(() => {
      setCheckTimeout(true);
    }, 10000);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    // If still loading after auth provider says loading is done, check again
    if (loading) {
      setHasChecked(false);
      return;
    }

    // Only check once after loading is complete
    if (!hasChecked) {
      setHasChecked(true);

      // Check if user is authenticated
      if (!user) {
        console.warn("[AdminGuard] No user authenticated, redirecting to login");
        router.replace("/login?callback=/admin");
        return;
      }

      // Check if user has admin role/permission
      const isAdmin = profile?.isAdmin === true || profile?.role === 'ADMIN' || profile?.role === 'SUPER_ADMIN';
      
      if (!isAdmin) {
        console.warn("[AdminGuard] User is not admin, redirecting to dashboard");
        router.replace("/dashboard");
        return;
      }

      console.log("[AdminGuard] Admin access verified for:", profile?.username);
    }
  }, [user, profile, loading, hasChecked, router]);

  // Show loading state while waiting for auth/profile
  if (loading || !hasChecked) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-600">Verifying Admin Clearance...</p>
          {checkTimeout && (
            <p className="text-[8px] font-black uppercase tracking-[0.3em] text-gray-700 max-w-xs text-center">
              Connection slow. If this persists, try refreshing or check your internet connection.
            </p>
          )}
        </div>
      </div>
    );
  }

  // User is authenticated and is admin
  return <>{children}</>;
}
