import Link from "next/link";

export default function TournamentIndexPage() {
  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="mb-10">
         <h1 className="text-3xl md:text-4xl font-black text-main italic tracking-tighter uppercase">
           Select <span className="text-accent-aware">Game</span>
         </h1>
         <p className="text-sub text-sm mt-2 uppercase tracking-widest font-bold">
           Choose a category before viewing available live brackets.
         </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Call of Duty Mobile Card Route */}
        <Link href="/dashboard/tournaments/codm" className="group relative bg-surface border border-surface-border overflow-hidden rounded-[5px] cursor-pointer hover:border-accent/80 hover:shadow-[0_0_30px_rgba(0,255,102,0.15)] transition-all block">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
          <div className="h-64 w-full bg-zinc-900 flex items-center justify-center opacity-40 group-hover:opacity-70 transition-opacity">
            <span className="text-gray-700 font-bold uppercase tracking-widest text-xs">CODM Wallpaper</span>
          </div>
          <div className="absolute bottom-0 left-0 p-8 z-20 w-full transform group-hover:-translate-y-2 transition-transform">
            <h3 className="text-3xl md:text-4xl font-black uppercase italic text-main group-hover:text-accent-aware transition-colors drop-shadow-md">
              Call of Duty: <br />Mobile
            </h3>
            <p className="text-sub text-sm mt-2 font-bold mb-4">1v1 Duels (Any Weapon) and Battle Royale.</p>
            <div className="inline-flex items-center text-accent-aware tracking-widest font-black uppercase text-xs">
              View Tournaments →
            </div>
          </div>
        </Link>

        {/* eFootball Card Route */}
        <Link href="/dashboard/tournaments/efootball" className="group relative bg-surface border border-surface-border overflow-hidden rounded-[5px] cursor-pointer hover:border-accent/80 hover:shadow-[0_0_30px_rgba(0,255,102,0.15)] transition-all block">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
          <div className="h-64 w-full bg-zinc-900 flex items-center justify-center opacity-40 group-hover:opacity-70 transition-opacity">
            <span className="text-gray-700 font-bold uppercase tracking-widest text-xs">eFootball Wallpaper</span>
          </div>
          <div className="absolute bottom-0 left-0 p-8 z-20 w-full transform group-hover:-translate-y-2 transition-transform">
            <h3 className="text-3xl md:text-4xl font-black uppercase italic text-main group-hover:text-accent-aware transition-colors drop-shadow-md">
              eFootball <br />Mobile
            </h3>
            <p className="text-sub text-sm mt-2 font-bold mb-4">Premium League Tables, 1v1 Standard, and Golden Goal.</p>
            <div className="inline-flex items-center text-accent-aware tracking-widest font-black uppercase text-xs">
              View Tournaments →
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
