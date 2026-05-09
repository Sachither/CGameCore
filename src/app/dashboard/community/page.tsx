import CommunityChat from '@/components/community/CommunityChat';
import Sidebar from '@/components/dashboard/Sidebar';

export const metadata = {
  title: 'Community War Room | CGameCore',
  description: 'Connect with fellow operatives, share intel, and dominate the arena.',
};

export default function CommunityPage() {
  return (
    <div className="flex flex-col space-y-6">
      {/* Dynamic Header */}
      <div className="shrink-0">
        <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter text-white">
          Community <span className="text-accent">War Room</span>
        </h1>
        <p className="text-[10px] md:text-xs text-gray-500 font-bold uppercase tracking-[0.3em] mt-1">
          Tactical Communication & Global Intel Feed
        </p>
      </div>

      {/* Main Chat Container */}
      <div className="h-[750px] md:h-[850px] w-full">
        <CommunityChat />
      </div>
    </div>
  );
}
