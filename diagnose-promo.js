
const admin = require('firebase-admin');

// Load .env.local manually
const fs = require('fs');
const dotenv = require('dotenv');
if (fs.existsSync('.env.local')) {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    })
  });
}
const db = admin.firestore();

async function diagnose() {
  console.log('--- DIAGNOSIS START ---');
  
  // 1. Get promo circuits (no index combo)
  const circuitsSnap = await db.collection('circuits')
    .where('isPromo', '==', true)
    .get();

  const sortedCircuits = circuitsSnap.docs
    .map(doc => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

  if (sortedCircuits.length === 0) {
    console.log('No promo circuits found.');
  } else {
    const circuit = sortedCircuits[0];
    const circuitId = circuit.id;
    console.log('Latest Circuit:', JSON.stringify({
      id: circuitId,
      status: circuit.status,
      matchesCompleted: circuit.matchesCompleted,
      matchesThisRound: circuit.matchesThisRound,
      roundWinnersCount: circuit.roundWinners?.length,
      winner: circuit.winner || circuit.winnerUid,
      totalPool: circuit.totalPool,
      createdAt: circuit.createdAt?.toDate ? circuit.createdAt.toDate() : circuit.createdAt
    }, null, 2));

    // 2. Get matches for this circuit
    const matchesSnap = await db.collection('matches')
      .where('circuitId', '==', circuitId)
      .get();
    
    console.log('Circuit Matches:');
    matchesSnap.docs.forEach(m => {
      const d = m.data();
      console.log(`- Match ${m.id}: Round=${d.round}, Status=${d.status}, Champion=${d.championUid}, isPromo=${d.isPromo}`);
    });

    // 3. Check for recent transactions
    const txsSnap = await db.collection('transactions')
      .where('category', '==', 'PROMO_PRIZE')
      .get();
    
    const sortedTxs = txsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 5);
    
    console.log('Recent Promo Prize Transactions:');
    sortedTxs.forEach(t => {
      console.log(`- Tx: User=${t.uid}, Amount=${t.amount}, Desc=${t.description}, Date=${t.createdAt?.toDate ? t.createdAt.toDate() : t.createdAt}`);
    });
  }
  
  console.log('--- DIAGNOSIS END ---');
}

diagnose().catch(err => {
  console.error('Diagnosis Failed:', err);
  process.exit(1);
});
