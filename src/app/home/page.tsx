import HeroSection from "@/components/home/HeroSection";
import TournamentSection from "@/components/home/TournamentSection";
import CommunityTeaser from "@/components/home/CommunityTeaser";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import LiveProofTicker from "@/components/home/LiveProofTicker";

export default function MarketingPage() {
  return (
    <div className="flex flex-col w-full">
      <LiveProofTicker />
      <HeroSection />
      <TournamentSection />
      <CommunityTeaser />
      <HowItWorksSection />
    </div>
  );
}
