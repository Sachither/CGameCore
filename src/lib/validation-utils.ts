/**
 * Standard Operational Validation Utilities for CGameCore.
 * These regex and helpers ensure data integrity and security across the platform.
 */

export const REGEX = {
  // Username: Alphanumeric, underscores, 3-15 chars, no leading/trailing underscores
  USERNAME: /^[a-zA-Z0-9]([a-zA-Z0-9_]{1,13})[a-zA-Z0-9]$/,
  
  // Email: Standard RFC 5322 compliant regex
  EMAIL: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  
  // Phone: Nigerian format (Strictly 11 digits starting with 07, 08, or 09)
  PHONE: /^0[789]\d{9}$/,
  
  // Amount: Positive numbers, up to 2 decimal places (optional)
  AMOUNT: /^\d+(\.\d{1,2})?$/,
  
  // Account Number: Exactly 10 digits
  ACCOUNT_NUMBER: /^\d{10}$/,
};

/**
 * Sanitizes strings for Firestore and UI display.
 * Trims whitespace and removes potentially dangerous HTML-like tags.
 */
export function sanitize(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/<[^>]*>?/gm, "") // Strip HTML tags
    .slice(0, 1000); // Prevent overflow attacks
}

/**
 * Validates a value against a regex key and returns a descriptive error or null.
 */
export function validate(key: keyof typeof REGEX, value: string): string | null {
  const sanitized = value.trim();
  if (!sanitized) return "Field cannot be empty.";
  
  if (!REGEX[key].test(sanitized)) {
    switch (key) {
      case "USERNAME": return "Username must be 3-15 alphanumeric chars.";
      case "EMAIL": return "Please enter a valid email address.";
      case "PHONE": return "Invalid phone format. Use 081... or +234...";
      case "AMOUNT": return "Amount must be a positive number.";
      case "ACCOUNT_NUMBER": return "Account number must be 10 digits.";
      default: return "Invalid format.";
    }
  }
  return null;
}

/**
 * Checks if a tournament with the same format, entry fee, and game already exists in FILLING state
 * Returns the existing tournament ID if found, null otherwise
 */
export function checkDuplicateEntryFee(
  tournaments: any[],
  format: string,
  entryFee: number,
  game: string
): { id: string; playerCount: number; quota: number } | null {
  if (!tournaments || tournaments.length === 0) return null;
  
  const duplicate = tournaments.find((t) => 
    t.game === game &&
    (t.format === format || (format === 'tournament' && t.format === '16_TOURNAMENT')) &&
    t.challengeFee === entryFee &&
    (t.status === 'FILLING' || t.status === 'WAITING') &&
    !t.title?.includes('MASTER_CIRCUIT') // Skip old league data
  );
  
  if (duplicate && duplicate.playerCount < duplicate.quota) {
    return {
      id: duplicate.id,
      playerCount: duplicate.playerCount,
      quota: duplicate.quota
    };
  }
  
  return null;
}
