/**
 * PHASE 2: CRYPTOGRAPHIC MATCH RECORDING
 * 
 * For high-value matches (> 1000 coins), records every game event
 * and creates a cryptographic hash tree of all events.
 * 
 * Enables detection of:
 * - Scores that didn't occur in actual gameplay
 * - Impossible event sequences
 * - Timestamp manipulations
 * - Replay attacks
 */

import { adminDb } from './firebase-admin';
import crypto from 'crypto';
import admin from 'firebase-admin';

/**
 * Represents a single game event (score, kill, action, etc.)
 */
export interface MatchEvent {
  timestamp: number;           // Milliseconds since game start
  playerId: string;            // Who took the action
  actionType: 'SCORE' | 'KILL' | 'DEATH' | 'TIMEOUT' | 'FORFEIT' | 'TECHNICAL' | string;
  data: {
    [key: string]: any;        // Action-specific data
  };
}

/**
 * Event recording with authentication
 */
export interface RecordedMatchEvent extends MatchEvent {
  eventId: string;             // Unique ID for this event
  eventHash: string;           // SHA256 of this event + previous hash (chain)
  previousHash: string;        // Hash of previous event (forms a chain)
  recordedAt: number;          // Server timestamp when recorded
  verified: boolean;           // Has this event been verified?
}

/**
 * Complete recording metadata
 */
export interface MatchRecording {
  matchId: string;
  playerId_A: string;
  playerId_B: string;
  recordingStart: number;      // Server timestamp when recording started
  recordingEnd?: number;       // Server timestamp when recording ended
  eventCount: number;          // Total events recorded
  finalHash: string;           // SHA256 hash of entire event stream
  finalScoreA: number;         // Final score for player A
  finalScoreB: number;         // Final score for player B
  status: 'RECORDING' | 'COMPLETED' | 'VERIFIED' | 'DISPUTED';
  verificationResult?: {
    isValid: boolean;
    reason?: string;
    scoredMatchedEvents: boolean;
    timestampsValid: boolean;
    eventsInconsistent: boolean;
  };
}

/**
 * Check if a match should be recorded (high-value matches)
 * Currently: matches with pool > 1000 coins
 */
export function shouldRecordMatch(challengeFee: number, format: string): boolean {
  // For 2-player: fee * 2 = total pool
  // For tournaments: depends on structure
  const totalPool = challengeFee * 2;
  const HIGH_VALUE_THRESHOLD = 1000; // coins

  return totalPool >= HIGH_VALUE_THRESHOLD;
}

/**
 * Initialize match recording collection
 * Call when match is created if it's high-value
 */
export async function initializeMatchRecording(
  matchId: string,
  playerA_uid: string,
  playerB_uid: string
): Promise<string> {
  const recordingRef = adminDb.collection('match_recordings').doc(matchId);

  const recording: MatchRecording = {
    matchId,
    playerId_A: playerA_uid,
    playerId_B: playerB_uid,
    recordingStart: Date.now(),
    eventCount: 0,
    finalHash: '',
    finalScoreA: 0,
    finalScoreB: 0,
    status: 'RECORDING'
  };

  await recordingRef.set(recording);
  return matchId;
}

/**
 * Record a single game event
 * Called by match service whenever something happens in the game
 * 
 * Flow on client:
 * 1. Score happens in game engine
 * 2. Send event to server via action
 * 3. Server records it here
 * 4. Event goes into chain (linked by hash)
 */
export async function recordMatchEvent(
  matchId: string,
  event: MatchEvent
): Promise<RecordedMatchEvent | null> {
  try {
    const eventsCollRef = adminDb
      .collection('match_recordings')
      .doc(matchId)
      .collection('events');

    // Get the last event to chain from
    const lastEventSnap = await eventsCollRef
      .orderBy('eventHash')
      .limitToLast(1)
      .get();

    const previousHash = lastEventSnap.empty
      ? ''
      : (lastEventSnap.docs[0].data() as RecordedMatchEvent).eventHash;

    // Create event hash (SHA256 of event + previous hash)
    const eventString = JSON.stringify(event) + previousHash;
    const eventHash = crypto
      .createHash('sha256')
      .update(eventString)
      .digest('hex');

    const recordedEvent: RecordedMatchEvent = {
      ...event,
      eventId: crypto.randomUUID(),
      eventHash,
      previousHash,
      recordedAt: Date.now(),
      verified: false
    };

    // Write event (append-only by design)
    const eventDocRef = eventsCollRef.doc();
    await eventDocRef.set(recordedEvent);

    // Update recording metadata
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);
    await recordingRef.update({
      eventCount: admin.firestore.FieldValue.increment(1),
      finalHash: eventHash // Update to latest in chain
    });

    return recordedEvent;
  } catch (error) {
    console.error('[MatchRecording] recordMatchEvent error:', error);
    return null;
  }
}

/**
 * Finalize recording when match ends
 * Compute final hash and seal recording
 */
export async function finalizeMatchRecording(
  matchId: string,
  finalScoreA: number,
  finalScoreB: number
): Promise<MatchRecording | null> {
  try {
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);

    await recordingRef.update({
      recordingEnd: Date.now(),
      finalScoreA,
      finalScoreB,
      status: 'COMPLETED'
    });

    const snapshot = await recordingRef.get();
    return snapshot.data() as MatchRecording;
  } catch (error) {
    console.error('[MatchRecording] finalizeMatchRecording error:', error);
    return null;
  }
}

/**
 * Verify a match recording - check if event stream is valid and scores are accurate
 * 
 * Returns:
 * - isValid: All events valid, hash chain intact, scores match
 * - reason: Human-readable why it failed (if failed)
 * - scoredMatchedEvents: Final scores match the SCORE-type events
 * - timestampsValid: All timestamps in order
 * - eventsInconsistent: No impossible sequences detected
 */
export async function verifyMatchRecording(
  matchId: string
): Promise<MatchRecording> {
  try {
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);
    const recordingSnap = await recordingRef.get();

    if (!recordingSnap.exists) {
      throw new Error('Recording not found');
    }

    const recording = recordingSnap.data() as MatchRecording;
    const eventsCollRef = recordingRef.collection('events');
    const eventsSnap = await eventsCollRef.orderBy('recordedAt').get();

    let currentHash = '';
    let scoreA = 0;
    let scoreB = 0;
    let lastTimestamp = 0;
    let eventsInconsistent = false;

    // Verify hash chain
    for (const eventDoc of eventsSnap.docs) {
      const event = eventDoc.data() as RecordedMatchEvent;

      // Check hash chain
      if (event.previousHash !== currentHash) {
        console.warn(
          `[MatchRecording] Hash chain broken at event ${event.eventId}. Expected ${currentHash.substring(
            0,
            8
          )}, got ${event.previousHash.substring(0, 8)}`
        );
        eventsInconsistent = true;
      }

      // Check timestamps are in order
      if (event.timestamp < lastTimestamp) {
        console.warn(
          `[MatchRecording] Timestamp out of order: ${event.timestamp} < ${lastTimestamp}`
        );
        eventsInconsistent = true;
      }
      lastTimestamp = event.timestamp;

      // Count scores for verification
      if (event.actionType === 'SCORE') {
        if (event.playerId === recording.playerId_A) {
          scoreA += event.data.points || 1;
        } else if (event.playerId === recording.playerId_B) {
          scoreB += event.data.points || 1;
        }
      }

      // Compute next hash
      const eventString = JSON.stringify({
        timestamp: event.timestamp,
        playerId: event.playerId,
        actionType: event.actionType,
        data: event.data
      }) + currentHash;
      currentHash = crypto
        .createHash('sha256')
        .update(eventString)
        .digest('hex');
    }

    // Check if recorded scores match event stream scores
    const scoreMatches =
      scoreA === recording.finalScoreA && scoreB === recording.finalScoreB;

    const verificationResult = {
      isValid: !eventsInconsistent && scoreMatches && currentHash === recording.finalHash,
      reason:
        !scoreMatches
          ? `Score mismatch: events=${scoreA}-${scoreB}, recorded=${recording.finalScoreA}-${recording.finalScoreB}`
          : currentHash !== recording.finalHash
            ? `Final hash mismatch`
            : eventsInconsistent
              ? `Events inconsistent (timestamps or hash chain)`
              : 'Valid recording',
      scoredMatchedEvents: scoreMatches,
      timestampsValid: !eventsInconsistent,
      eventsInconsistent
    };

    // Update recording with verification result
    await recordingRef.update({
      status: verificationResult.isValid ? 'VERIFIED' : 'DISPUTED',
      verificationResult
    });

    return {
      ...recording,
      status: verificationResult.isValid ? 'VERIFIED' : 'DISPUTED',
      verificationResult
    };
  } catch (error) {
    console.error('[MatchRecording] verifyMatchRecording error:', error);
    throw error;
  }
}

/**
 * Get all events for a match (for replay/audit)
 */
export async function getMatchEvents(
  matchId: string
): Promise<RecordedMatchEvent[]> {
  try {
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);
    const eventsSnap = await recordingRef
      .collection('events')
      .orderBy('recordedAt')
      .get();

    return eventsSnap.docs.map((doc) => doc.data() as RecordedMatchEvent);
  } catch (error) {
    console.error('[MatchRecording] getMatchEvents error:', error);
    return [];
  }
}

/**
 * Export match recording for dispute investigation
 * Includes full event stream and hash chain for cryptographic verification
 */
export async function exportMatchRecordingForAudit(
  matchId: string
): Promise<{
  recording: MatchRecording;
  events: RecordedMatchEvent[];
  hashChainValid: boolean;
} | null> {
  try {
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);
    const recordingSnap = await recordingRef.get();

    if (!recordingSnap.exists) return null;

    const recording = recordingSnap.data() as MatchRecording;
    const events = await getMatchEvents(matchId);

    // Verify hash chain one more time for export
    let currentHash = '';
    let hashChainValid = true;

    for (const event of events) {
      if (event.previousHash !== currentHash) {
        hashChainValid = false;
        break;
      }

      const eventString = JSON.stringify({
        timestamp: event.timestamp,
        playerId: event.playerId,
        actionType: event.actionType,
        data: event.data
      }) + currentHash;
      currentHash = crypto
        .createHash('sha256')
        .update(eventString)
        .digest('hex');
    }

    return {
      recording,
      events,
      hashChainValid
    };
  } catch (error) {
    console.error('[MatchRecording] exportMatchRecordingForAudit error:', error);
    return null;
  }
}

/**
 * Delete recording after dispute resolution or manual deletion request
 * (Immutable in Firestore rules, so this logs deletion intention for audit)
 */
export async function markRecordingForDeletion(
  matchId: string,
  reason: string
): Promise<boolean> {
  try {
    const recordingRef = adminDb.collection('match_recordings').doc(matchId);

    // Mark as deleted, don't actually delete (keep for audit trail)
    await recordingRef.update({
      status: 'DISPUTED',
      deletionRequestedAt: Date.now(),
      deletionReason: reason,
      deletedBy: 'manual'
    });

    return true;
  } catch (error) {
    console.error('[MatchRecording] markRecordingForDeletion error:', error);
    return false;
  }
}
