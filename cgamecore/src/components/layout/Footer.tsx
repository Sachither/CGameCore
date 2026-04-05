import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-surface border-t border-surface-border py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-black tracking-tighter uppercase italic mb-4 block">
              CGame<span className="text-accent">Core</span>
            </span>
            <p className="text-gray-400 text-sm max-w-sm">
              The premier high-stakes, skill-based competitive matchmaking platform for mobile gamers. 
              Play eFootball and COD Mobile for real money in a secure, fair, and moderated environment.
            </p>
          </div>
          
          <div>
            <h3 className="text-white font-bold uppercase tracking-wider mb-4 text-sm">Legal</h3>
            <ul className="space-y-2">
              <li><Link href="/terms" className="text-gray-400 hover:text-accent text-sm transition-colors">Terms of Service</Link></li>
              <li><Link href="/privacy" className="text-gray-400 hover:text-accent text-sm transition-colors">Privacy Policy</Link></li>
              <li><Link href="/rules" className="text-gray-400 hover:text-accent text-sm transition-colors">Official Game Rules</Link></li>
            </ul>
          </div>
          
          <div>
            <h3 className="text-white font-bold uppercase tracking-wider mb-4 text-sm">Support</h3>
            <ul className="space-y-2">
              <li><Link href="/faq" className="text-gray-400 hover:text-accent text-sm transition-colors">FAQ</Link></li>
              <li><Link href="/contact" className="text-gray-400 hover:text-accent text-sm transition-colors">Contact Us</Link></li>
              <li><Link href="/discord" className="text-gray-400 hover:text-accent text-sm transition-colors">Join Discord</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-surface-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} CGameCore. All rights reserved.
          </p>
          <div className="mt-4 md:mt-0">
            <p className="text-gray-500 text-xs text-center md:text-right max-w-xl">
              Platform fees: 100 Coins = ₦1,500. Withdrawals strictly require verified OPay/PalmPay or Bank accounts matching your registered name to prevent fraud.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
