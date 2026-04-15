export interface WithdrawalRequestResult {
  success: boolean;
  error?: string;
  ticketId?: string;
}

export async function requestWithdrawalAction(
  idToken: string,
  amountCoins: number,
  bankName: string,
  bankCode: string,
  accountNumber: string,
  legalName: string
): Promise<WithdrawalRequestResult> {
  const response = await fetch('/api/withdrawals', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${idToken}`
    },
    body: JSON.stringify({ amountCoins, bankName, bankCode, accountNumber, legalName }),
    cache: 'no-store'
  });

  const data = await response.json();
  return {
    success: Boolean(data.success),
    error: data.error,
    ticketId: data.ticketId
  };
}
