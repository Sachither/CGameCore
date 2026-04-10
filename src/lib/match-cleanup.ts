import { adminDb } from "@/lib/firebase-admin";

/**
 * INTERNAL HELPER: Purges chat messages from a match
 * Preserves the match document itself for match history/rankings
 */
export async function purgeMatchMessagesOnly(matchId: string) {
  try {
    const matchRef = adminDb.collection("matches").doc(matchId);
    
    // Delete all messages in sub-collection
    const messagesSnap = await matchRef.collection("messages").get();
    const batch = adminDb.batch();
    messagesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    console.log(`[Cleanup] Match ${matchId} messages have been purged. Match document preserved for history.`);
    return true;
  } catch (error) {
    console.error(`[Cleanup] Failed to purge messages for match ${matchId}:`, error);
    return false;
  }
}

/**
 * INTERNAL HELPER: The Nuke Protocol
 * Eradicates ALL match data including the document itself.
 * ONLY use for empty/abandoned lobbies, NOT for completed matches.
 */
export async function purgeMatchDataInternal(matchId: string) {
  try {
    const matchRef = adminDb.collection("matches").doc(matchId);
    
    // 1. Delete all messages in sub-collection
    const messagesSnap = await matchRef.collection("messages").get();
    const batch = adminDb.batch();
    messagesSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 2. Delete the match itself
    batch.delete(matchRef);
    
    await batch.commit();
    console.log(`[Nuke Protocol] Match ${matchId} and its messages have been eradicated.`);
    return true;
  } catch (error) {
    console.error(`[Nuke Protocol] Failed to purge match ${matchId}:`, error);
    return false;
  }
}
