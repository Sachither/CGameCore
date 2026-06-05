const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'demo-cgame' });

async function checkRecentMatches() {
  const db = admin.firestore();
  // Fetch matches closed recently
  const matches = await db.collection('matches')
    .orderBy('resolvedAt', 'desc')
    .limit(3)
    .get();
  
  matches.forEach(doc => {
    const data = doc.data();
    console.log('Match:', doc.id);
    console.log('Format:', data.format);
    console.log('Status:', data.status);
    console.log('Round:', data.round);
    console.log('Circuit ID:', data.circuitId);
    console.log('Promo:', data.isPromo);
    console.log('Prize USD:', data.prizeUSD);
    console.log('Reward Amount:', data.rewardAmount);
    console.log('---');
  });
}

checkRecentMatches().catch(console.error);
