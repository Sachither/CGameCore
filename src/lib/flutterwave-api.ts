/**
 * Robust Flutterwave V3 API Integration with Retry Logic & SSL Error Recovery
 * 
 * Handles:
 * - Network timeouts
 * - SSL/TLS errors
 * - Rate limiting
 * - V3 Webhook ID verification
 */

const MAX_RETRIES = 3;
const INITIAL_TIMEOUT_MS = 10000; // 10 seconds
const BACKOFF_MULTIPLIER = 2;

interface FlutterwaveAPIResponse {
  status: string; // 'success' or 'error'
  message: string;
  data: any;
}

interface APICallResult {
  success: boolean;
  data?: FlutterwaveAPIResponse;
  error?: string;
  retriedCount?: number;
  isSSLError?: boolean;
}

/**
 * Make a robust API call to Flutterwave with retry logic
 */
export async function callFlutterwaveAPI(
  endpoint: string,
  secretKey: string,
  method: 'GET' | 'POST' = 'GET',
  body?: any,
  retryCount = 0
): Promise<APICallResult> {
  const timeoutMs = INITIAL_TIMEOUT_MS * Math.pow(BACKOFF_MULTIPLIER, retryCount);
  
  try {
    console.log(`[FlutterwaveAPI] Attempt ${retryCount + 1}/${MAX_RETRIES} to ${endpoint}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          'User-Agent': 'CGameCore/1.0 (Flutterwave-Processor)',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        if (response.status === 429 && retryCount < MAX_RETRIES) {
          const retryAfter = response.headers.get('Retry-After') || '5';
          console.warn(`[FlutterwaveAPI] Rate limited. Retrying after ${retryAfter}s...`);
          await new Promise(resolve => setTimeout(resolve, parseInt(retryAfter) * 1000));
          return callFlutterwaveAPI(endpoint, secretKey, method, body, retryCount + 1);
        }

        let errorData;
        try { errorData = await response.json(); } catch (e) {}
        const errorMessage = errorData?.message || response.statusText;
        throw new Error(`HTTP ${response.status}: ${errorMessage}`);
      }

      const data: FlutterwaveAPIResponse = await response.json();
      console.log(`[FlutterwaveAPI] ✓ Success on attempt ${retryCount + 1}: ${endpoint}`);

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
                        errorMessage.includes('ECONNRESET') ||
                        errorMessage.includes('ETIMEDOUT');

      console.error(`[FlutterwaveAPI] Network Error (Attempt ${retryCount + 1}):`, {
        error: errorMessage,
        isSSLError,
        endpoint,
      });

      if ((isSSLError || fetchError?.name === 'AbortError') && retryCount < MAX_RETRIES) {
        const waitMs = 1000 * Math.pow(BACKOFF_MULTIPLIER, retryCount);
        await new Promise(resolve => setTimeout(resolve, waitMs));
        return callFlutterwaveAPI(endpoint, secretKey, method, body, retryCount + 1);
      }

      return {
        success: false,
        error: errorMessage,
        isSSLError,
        retriedCount: retryCount,
      };
    }
  } catch (error: any) {
    console.error(`[FlutterwaveAPI] Unexpected error:`, error);
    return {
      success: false,
      error: error?.message || 'Unknown error',
      retriedCount: retryCount,
    };
  }
}

/**
 * Verify transaction via Flutterwave V3
 */
export async function verifyFlutterwaveTransaction(
  transactionId: string, // Flutterwave's internal ID
  secretKey: string
): Promise<{
  verified: boolean;
  data?: any;
  error?: string;
  networkFailed?: boolean;
}> {
  const result = await callFlutterwaveAPI(
    `https://api.flutterwave.com/v3/transactions/${transactionId}/verify`,
    secretKey,
    'GET'
  );

  if (result.success && result.data) {
    return {
      verified: result.data.status === 'success' && result.data.data?.status === 'successful',
      data: result.data.data,
    };
  }

  return {
    verified: false,
    error: result.error,
    networkFailed: result.isSSLError || result.retriedCount === MAX_RETRIES,
  };
}
