import PartnerPortal from "@/components/dashboard/PartnerPortal";

export const metadata = {
  title: "Partner Portal | CGameCore",
  description: "Track your recruits and earnings in the tactical partner command center.",
};

export default function PartnerPage() {
  return (
    <div className="max-w-7xl mx-auto py-10 px-4 sm:px-6 lg:px-8">
      <PartnerPortal />
    </div>
  );
}
