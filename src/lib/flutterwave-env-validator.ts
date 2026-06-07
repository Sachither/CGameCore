/**
 * Flutterwave Environment Configuration Validator
 * 
 * Use this to diagnose configuration issues during setup.
 */

export interface FlutterwaveEnvStatus {
  isConfigured: boolean;
  secretKey: { configured: boolean; prefix?: string };
  webhookHash: { configured: boolean; prefix?: string };
  issues: string[];
  recommendations: string[];
}

/**
 * Check if Flutterwave environment is properly configured
 */
export function validateFlutterwaveEnv(): FlutterwaveEnvStatus {
  const issues: string[] = [];
  const recommendations: string[] = [];

  const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
  const webhookHash = process.env.FLUTTERWAVE_WEBHOOK_HASH;

  const secretConfigured = !!secretKey && secretKey.length > 0;
  const hashConfigured = !!webhookHash && webhookHash.length > 0;

  // Validate Secret Key
  if (!secretConfigured) {
    issues.push("FLUTTERWAVE_SECRET_KEY is missing");
    recommendations.push(
      "1. Go to https://dashboard.flutterwave.com/settings/security",
      "2. Copy your API Secret Key",
      "3. Set FLUTTERWAVE_SECRET_KEY in .env.local"
    );
  } else if (!secretKey.startsWith("FLWSECK_TEST") && !secretKey.startsWith("FLWSECK_LIVE")) {
    issues.push("FLUTTERWAVE_SECRET_KEY has unexpected format (should start with FLWSECK_TEST or FLWSECK_LIVE)");
  }

  // Validate Webhook Hash
  if (!hashConfigured) {
    issues.push("FLUTTERWAVE_WEBHOOK_HASH is missing");
    recommendations.push(
      "1. Go to https://dashboard.flutterwave.com/settings/webhooks",
      "2. Set Webhook URL to: https://yourdomain.com/api/webhooks/flutterwave",
      "3. Copy the Webhook Hash",
      "4. Set FLUTTERWAVE_WEBHOOK_HASH in .env.local",
      "5. Ensure your domain is publicly accessible (not localhost)",
      "6. Test with Flutterwave's webhook test tool"
    );
  } else if (webhookHash.length < 32) {
    issues.push("FLUTTERWAVE_WEBHOOK_HASH appears too short (typically 64+ characters)");
  }

  return {
    isConfigured: secretConfigured && hashConfigured && issues.length === 0,
    secretKey: {
      configured: secretConfigured,
      prefix: secretKey ? secretKey.substring(0, 12) + "..." : undefined
    },
    webhookHash: {
      configured: hashConfigured,
      prefix: webhookHash ? webhookHash.substring(0, 12) + "..." : undefined
    },
    issues,
    recommendations
  };
}

/**
 * Log Flutterwave environment status
 * Call this during app initialization to identify issues early
 */
export function logFlutterwaveStatus() {
  const status = validateFlutterwaveEnv();
  
  console.log("\n" + "=".repeat(60));
  console.log("🔌 FLUTTERWAVE ENVIRONMENT STATUS");
  console.log("=".repeat(60));
  
  console.log(`Secret Key:   ${status.secretKey.configured ? "✅ Configured (" + status.secretKey.prefix + ")" : "❌ Missing"}`);
  console.log(`Webhook Hash: ${status.webhookHash.configured ? "✅ Configured (" + status.webhookHash.prefix + ")" : "❌ Missing"}`);
  
  if (status.issues.length > 0) {
    console.log("\n⚠️  ISSUES DETECTED:");
    status.issues.forEach(issue => console.log(`  • ${issue}`));
  }
  
  if (status.recommendations.length > 0) {
    console.log("\n📋 SETUP STEPS:");
    status.recommendations.forEach(rec => console.log(`  ${rec}`));
  }
  
  if (status.isConfigured) {
    console.log("\n✅ All Flutterwave settings are configured correctly!");
  }
  
  console.log("=".repeat(60) + "\n");
}

/**
 * Check if webhooks will reach your server
 * This is a diagnostic helper
 */
export function getWebhookDiagnostics() {
  const diagnostics = {
    webhookUrl: process.env.NEXT_PUBLIC_APP_URL 
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/flutterwave`
      : "Unknown (set NEXT_PUBLIC_APP_URL)",
    isProduction: process.env.NODE_ENV === 'production',
    isLocalhost: !process.env.NEXT_PUBLIC_APP_URL || 
                 process.env.NEXT_PUBLIC_APP_URL.includes('localhost') ||
                 process.env.NEXT_PUBLIC_APP_URL.includes('127.0.0.1'),
  };

  return {
    ...diagnostics,
    canReceiveWebhooks: !diagnostics.isLocalhost,
    issues: diagnostics.isLocalhost 
      ? ["Webhook URL appears to be localhost - Flutterwave cannot reach it"]
      : []
  };
}
