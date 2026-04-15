import { NextResponse } from 'next/server';
import { requestWithdrawalAction } from '@/app/actions/wallet-actions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amountCoins, bankName, bankCode, accountNumber, legalName } = body;

    const authHeader = req.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : body.idToken;

    if (!idToken) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing authentication token.' }, { status: 401 });
    }

    if (!amountCoins || !bankName || !bankCode || !accountNumber || !legalName) {
      return NextResponse.json({ success: false, error: 'Missing withdrawal request fields.' }, { status: 400 });
    }

    const numericCoins = Number(amountCoins);
    if (Number.isNaN(numericCoins)) {
      return NextResponse.json({ success: false, error: 'Invalid withdrawal amount.' }, { status: 400 });
    }

    const result = await requestWithdrawalAction(
      idToken,
      numericCoins,
      bankName,
      bankCode,
      accountNumber,
      legalName
    );

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Unable to submit withdrawal request.' }, { status: 500 });
  }
}
