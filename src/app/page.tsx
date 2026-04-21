import HeroSection from "@/components/home/HeroSection";
import TournamentSection from "@/components/home/TournamentSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <TournamentSection />
      <HowItWorksSection />
    </div>
  );
}
