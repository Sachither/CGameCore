export default function GameCategoryGrid() {
  return (
    <div className="mt-12">
      <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-6 flex items-center gap-2">
        Game Categories
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Call of Duty Mobile Card */}
        <div className="group relative bg-surface border border-surface-border overflow-hidden rounded-sm transition-colors block">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
          <div className="h-56 w-full bg-zinc-900 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
            <span className="text-gray-700 font-bold uppercase tracking-widest text-xs">CODM Wallpaper</span>
          </div>
          <div className="absolute bottom-0 left-0 p-6 z-20 w-full transform transition-transform">
            <h3 className="text-3xl font-black uppercase italic text-white transition-colors drop-shadow-md">
              Call of Duty: <br />Mobile
            </h3>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-black/80 backdrop-blur-sm border border-surface-border text-xs px-2.5 py-1 uppercase font-bold text-gray-300">1v1 Duels</span>
              <span className="bg-black/80 backdrop-blur-sm border border-surface-border text-xs px-2.5 py-1 uppercase font-bold text-gray-300">BR 20 TPP</span>
              <span className="bg-black/80 backdrop-blur-sm border border-surface-border text-xs px-2.5 py-1 uppercase font-bold text-gray-300">Alcatraz</span>
              <span className="bg-black/80 backdrop-blur-sm border border-surface-border text-xs px-2.5 py-1 uppercase font-bold text-gray-300">FFA</span>
            </div>
          </div>
        </div>

        {/* eFootball Card */}
        <div className="group relative bg-surface border border-surface-border overflow-hidden rounded-sm transition-colors block">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent z-10" />
          <div className="h-56 w-full bg-zinc-900 flex items-center justify-center opacity-40 group-hover:opacity-60 transition-opacity">
            <span className="text-gray-700 font-bold uppercase tracking-widest text-xs">eFootball Wallpaper</span>
          </div>
          <div className="absolute bottom-0 left-0 p-6 z-20 w-full transform transition-transform">
            <h3 className="text-3xl font-black uppercase italic text-white transition-colors drop-shadow-md">
              eFootball <br />Mobile
            </h3>
            <div className="flex flex-wrap gap-2 mt-4">
              <span className="bg-black/80 backdrop-blur-sm border border-accent-aware/50 text-[10px] sm:text-xs px-2.5 py-1 uppercase font-black text-accent-aware shadow-[0_0_10px_rgba(0,255,102,0.3)] animate-pulse">Tournament</span>
              <span className="bg-black/80 backdrop-blur-sm border border-surface-border text-[10px] sm:text-xs px-2.5 py-1 uppercase font-bold text-gray-300">1v1 Standard</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
