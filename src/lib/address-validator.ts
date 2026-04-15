/**
 * NUBAN Checksum Algorithm for Nigerian Banks
 * Algorithm:
 * 1. Let BankCode be the 3-digit code
 * 2. Let Account be the first 9 digits of the account number
 * 3. Multiply each digit by a weight: [3, 7, 3, 3, 7, 3, 3, 7, 3, 3, 7, 3]
 * 4. Sum % 10. Checkdigit = 10 - sum. If 10, then 0.
 * 5. Checkdigit must match Account[9].
 */
export function validateNuban(accountNumber: string, bankCode: string): boolean {
  // Simplified: All Nigerian Bank accounts must be 10 digits.
  // We've removed the strict checksum check to allow fintechs like OPay.
  return accountNumber.length === 10 && /^\d+$/.test(accountNumber);
}

// Network-specific crypto address validators
const cryptoValidators: Record<string, { validate: (addr: string) => boolean; format: string }> = {
  'USDC_SOL': {
    validate: (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr),
    format: 'Base58 Solana address (32-44 chars)'
  },
  'USDT_SOL': {
    validate: (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr),
    format: 'Base58 Solana address (32-44 chars)'
  },
  'SOL': {
    validate: (addr) => /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr),
    format: 'Base58 Solana address (32-44 chars)'
  },
  'LTC': {
    validate: (addr) => /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{39,59}$/.test(addr),
    format: 'Start with L, M, 3, or ltc1 (Litecoin Network)'
  },
  'USDT_TRC20': {
    validate: (addr) => /^T[a-zA-Z0-9]{33}$/.test(addr),
    format: 'Start with "T" (Tron Network)'
  },
  'USDT_POLYGON': {
    validate: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    format: 'Start with "0x" + 40 hex characters (42 total)'
  },
  'USDT_ETH': {
    validate: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    format: 'Start with "0x" + 40 hex characters (42 total)'
  },
  'BTC': {
    validate: (addr) => /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/.test(addr),
    format: 'Start with 1/3/bc1 + 25-62 alphanumeric chars'
  },
  'ETH': {
    validate: (addr) => /^0x[a-fA-F0-9]{40}$/.test(addr),
    format: 'Start with "0x" + 40 hex characters (42 total)'
  }
};

/**
 * Validates crypto address based on network type
 * @param address - The wallet address to validate
 * @param network - The crypto network (e.g., 'USDT_TRC20', 'USDC_SOL')
 * @returns { isValid: boolean, format: string }
 */
export function validateCryptoAddressByNetwork(address: string, network: string): { isValid: boolean; format: string } {
  if (!address) return { isValid: false, format: cryptoValidators[network]?.format || 'Invalid network' };
  
  const validator = cryptoValidators[network];
  if (!validator) return { isValid: false, format: 'Network not supported' };
  
  return {
    isValid: validator.validate(address),
    format: validator.format
  };
}

export function validateCryptoAddress(address: string, type: 'TRC20' | 'SOL'): boolean {
  if (!address) return false;
  
  if (type === 'TRC20') {
    // USDT TRC20: Starts with T, 34 chars, alphanumeric
    return /^T[a-zA-Z0-9]{33}$/.test(address);
  }
  
  if (type === 'SOL') {
    // Solana: Base58, 32-44 chars
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }
  
  return false;
}
