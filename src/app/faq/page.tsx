export default function FAQ() {
  const faqs = [
    {
      q: "Is CGameCore a gambling or betting website?",
      a: "No. CGameCore is strictly an esports skill-based competitive gaming platform. You pay an entry fee to enter a tournament or a head-to-head match, and the winner takes the prize pool. Because the outcome is determined entirely by your skill in the video game, it is legally classified as skill-based competition, not gambling or betting."
    },
    {
      q: "How do I withdraw my winnings?",
      a: "Winnings are added to your CGameCore Coin Balance. You can withdraw your balance via the platform. Withdrawals are processed to verified Local Bank accounts (or OPay/PalmPay). Please ensure your withdrawal name matches your registered identity to avoid anti-fraud blocks."
    },
    {
      q: "My opponent lied and claimed they won. What do I do?",
      a: "Dispute the match immediately. This is why our 'Absolute Victory Protocol' mandates that all players screen-record their matches. Once disputed, a moderator will step into the Match Comms chat and request your video evidence. The player with valid proof will be awarded the victory."
    },
    {
      q: "What happens if a match ends in a tie/draw?",
      a: "In standard 1v1 matchmaking, a confirmed draw will void the match, and entry fees will be refunded to both players. However, in Knockout Tournaments or Master Circuits, draws are often not permitted, and tie-breakers (or Extra Time/Penalties) must be utilized to find a definitive winner."
    },
    {
      q: "I disconnected during the match string. Do I lose?",
      a: "Unfortunately, maintaining a stable internet connection is part of competitive esports. If you disconnect mid-match, it is generally treated as a forfeit. However, if your opponent is gracious, they can agree to a restart via the Match Comms chat."
    },
    {
      q: "Are the game developers (Activision/Konami) involved in this?",
      a: "No. CGameCore operates entirely independently. We are not affiliated with, endorsed by, or sponsored by Activision (Call of Duty) or Konami (eFootball) in any capacity."
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 animate-in fade-in duration-700">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-4">
          Frequently <span className="text-accent">Asked Questions</span>
        </h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Tactical Briefing & Support</p>
      </div>

      <div className="space-y-6">
        {faqs.map((faq, idx) => (
           <div key={idx} className="bg-surface border border-surface-border p-6 rounded-[3px]">
              <h3 className="text-lg font-black text-white uppercase tracking-widest mb-3 italic flex items-start gap-3">
                 <span className="text-accent font-mono text-sm leading-tight mt-1">Q_</span>
                 {faq.q}
              </h3>
              <div className="flex items-start gap-3 text-gray-400 text-sm leading-relaxed pl-1">
                 <span className="text-gray-600 font-mono text-sm leading-tight">A_</span>
                 <p>{faq.a}</p>
              </div>
           </div>
        ))}
      </div>
    </div>
  );
}
