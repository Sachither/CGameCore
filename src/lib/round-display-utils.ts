/**
 * Get friendly display name for tournament rounds with promo bracket size awareness
 */
export function getRoundDisplayName(round: string, playerCount?: number, isPromo?: boolean): string {
  // Standard tournament rounds
  if (round === 'R32') return 'Round of 32';
  if (round === 'R16') return 'Round of 16';
  if (round === 'QR1') return 'Round of 16 (Part 1)';
  if (round === 'QR2') return 'Round of 16 (Part 2)';
  if (round === 'QF') return 'Quarter Finals';
  if (round === 'SF') return 'Semi Finals';
  if (round === 'FINAL') return 'Grand Final';

  // Promo-specific rounds with bracket size labels
  if (isPromo) {
    if (round === 'QR1') {
      if (playerCount === 32) return 'Round of 32 (32-Player)';
      if (playerCount === 64) return 'Round of 64 (64-Player)';
      if (playerCount === 128) return 'Round of 128 (128-Player)';
      return 'Qualifier Round 1';
    }
    if (round === 'QR2') {
      if (playerCount === 32) return 'Round of 16 (32-Player)';
      if (playerCount === 64) return 'Round of 32 (64-Player)';
      if (playerCount === 128) return 'Round of 64 (128-Player)';
      return 'Qualifier Round 2';
    }
    if (round === 'QR3') {
      if (playerCount === 64) return 'Round of 16 (64-Player)';
      if (playerCount === 128) return 'Round of 32 (128-Player)';
      return 'Qualifier Round 3';
    }
    if (round === 'QR4') {
      if (playerCount === 128) return 'Round of 16 (128-Player)';
      return 'Qualifier Round 4';
    }
    if (round === 'QF') return 'Quarter Finals';
    if (round === 'SF') return 'Semi Finals';
    if (round === 'FINAL') return 'Grand Final';
  }

  return round;
}

/**
 * Get bracket size label for promo tournaments
 */
export function getPromoBracketLabel(playerCount?: number): string {
  if (!playerCount) return '';
  if (playerCount === 32) return '32-Player Bracket';
  if (playerCount === 64) return '64-Player Bracket';
  if (playerCount === 128) return '128-Player Bracket';
  return `${playerCount}-Player Bracket`;
}
