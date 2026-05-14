import CommunityChat from '@/components/community/CommunityChat';
import { getCommunityMessagesAction, getActiveAnnouncementAction } from '@/app/actions/community-actions';

export const metadata = {
  title: 'Community War Room | CGameCore',
  description: 'Connect with fellow operatives, share intel, and dominate the arena.',
};

export default async function CommunityPage() {
  // ⚡ TACTICAL PRE-FETCH: Load initial intel on the server for zero-latency entry
  const [messagesRes, announcementRes] = await Promise.all([
    getCommunityMessagesAction('GENERAL'),
    getActiveAnnouncementAction('GENERAL')
  ]);

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
      <div className="w-full">
        <CommunityChat 
          initialMessages={messagesRes.success ? (messagesRes.messages as any) : []} 
          initialAnnouncement={announcementRes.success ? (announcementRes.announcement as any) : null}
        />
      </div>
    </div>
  );
}
