export default function TermsOfService() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 animate-in fade-in duration-700">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-4">
          Terms of <span className="text-accent">Service</span>
        </h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-12 text-gray-300">
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">1. Acceptance of Terms</h2>
          <p className="leading-relaxed text-sm">
            By accessing or using CGameCore ("the Platform"), you agree to abide by these Terms of Service. CGameCore provides an esports skill-based competitive gaming environment where players can compete in authorized video game titles for a prize pool based on their personal skill. 
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">2. Not a Gambling Platform</h2>
          <p className="leading-relaxed text-sm mb-4">
            <strong className="text-accent">CGameCore is STRICTLY a skill-based esport platform.</strong> We are not a casino, betting, or gambling service. The outcomes of all matches and tournaments hosted on the Platform are determined solely by the skill, knowledge, and physical dexterity of the participating players. Elements of chance do not determine the outcome of our tournaments.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">3. Eligibility and Participation</h2>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>You must be at least 18 years of age to register and participate in cash-entry tournaments on CGameCore.</li>
            <li>You are responsible for ensuring that participating in skill-based esports for prize pools is legal in your local jurisdiction or country.</li>
            <li>While CGameCore welcomes international players, certain regions may prohibit skill-based cash competitions. It is your sole responsibility to comply with local laws.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">4. Entry Fees and Prize Pools</h2>
          <p className="leading-relaxed text-sm mb-4">
            Participation in certain tournaments or matchmaking queues requires an Entry Fee (deducted from your in-platform Coin balance). The Entry Fees contributed by participating players are aggregated to form a Prize Pool. 
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>CGameCore retains a platform administrative fee from the total Prize Pool for hosting, moderating, and maintaining the servers.</li>
            <li>Prize Pools are awarded directly to the winner(s) based strictly on match performance.</li>
            <li>All entry fees are final and non-refundable once a match has commenced, except in cases determined by CGameCore administration (e.g., severe technical failures).</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">5. Absolute Victory Protocol and Disputes</h2>
          <p className="leading-relaxed text-sm">
            To ensure absolute fairness, players must abide by our Official Game Rules. Video evidence is mandatory for resolving disputes. In the event of a conflict, CGameCore Moderators have the final authority to review evidence and adjust match outcomes. Fraudulent claims, falsified evidence, or toxic behavior will result in an immediate and permanent ban.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">6. Intellectual Property Disclaimer</h2>
          <div className="bg-surface-hover border border-surface-border p-4 rounded-[3px]">
             <p className="leading-relaxed text-sm text-gray-400">
               CGameCore is deeply respectful of intellectual property rights. This platform is <strong>NOT affiliated with, endorsed by, authorized by, or sponsored by Activision Publishing, Inc. (Call of Duty Mobile) or Konami Group Corporation (eFootball).</strong> All game titles, trademarks, screenshots, artwork, and copyrights belong to their respective owners. We merely provide a statistical and communicative layer for players to organize skill-based matches in these third-party titles.
             </p>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">7. Account Termination</h2>
          <p className="leading-relaxed text-sm">
            CGameCore reserves the right to suspend or terminate the account of any operative found to be cheating, exploiting, using third-party software (aimbots, wallhacks), verbally abusing opponents, or attempting to defraud the platform. Terminated accounts will forfeit any remaining balances.
          </p>
        </section>
      </div>
    </div>
  );
}
