export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 animate-in fade-in duration-700">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-4">
          Privacy <span className="text-accent">Policy</span>
        </h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Last Updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-12 text-gray-300">
        
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">1. Operative Data Collection</h2>
          <p className="leading-relaxed text-sm mb-4">
            At CGameCore, data integrity is paramount. To facilitate our skill-based matchmaking architecture, we collect specific data points:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li><strong>Account Information:</strong> Email addresses, chosen usernames, and authentication tokens provided upon registration.</li>
            <li><strong>In-Game Identities:</strong> Your unique in-game names (IGN) or User IDs (UID) for Call of Duty Mobile and eFootball required to verify match participation.</li>
            <li><strong>Financial Logs:</strong> Transaction histories regarding deposits, entry fee deductions, prize pool credits, and withdrawal requests.</li>
            <li><strong>Match Telemetry:</strong> Records of your match history, wins, losses, performance stats, and any submitted video evidence for disputes.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">2. How We Deploy Your Data</h2>
          <p className="leading-relaxed text-sm mb-4">
            We use collected telemetry strictly for operational integrity:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>To match you accurately with opponents in our skill-based queues.</li>
            <li>To securely process financial transactions, entry fees, and prize payouts.</li>
            <li>To investigate and resolve match disputes using submitted evidence.</li>
            <li>To enforce our absolute zero-tolerance policy against cheating, smurfing, and fraudulent behavior.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">3. Data Protection and Vault Security</h2>
          <p className="leading-relaxed text-sm">
            CGameCore employs robust encryption for databasing user identities and transaction ledgers. We do not store raw credit card or banking infrastructure data on our own servers. Payment processing is entirely handled by compliant, secure third-party financial aggregators (e.g., Flutterwave).
          </p>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">4. Information Sharing Protocol</h2>
          <p className="leading-relaxed text-sm">
            We do not sell, rent, or trade your personal intelligence. We will only share data with external entities when mandated by legal compliance, or with financial processors exclusively for executing your requested withdrawals/deposits. Your public operator stats (win rate, match history) will be visible on the platform leaderboards.
          </p>
        </section>
        
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">5. Communications</h2>
          <p className="leading-relaxed text-sm">
            By registering, you consent to receive critical tactical alerts (match invites, dispute resolutions) and administrative updates regarding the platform.
          </p>
        </section>

      </div>
    </div>
  );
}
