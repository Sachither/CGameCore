import ClientDashboardLayout from "@/components/dashboard/ClientDashboardLayout";
import { RestrictionGuard } from "@/components/auth/RestrictionGuard";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RestrictionGuard>
      <ClientDashboardLayout>{children}</ClientDashboardLayout>
    </RestrictionGuard>
  );
}
