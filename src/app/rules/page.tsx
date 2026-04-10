import { ShieldAlert, Gavel, Video, Zap } from 'lucide-react';

export default function GameRules() {
  return (
    <div className="max-w-4xl mx-auto px-4 pt-32 pb-16 animate-in fade-in duration-700">
      <div className="mb-12">
        <h1 className="text-4xl md:text-5xl font-black text-main italic tracking-tighter uppercase mb-4">
          Official <span className="text-accent">Game Rules</span>
        </h1>
        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">The Absolute Victory Protocol</p>
      </div>

      <div className="bg-red-500/10 border border-red-500/20 p-6 rounded-sm mb-12 flex items-start gap-4">
         <ShieldAlert className="w-8 h-8 text-red-500 shrink-0" />
         <div>
            <h3 className="text-red-500 font-black uppercase tracking-widest mb-2 italic">Read Before Deploying</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
               CGameCore is a highly competitive, skill-based ecosystem. Failure to adhere to these operational protocols will result in forfeited entry fees, match disqualifications, and potential permanent bans.
            </p>
         </div>
      </div>

      <div className="space-y-12 text-gray-300">
        
        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 italic">
            <Video className="w-5 h-5 text-accent" /> 1. The Evidence Mandate (Screen Recording)
          </h2>
          <p className="leading-relaxed text-sm mb-4">
            If you do not record, you cannot dispute.
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm bg-surface-hover p-4 rounded-sm border border-surface-border">
            <li><strong className="text-white">Every match must be recorded:</strong> All players must screen record their gameplay from the lobby deployment until the final victory/defeat screen.</li>
            <li><strong className="text-white">In Case of Disputes:</strong> If an opponent claims victory falsely, you are required to upload your video evidence. Command Moderators will review the footage.</li>
            <li><strong className="text-white">No Footage = No Mercy:</strong> If a dispute occurs and neither party can provide valid footage, the match may be forcefully voided or decided arbitrarily by the administration based on available telemetry.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 italic">
            <Zap className="w-5 h-5 text-accent" /> 2. Match Creation and No-Shows
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>The designated <strong>Host Player</strong> must create the game room and post the Room ID (and password if applicable) in the CGameCore Match Comms log immediately.</li>
            <li><strong>5-Minute Protocol:</strong> Once a match is formed, all operatives have 5 minutes to join the in-game lobby. Failure to join a lobby after 5 minutes constitutes a "No-Show".</li>
            <li>A player who can prove (via screenshot/video) that they waited in the lobby while the opponent failed to show will be awarded a Technical Victory and the prize pool.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 flex items-center gap-2 italic">
            <Gavel className="w-5 h-5 text-accent" /> 3. Exploits, Cheats, and Integrity
          </h2>
          <p className="leading-relaxed text-sm mb-4">
            Zero tolerance for dishonorable conduct:
          </p>
          <ul className="list-disc pl-6 space-y-2 text-sm">
            <li>The use of aim-bots, wallhacks, lag switches, modified APKs, or any third-party enhancement software will result in a permanent ban and forfeiture of all platform funds.</li>
            <li><strong>Smurfing/Account Sharing:</strong> You must play on the account ID matching the IGN declared on your CGameCore profile. Using an alt account or having someone else play for you is strictly forbidden.</li>
            <li><strong>Disconnections:</strong> If you disconnect during a live match, it is counted as a forfeit unless the opponent agrees (in the Match Comms chat) to restart the match.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-black text-white uppercase tracking-widest mb-4 italic">4. Game-Specific Rules</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
             <div className="bg-surface border border-surface-border p-5 rounded-sm">
                <h4 className="font-black uppercase tracking-widest text-white mb-2 italic">Call of Duty: Mobile</h4>
                <ul className="list-disc pl-4 space-y-2 text-xs text-gray-400">
                  <li>Radar must be set to normal (No UAV spam unless standard mode dictates).</li>
                  <li>In Sniper/Shotgun only formats, any use of secondary weapons, lethals, or operator skills is an automatic forfeit.</li>
                  <li>Camp-stalling the entire match is discouraged; blatant griefing may be penalized.</li>
                </ul>
             </div>

             <div className="bg-surface border border-surface-border p-5 rounded-sm">
                <h4 className="font-black uppercase tracking-widest text-white mb-2 italic">eFootball</h4>
                <ul className="list-disc pl-4 space-y-2 text-xs text-gray-400">
                  <li>Matches must be fully completed. Rage quitting results in a loss.</li>
                  <li>If the match ends in a draw during standard queue, the entry fee is typically refunded (voided), unless the format dictates Extra Time / Penalties (like in Circuit Knockouts).</li>
                  <li>Network tampering (lag switching) is tightly monitored and ban-able.</li>
                </ul>
             </div>
          </div>
        </section>

      </div>
    </div>
  );
}
