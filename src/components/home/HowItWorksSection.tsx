export default function HowItWorksSection() {
  const steps = [
    {
      num: "01",
      title: "Deposit & Queue",
      desc: "Buy CGame Coins via Paystack ($1.00 USD = 100 Coins). Join a 'Sit & Go' queue for your favorite game mode. Your entry fee is locked securely in Escrow."
    },
    {
      num: "02",
      title: "Play the Match",
      desc: "One player is chosen as Host to create a private room in CODM or eFootball. Both players join and play the match using our strict competitive rulebook."
    },
    {
      num: "03",
      title: "Report & Earn",
      desc: "Upload the end-game screenshot to claim your win. If both players agree, Escrow directly releases the prize pool to the winner's wallet minus a 20% platform rake."
    },
    {
      num: "04",
      title: "Dispute Resolution",
      desc: "Opponent lied? Upload a recording of the match. Our AI OCR and human admins instantly review killfeeds and rule-breaks to award you the win and punish cheaters."
    }
  ];

  return (
    <div id="how-it-works" className="py-24 bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black uppercase italic tracking-tighter text-white">
            How The <span className="text-accent">Escrow</span> Works
          </h2>
          <p className="mt-4 text-gray-400 max-w-2xl mx-auto text-lg">
            No more running away with the prize. No more arguing over scores. 
            CGameCore physically holds the money until the match is validated.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step, i) => (
            <div key={i} className="bg-surface border border-surface-border p-8 hover:border-accent/50 transition-colors rounded-sm relative group">
              <div className="absolute top-0 right-0 p-4 opacity-10 font-black text-6xl text-white group-hover:text-accent transition-colors">
                {step.num}
              </div>
              <h3 className="text-xl font-bold text-white mb-4 relative z-10">{step.title}</h3>
              <p className="text-gray-400 text-sm leading-relaxed relative z-10">
                {step.desc}
              </p>
            </div>
          ))}
        </div>
        
        {/* Earnings Math Example */}
        <div className="mt-16 bg-gradient-to-br from-surface to-black border border-accent/20 p-8 rounded-sm max-w-3xl mx-auto">
          <h3 className="text-xl font-black uppercase tracking-widest text-white text-center mb-6">The Prize Math</h3>
          <div className="flex flex-col md:flex-row items-center justify-between text-center gap-4">
            <div>
              <div className="text-gray-400 text-sm uppercase">You Drop</div>
              <div className="text-2xl font-black text-white">100 Coins</div>
            </div>
            <div className="text-accent font-black text-2xl">+</div>
            <div>
              <div className="text-gray-400 text-sm uppercase">Opposing Drops</div>
              <div className="text-2xl font-black text-white">100 Coins</div>
            </div>
            <div className="text-accent font-black text-2xl">=</div>
            <div className="bg-accent/10 p-4 border border-accent/30 rounded-sm">
              <div className="text-accent text-sm font-bold uppercase">Winner Takes</div>
              <div className="text-3xl font-black text-white">160 Coins</div>
              <div className="text-xs text-gray-500 mt-1">(40 Coin Platform Fee)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
