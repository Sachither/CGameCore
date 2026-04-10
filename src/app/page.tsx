import HeroSection from "@/components/home/HeroSection";
import HowItWorksSection from "@/components/home/HowItWorksSection";

export default function Home() {
  return (
    <div className="flex flex-col w-full">
      <HeroSection />
      <HowItWorksSection />
    </div>
  );
}
