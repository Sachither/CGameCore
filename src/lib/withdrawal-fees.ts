export const DEFAULT_FIAT_WITHDRAWAL_FEE = 10;

export const WITHDRAWAL_CRYPTO_FEE_MAP: Record<string, number> = {
  'USDT_SOL': 10,
  'USDC_SOL': 10,
  'SOL': 10,
  'LTC': 10
};

export const SUPPORTED_CRYPTO_NETWORKS = new Set(Object.keys(WITHDRAWAL_CRYPTO_FEE_MAP));

export function isCryptoWithdrawalNetwork(bankCode: string): boolean {
  return SUPPORTED_CRYPTO_NETWORKS.has(bankCode);
}

export function getWithdrawalFee(bankCode: string): number {
  if (!bankCode) return DEFAULT_FIAT_WITHDRAWAL_FEE;
  return WITHDRAWAL_CRYPTO_FEE_MAP[bankCode] ?? DEFAULT_FIAT_WITHDRAWAL_FEE;
}

export function getCryptoFeeComment(bankCode: string): string {
  if (!isCryptoWithdrawalNetwork(bankCode)) return `Fiat transfer fee ${DEFAULT_FIAT_WITHDRAWAL_FEE} Coins`;
  return `${WITHDRAWAL_CRYPTO_FEE_MAP[bankCode]} Coin network fee`;
}
