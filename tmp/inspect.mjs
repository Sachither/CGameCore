import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
initializeApp({ projectId: 'cgame-dev' });
const db = getFirestore();

async function run() {
   const snap = await db.collection('circuits').get();
   snap.docs.forEach(d => {
      console.log('--- CIRCUIT:', d.id);
      console.log('STATUS:', d.data().status);
      console.log('FORMAT:', d.data().format);
      console.log('COMPLETED:', d.data().matchesCompleted);
   });

   const mSnap = await db.collection('matches').get();
   mSnap.docs.forEach((d, i) => {
      const data = d.data();
      if ((data.status !== 'COMPLETED' && data.status !== 'CLOSED') || data.round) {
         console.log('MATCH:', d.id, 'ROUND:', data.round, 'LEG:', data.leg, 'STATUS:', data.status, 'P1_READY:', Object.values(data.players || {})[0]?.ready);
      }
   });
   
   console.log("DONE");
   process.exit(0);
}
run().catch(e => { console.error(e); process.exit(1); });
