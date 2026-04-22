import HeroSection from "@/components/home/HeroSection";
import TournamentSection from "@/components/home/TournamentSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";
import LiveProofTicker from "@/components/home/LiveProofTicker";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <LiveProofTicker />
      <HeroSection />
      <TournamentSection />
      <HowItWorksSection />
    </div>
  );
}
