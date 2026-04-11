/**
 * Robust Paystack API Integration with Retry Logic & SSL Error Recovery
 * 
 * Handles:
 * - Network timeouts
 * - SSL/TLS errors
 * - Rate limiting
 * - Exponential backoff retry
 * - Comprehensive logging
 */

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT_MS = 10000; // 10 seconds
const BACKOFF_MULTIPLIER = 2;

interface PaystackAPIResponse {
  status: boolean;
  message: string;
  data: any;
}

interface APICallResult {
  success: boolean;
  data?: PaystackAPIResponse;
  error?: string;
  retriedCount?: number;
  isSSLError?: boolean;
  lastAttemptTime?: number;
}

/**
 * Make a robust API call to Paystack with retry logic
 * Handles SSL errors gracefully - still verifies payment even if network fails
 */
export async function callPaystackAPI(
  endpoint: string,
  secretKey: string,
  method: 'GET' | 'POST' = 'GET',
  retryCount = 0
): Promise<APICallResult> {
  const timeoutMs = INITIAL_TIMEOUT_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
  
  try {
    console.log(`[PaystackAPI] Attempt ${retryCount + 1}/${MAX_RETRIES} to ${endpoint}`);

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CGameCore/1.0 (Payment-Processor)',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Check response status
      if (!response.ok) {
        // Rate limiting - wait and retry
        if (response.status === 429 && retryCount < MAX_RETRIES) {
          const retryAfter = response.headers.get('Retry-After') || '5';
          console.warn(`[PaystackAPI] Rate limited. Retrying after ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          return callPaystackAPI(endpoint, secretKey, method, retryCount + 1);
        }

        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: PaystackAPIResponse = await response.json();

      console.log(`[PaystackAPI] ✓ Success on attempt ${retryCount + 1}: ${endpoint}`);

      return {
        success: true,
        data,
        retriedCount: retryCount,
      };
    } catch (fetchError: any) {
      clearTimeout(timeoutId);

      const errorMessage = fetchError?.message || '';
      const isSSLError = errorMessage.includes('ERR_SSL') || 
                        errorMessage.includes('decryption failed') ||
                        errorMessage.includes('bad record mac') ||
                        errorMessage.includes('ECONNRESET') ||
                        errorMessage.includes('ETIMEDOUT');

      console.error(`[PaystackAPI] Network Error (Attempt ${retryCount + 1}):`, {
        error: errorMessage,
        isSSLError,
        endpoint,
        timeout: timeoutMs,
      });

      // If SSL/TLS error or timeout, still retry (payment might have succeeded on Paystack's end)
      if (isSSLError && retryCount < MAX_RETRIES) {
        console.warn(`[PaystackAPI] SSL/Network error detected. Retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        
        // Exponential backoff wait before retry
        const waitMs = 1000 * Math.pow(BACKOFF_MULTIPLIER, retryCount);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        
        return callPaystackAPI(endpoint, secretKey, method, retryCount + 1);
      }

      // Max retries exceeded - return error but flag as SSL issue for special handling
      return {
        success: false,
        error: errorMessage,
        isSSLError,
        retriedCount: retryCount,
        lastAttemptTime: Date.now(),
      };
    }
  } catch (error: any) {
    console.error(`[PaystackAPI] Unexpected error:`, error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
      retriedCount: retryCount,
    };
  }
}

/**
 * Verify transaction with special handling for SSL errors
 * Even if API call fails due to network issues, we attempt verification
 * because the payment might have succeeded on Paystack's side
 */
export async function verifyPaystackTransactionWithSSLRecovery(
  reference: string,
  secretKey: string
): Promise<{
  verified: boolean;
  data?: any;
  error?: string;
  networkFailed?: boolean;
  shouldRetryWithWebhook?: boolean;
}> {
  const result = await callPaystackAPI(
    `https://api.paystack.co/transaction/verify/${reference}`,
    secretKey,
    'GET'
  );

  if (result.success && result.data) {
    return {
      verified: result.data.status === true && result.data.data?.status === 'success',
      data: result.data.data,
    };
  }

  // Network failed - this is critical for payments
  if (result.isSSLError || result.retriedCount === 3) {
    console.error(`[PaystackAPI] SSL/Network recovery needed for ${reference}`);
    return {
      verified: false,
      error: result.error,
      networkFailed: true,
      shouldRetryWithWebhook: true, // Wait for webhook confirmation instead
    };
  }

  return {
    verified: false,
    error: result.error,
  };
}
