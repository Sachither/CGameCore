"use client";
import { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/components/auth/AuthProvider';
import { verifyFlutterwavePaymentAction } from '@/app/actions/flutterwave-actions';
import { Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Tactical Recovery Heartbeat
 * Scans for PENDING deposits and auto-verifies them.
 */
export default function DepositRecoveryHeartbeat() {
  const { user, refreshProfile } = useAuth();
  const [recovering, setRecovering] = useState(false);
  const [recoveredCount, setRecoveredCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const runRecovery = async () => {
      try {
        const idToken = await user.getIdToken();
        
        const q = query(
          collection(db, "transactions"),
          where("uid", "==", user.uid),
          where("status", "==", "PENDING"),
          where("type", "==", "DEPOSIT")
        );

        const snap = await getDocs(q);
        if (snap.empty) return;

        setRecovering(true);
        let successCount = 0;

        // 2. Scan and Verify PENDING items
        for (const doc of snap.docs) {
          const data = doc.data();
          
          // Tactical In-Memory Filter
          const gateway = data.gateway || 'FLUTTERWAVE';
          const isCrypto = gateway === 'NOWPAYMENTS' || doc.id.startsWith('CG-CRYPTO');

          if (data.status === "PENDING" && data.type === "DEPOSIT" && !isCrypto) {
            // Grace period: skip deposits less than 2 minutes old.
            const createdAt = data.createdAt?.toDate ? data.createdAt.toDate().getTime() : 0;
            const ageSeconds = (Date.now() - createdAt) / 1000;
            if (ageSeconds < 120) continue;

            const ref = doc.id;
            console.log(`[RecoveryHeartbeat] Attempting verification for stuck deposit: ${ref} (${gateway})`);
            
            // Flutterwave handles verification well with just the reference in recovery mode
            const result = await verifyFlutterwavePaymentAction(idToken, ref);
            
            if (result.success) {
              console.log(`[RecoveryHeartbeat] ✅ Successfully recovered deposit: ${ref}`);
              successCount++;
            } else if ((result as any).isAbandoned) {
              console.log(`[RecoveryHeartbeat] 👻 Cleaned up phantom deposit: ${ref}`);
              await refreshProfile(); 
            } else {
              console.warn(`[RecoveryHeartbeat] ⚠️ Verification failed for ${ref}:`, result.error);
            }
          }
        }

        if (successCount > 0) {
          setRecoveredCount(successCount);
          await refreshProfile();
          setTimeout(() => setRecoveredCount(0), 5000);
        }
      } catch (err) {
        console.error("[RecoveryHeartbeat] Failed:", err);
      } finally {
        setRecovering(false);
      }
    };

    // Run recovery on mount
    runRecovery();
    
    // Also run every 2 minutes while on this page
    const interval = setInterval(runRecovery, 120000);
    return () => clearInterval(interval);
  }, [user, refreshProfile]);

  if (recoveredCount > 0) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] bg-black border border-accent/30 rounded-[5px] p-4 shadow-[0_10px_40px_rgba(0,255,102,0.2)] animate-in slide-in-from-bottom-10 fade-in duration-500">
         <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-accent animate-bounce" />
            <div>
               <p className="text-[10px] font-black text-white uppercase tracking-widest">Payment Recovered</p>
               <p className="text-[9px] text-accent font-bold uppercase tracking-widest leading-tight">Confirmed & Balanced Credited</p>
            </div>
         </div>
      </div>
    );
  }

  if (recovering) {
    return (
      <div className="fixed bottom-6 right-6 z-[60] bg-black/50 backdrop-blur-md border border-white/10 rounded-full px-4 py-2 flex items-center gap-2 opacity-60">
         <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />
         <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest">Syncing Ledger...</span>
      </div>
    );
  }

  return null; // Headless
}
