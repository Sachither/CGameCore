const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: 'cgamecore' // Replace with your project ID
  });
}

const db = admin.firestore();

async function cleanupDuplicatePlayers() {
  console.log('Starting cleanup of duplicate players in tournament brackets...');

  try {
    const circuitsSnapshot = await db.collection('circuits').where('format', '==', '16_TOURNAMENT').get();

    for (const circuitDoc of circuitsSnapshot.docs) {
      const circuitId = circuitDoc.id;
      const circuitData = circuitDoc.data();
      const playerIds = circuitData.playerIds || [];

      // Check for duplicate UIDs in circuit
      const uniquePlayerIds = [...new Set(playerIds)];
      if (uniquePlayerIds.length !== playerIds.length) {
        console.log(`Circuit ${circuitId} has duplicate playerIds:`, playerIds);
        console.log('Unique:', uniquePlayerIds);

        // Get all matches in this circuit
        const matchesSnapshot = await db.collection('matches').where('circuitId', '==', circuitId).get();
        const matches = matchesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Collect all playerIds from matches
        const matchPlayerIds = new Set();
        const duplicateInMatches = [];
        matches.forEach(match => {
          match.playerIds.forEach(pid => {
            if (matchPlayerIds.has(pid)) {
              duplicateInMatches.push(pid);
            }
            matchPlayerIds.add(pid);
          });
        });

        console.log(`Circuit ${circuitId} matches have duplicates:`, duplicateInMatches);

        // For now, just log. To fix, we could delete extra matches or reassign.
        // Example: Remove matches that have duplicate players
        // But this is dangerous, so manual intervention recommended.

        console.log(`Manual fix needed for circuit ${circuitId}`);
      }
    }

    console.log('Cleanup scan complete.');
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run the cleanup
cleanupDuplicatePlayers().then(() => process.exit(0));