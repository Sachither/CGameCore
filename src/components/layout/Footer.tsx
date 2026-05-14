import Link from 'next/link';
import { useAuth } from '@/components/auth/AuthProvider';
import { usePathname } from 'next/navigation';

export default function Footer() {
  const { user } = useAuth();
  
  // Members do not see the footer to maximize their dashboard experience
  if (user) return null;

  const pathname = usePathname();
  const isDashboard = pathname?.startsWith('/dashboard');

  return (
    <footer className={`bg-surface border-t border-surface-border py-12 mt-20 transition-all duration-300 ${isDashboard ? 'md:ml-64 lg:ml-64' : ''}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <span className="text-2xl font-black tracking-tighter uppercase italic mb-4 block">
              CGame<span className="text-accent">Core</span>
            </span>
            <p className="text-gray-400 text-sm max-w-sm">
              The premier high-stakes, skill-based competitive matchmaking platform for mobile gamers. 
              Compete in eFootball and COD Mobile for prize pools in a secure, fair, and moderated environment.
            </p>
          </div>
          
          <div>
            <h3 className="text-white font-bold uppercase tracking-wider mb-4 text-sm">Legal & Info</h3>
            <ul className="space-y-2">
              <li><Link href="/home" className="text-gray-400 hover:text-accent text-sm transition-colors">Home (Info)</Link></li>
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
              <li><a href="https://x.com/cgamecore123?s=21" target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-accent text-sm transition-colors">X (Twitter)</a></li>
              <li><a href="#" className="text-gray-400 hover:text-accent text-sm transition-colors">Join Discord</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-surface-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-start gap-6 relative">
          <div className="flex-1">
            <p className="text-gray-500 text-xs leading-relaxed max-w-3xl">
              <strong className="text-gray-400">LEGAL DISCLAIMER:</strong> CGameCore is an esports skill-based competitive gaming platform. This is strictly NOT a gambling or betting service. Users pay an entry fee to participate in skill-based tournaments and matchmaking for a prize pool. 
              <br/><br/>
              CGameCore is NOT affiliated with, endorsed by, authorized by, or sponsored by Activision Publishing, Inc. (Call of Duty Mobile) or Konami Group Corporation (eFootball). All game titles, trademarks, and copyrights are the property of their respective owners.
            </p>
          </div>

          <div className="md:text-right shrink-0">
             <p className="text-gray-500 text-xs mb-2">
               Platform fees: 100 Coins = $1.00 USD.
             </p>
             <p className="text-gray-500 text-[10px]">
               &copy; {new Date().getFullYear()} CGameCore. All rights reserved.
             </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
