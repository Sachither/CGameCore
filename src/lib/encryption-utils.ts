// Server-side encryption utility for sensitive data
import CryptoJS from 'crypto-js';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error('ENCRYPTION_KEY is required in server environment variables.');
}

const ENCRYPTION_KEY_VALUE: string = ENCRYPTION_KEY;

export function encryptData(data: string): string {
  return CryptoJS.AES.encrypt(data, ENCRYPTION_KEY_VALUE).toString();
}

export function decryptData(encryptedData: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedData, ENCRYPTION_KEY_VALUE);
  return bytes.toString(CryptoJS.enc.Utf8);
}

// For tokenized storage: hash sensitive data and store only last 4 chars
export function tokenizeSensitiveData(data: string): { hash: string; last4: string } {
  const hash = CryptoJS.SHA256(data).toString();
  const last4 = data.slice(-4);
  return { hash, last4 };
}