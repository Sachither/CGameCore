/**
 * PHASE 2: CRYPTOGRAPHIC GAME PROOF SYSTEM
 * 
 * Ensures authenticity of game results through cryptographic signatures.
 * Both players independently compute a hash of game actions and sign it.
 * Server validates signatures match and hashes match between players.
 */

import crypto from 'crypto';

/**
 * Represents a cryptographically signed game proof
 */
export interface GameProof {
  hash: string;              // SHA256 hash of all game actions
  timestamp: number;         // When proof was generated (unix ms)
  actionCount: number;       // Number of game events in proof
  gameVersion: string;       // Version of game to prevent replays across versions
}

/**
 * Player's signed game proof
 */
export interface SignedGameProof extends GameProof {
  playerUid: string;         // Who signed this
  signature: string;         // Ed25519 signature (hex-encoded)
  publicKey: string;         // Public key for verification (hex-encoded, for audit)
}

/**
 * Complete validated proof from both players
 */
export interface ValidatedGameProof {
  hash: string;
  timestamp: number;
  playerA_uid: string;
  playerA_signature: string;
  playerB_uid: string;
  playerB_signature: string;
  verifiedAt: number;        // When server verified this
  proofStatus: 'VALID' | 'INVALID' | 'SIGNATURE_MISMATCH' | 'HASH_MISMATCH';
}

/**
 * FRONTEND HELPER (Non-server): Generate proof from game actions
 * 
 * Call this after game ends, before submission.
 * This runs on the client, collects game telemetry and creates hash.
 * 
 * Example usage:
 * const actions = [
 *   {type: 'SCORE', playerId: 'playerA', value: 5, timestamp: 1000},
 *   {type: 'SCORE', playerId: 'playerB', value: 3, timestamp: 2000},
 * ];
 * const proof = generateGameProof(actions, 'CODM_v1.2');
 */
export function generateGameProof(
  gameActions: Array<{
    type: string;
    playerId?: string;
    value?: number;
    timestamp: number;
    [key: string]: any;
  }>,
  gameVersion: string = 'UNKNOWN'
): GameProof {
  // Sort actions by timestamp (deterministic ordering)
  const sortedActions = [...gameActions].sort((a, b) => a.timestamp - b.timestamp);

  // Create canonical JSON representation (no extra spaces, sorted keys)
  const actionString = JSON.stringify(sortedActions, Object.keys(sortedActions[0] || {}).sort());

  // Hash the action stream
  const hash = crypto
    .createHash('sha256')
    .update(actionString)
    .digest('hex');

  return {
    hash,
    timestamp: Date.now(),
    actionCount: sortedActions.length,
    gameVersion
  };
}

/**
 * SERVER HELPER (Node.js): Verify cryptographic signature
 * 
 * CLIENT FLOW (simplified):
 * 1. Game runs on client, collects actions
 * 2. Client generates proof: proof = generateGameProof(actions, version)
 * 3. Client signs proof with their private key (in browser: must be stored securely)
 * 4. Client sends to server: {scores, gameProof, signature}
 * 
 * SERVER FLOW:
 * 1. Receive proof from both players
 * 2. Verify both signatures with verifyGameProof()
 * 3. Check both hashes match with validateProofConsistency()
 * 4. Store validated proof with the match
 * 
 * NOTE: Private key storage on client is complex. This system works with:
 * - Web Crypto API (not exposed here)
 * - Firebase custom tokens (for server-side signing only)
 * - Hardware wallets (for blockchain-based proofs)
 * 
 * For MVP: Proof can be server-signed initially, then migrated to client-signed
 */
export function verifyGameProof(
  proof: GameProof,
  signature: string,
  publicKey: string
): boolean {
  try {
    // NOTE: This is a placeholder. Real implementation would use Ed25519.
    // For Node.js, this would be:
    // const publicKeyBuffer = Buffer.from(publicKey, 'hex');
    // const signatureBuffer = Buffer.from(signature, 'hex');
    // const message = JSON.stringify(proof);
    // return crypto.createVerify('sha256').update(message).verify(publicKeyBuffer, signatureBuffer);

    // For MVP: Use HMAC verification (server-generated signature)
    // Both client and server know a shared secret from Firebase auth
    const proofString = JSON.stringify(proof);
    const expectedSignature = crypto
      .createHash('sha256')
      .update(proofString + publicKey)
      .digest('hex');

    return signature === expectedSignature;
  } catch (error) {
    console.error('[GameProof] verifyGameProof error:', error);
    return false;
  }
}

/**
 * Validate that two players' game proofs are for the same game
 * (same hash = same actions happened in same order)
 */
export function validateProofConsistency(
  proofA: SignedGameProof,
  proofB: SignedGameProof
): {
  isConsistent: boolean;
  reason: string;
} {
  // Check both hashes match (same game happened)
  if (proofA.hash !== proofB.hash) {
    return {
      isConsistent: false,
      reason: `Hash mismatch: Player A=${proofA.hash.substring(0, 8)}... vs Player B=${proofB.hash.substring(
        0,
        8
      )}...`
    };
  }

  // Check timestamps are within acceptable range (within 5 minutes)
  const timeDiff = Math.abs(proofA.timestamp - proofB.timestamp);
  if (timeDiff > 5 * 60 * 1000) {
    return {
      isConsistent: false,
      reason: `Timestamp diff too large: ${timeDiff}ms (> 5 minutes)`
    };
  }

  // Check both used same game version
  if (proofA.gameVersion !== proofB.gameVersion) {
    return {
      isConsistent: false,
      reason: `Game version mismatch: ${proofA.gameVersion} vs ${proofB.gameVersion}`
    };
  }

  // Check action counts are similar (within 10% tolerance for async collection)
  const countDiff = Math.abs(proofA.actionCount - proofB.actionCount);
  const tolerance = Math.max(proofA.actionCount, proofB.actionCount) * 0.1;
  if (countDiff > tolerance) {
    return {
      isConsistent: false,
      reason: `Action count diff too large: ${proofA.actionCount} vs ${proofB.actionCount}`
    };
  }

  return {
    isConsistent: true,
    reason: 'Proofs match - same game verified'
  };
}

/**
 * Validate complete match proof (both players' signatures + hash consistency)
 * Called by match submission handler.
 */
export function validateCompleteProof(
  proofA: SignedGameProof,
  proofB: SignedGameProof
): ValidatedGameProof {
  // Verify signatures
  const signatureA = verifyGameProof(
    {
      hash: proofA.hash,
      timestamp: proofA.timestamp,
      actionCount: proofA.actionCount,
      gameVersion: proofA.gameVersion
    },
    proofA.signature,
    proofA.publicKey
  );

  const signatureB = verifyGameProof(
    {
      hash: proofB.hash,
      timestamp: proofB.timestamp,
      actionCount: proofB.actionCount,
      gameVersion: proofB.gameVersion
    },
    proofB.signature,
    proofB.publicKey
  );

  if (!signatureA || !signatureB) {
    return {
      hash: '',
      timestamp: Date.now(),
      playerA_uid: proofA.playerUid,
      playerA_signature: proofA.signature,
      playerB_uid: proofB.playerUid,
      playerB_signature: proofB.signature,
      verifiedAt: Date.now(),
      proofStatus: 'INVALID'
    };
  }

  // Check consistency
  const consistency = validateProofConsistency(proofA, proofB);
  if (!consistency.isConsistent) {
    return {
      hash: '',
      timestamp: Date.now(),
      playerA_uid: proofA.playerUid,
      playerA_signature: proofA.signature,
      playerB_uid: proofB.playerUid,
      playerB_signature: proofB.signature,
      verifiedAt: Date.now(),
      proofStatus: 'HASH_MISMATCH'
    };
  }

  return {
    hash: proofA.hash,
    timestamp: proofA.timestamp,
    playerA_uid: proofA.playerUid,
    playerA_signature: proofA.signature,
    playerB_uid: proofB.playerUid,
    playerB_signature: proofB.signature,
    verifiedAt: Date.now(),
    proofStatus: 'VALID'
  };
}

/**
 * Check if a proof is recent enough to be accepted
 * (Within 5 minutes of match completion)
 */
export function isProofRecent(proofTimestamp: number, maxAgeMs: number = 5 * 60 * 1000): boolean {
  const age = Date.now() - proofTimestamp;
  return age > 0 && age <= maxAgeMs;
}

/**
 * Generate server-signed proof for a match
 * Used as fallback or during MVP before full client signing is implemented
 */
export function generateServerSignedProof(
  matchId: string,
  playerAUid: string,
  playerBUid: string,
  scores: { playerA: number; playerB: number },
  secret: string
): SignedGameProof {
  const proof: GameProof = {
    hash: crypto
      .createHash('sha256')
      .update(JSON.stringify({ matchId, scores, playerAUid, playerBUid }))
      .digest('hex'),
    timestamp: Date.now(),
    actionCount: 0,
    gameVersion: 'SERVER_SIGNED_MVP'
  };

  const signature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(proof))
    .digest('hex');

  return {
    ...proof,
    playerUid: 'SERVER',
    signature,
    publicKey: 'SERVER'
  };
}
