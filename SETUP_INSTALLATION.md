# CGameCore Installation Guide

Complete step-by-step guide for setting up CGameCore on your local machine or server.

## Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn package manager
- Git
- PostgreSQL or access to Neon database
- Firebase project setup
- Payment gateway accounts (optional for development)

## Installation Steps

### 1. Clone Repository

```bash
git clone https://github.com/Sachither/CGameCore.git
cd CGameCore
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

This installs all required packages including:
- Next.js 16.2.1 (Turbopack)
- React 19.2.4
- TypeScript 5
- Tailwind CSS 4
- Firebase 12.11.0
- Drizzle ORM
- And all other dependencies

### 3. Set Up Database

**Option A: Using Neon (Cloud PostgreSQL)**
1. Create account at https://neon.tech
2. Create a new project and database
3. Copy connection string

**Option B: Local PostgreSQL**
```bash
# macOS (using Homebrew)
brew install postgresql@15
brew services start postgresql@15

# Windows (using PostgreSQL installer)
# Download from https://www.postgresql.org/download/windows/

# Create database
psql -U postgres -c "CREATE DATABASE cgamecore;"
```

### 4. Run Database Migrations

```bash
npm run db:push
```

This uses Drizzle ORM to create all necessary tables.

### 5. Configure Environment Variables

Create/update `.env.local` file in the root directory:

```
# ⚠️ IMPORTANT: Never commit real API keys to version control
# These are placeholders. Replace with your actual credentials from respective services.

# Encryption
ENCRYPTION_KEY=YOUR_ENCRYPTION_KEY_HERE
ALLOW_TEST_FINANCIALS=true

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=YOUR_FIREBASE_API_KEY
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=YOUR_FIREBASE_AUTH_DOMAIN
NEXT_PUBLIC_FIREBASE_PROJECT_ID=YOUR_PROJECT_ID
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=YOUR_STORAGE_BUCKET
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=YOUR_SENDER_ID
NEXT_PUBLIC_FIREBASE_APP_ID=YOUR_APP_ID

# Firebase Admin (Server-side)
FIREBASE_CLIENT_EMAIL=YOUR_FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY=YOUR_FIREBASE_PRIVATE_KEY

# Discord Webhooks (for notifications)
DISCORD_WEBHOOK_URL=YOUR_DISCORD_WEBHOOK_URL

# Paystack Payment Gateway
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=YOUR_PAYSTACK_PUBLIC_KEY
PAYSTACK_SECRET_KEY=YOUR_PAYSTACK_SECRET_KEY

# NowPayments (Crypto Gateway)
NOWPAYMENTS_API_KEY=YOUR_NOWPAYMENTS_API_KEY
NOWPAYMENTS_IPN_SECRET=YOUR_NOWPAYMENTS_IPN_SECRET

# Firebase Cloud Messaging
NEXT_PUBLIC_FIREBASE_VAPID_KEY=YOUR_FIREBASE_VAPID_KEY

# Flutterwave Payment Gateway
NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY=YOUR_FLUTTERWAVE_PUBLIC_KEY
FLUTTERWAVE_SECRET_KEY=YOUR_FLUTTERWAVE_SECRET_KEY
FLUTTERWAVE_ENCRYPTION_KEY=YOUR_FLUTTERWAVE_ENCRYPTION_KEY
FLUTTERWAVE_WEBHOOK_HASH=YOUR_FLUTTERWAVE_WEBHOOK_HASH

# Email Service (Resend)
RESEND_API_KEY=YOUR_RESEND_API_KEY

# Database Connection
DATABASE_URL=YOUR_DATABASE_URL

# Cloudflare R2 Storage
R2_ACCOUNT_ID=YOUR_R2_ACCOUNT_ID
R2_ACCESS_KEY=YOUR_R2_ACCESS_KEY
R2_BUCKET_NAME=YOUR_R2_BUCKET_NAME
R2_REGION=YOUR_R2_REGION
```

**Getting Your API Keys:**

- **Firebase**: https://console.firebase.google.com
  - Select your project > Project Settings > Service Accounts
  - Generate private key and copy credentials

- **Flutterwave**: https://dashboard.flutterwave.com
  - Go to Settings > API Keys
  - Copy Public and Secret keys

- **Paystack**: https://dashboard.paystack.com
  - Go to Settings > API Keys & Webhooks
  - Copy Public and Secret keys

- **NowPayments**: https://nowpayments.io
  - Account Settings > API Keys
  - Copy API Key and set IPN Secret

- **Resend**: https://resend.com
  - API Keys section
  - Copy your API key

- **Cloudflare R2**: https://dash.cloudflare.com
  - R2 Storage > API Tokens
  - Generate S3 API token

- **Neon Database**: https://console.neon.tech
  - Project > Connection string
  - Copy the full connection string

### 6. Run Development Server

```bash
npm run dev
```

Server runs on http://localhost:3000

### 7. Create Super Admin Account

```bash
npm run bootstrap:admin
```

Follow prompts to create initial admin account for dashboard access.

## Deployment

### Building for Production

```bash
npm run build
```

### Running in Production

```bash
npm start
```

### Environment Variables for Production

Update `.env.production` with production API keys and endpoints:
- Use production Firebase project
- Use production payment gateway keys
- Use production database URL
- Ensure proper error logging and monitoring

## Common Issues & Troubleshooting

### Issue: `ENCRYPTION_KEY not found`
**Solution:** Ensure `.env.local` exists and contains `ENCRYPTION_KEY`

### Issue: Database connection error
**Solution:** 
- Verify DATABASE_URL is correct
- Check PostgreSQL/Neon is running
- Run `npm run db:push` to sync schema

### Issue: Firebase authentication fails
**Solution:**
- Verify Firebase credentials in `.env.local`
- Check Firebase project is active
- Ensure CORS is configured in Firebase settings

### Issue: Port 3000 already in use
**Solution:**
```bash
npm run dev -- -p 3001
```

### Issue: TypeScript errors during build
**Solution:**
```bash
npm run type-check
```

### Issue: Payment gateway not working
**Solution:**
- For development: Ensure ALLOW_TEST_FINANCIALS=true
- For localhost: Admin payouts automatically simulate (no real transactions)
- Verify webhook URLs are accessible to payment providers

## Development Features

### Localhost-Only Features

**Admin Payout Simulation:**
When running on localhost (`NODE_ENV === 'development'`), admin payout execution:
- Bypasses real encryption (uses test account)
- Generates simulated transfer IDs (`FW_SIM_XXXXXX`)
- Updates Firestore normally (for UI testing)
- Sends notifications (for verification)
- **No real money is transferred**

This allows testing the withdrawal flow without executing actual payments.

### Testing Payment Gateways

**Flutterwave Test Mode:**
```
Public Key: FLWPUBK_TEST-*
Secret Key: FLWSECK_TEST-*
Card: 4239 4001 0000 0000
```

**Paystack Test Mode:**
```
Public Key: pk_test_*
Secret Key: sk_test_*
Card: 4084 0343 9673 8344
```

**NowPayments Test Mode:**
Use network testnets for crypto transactions.

## Scripts Reference

```bash
# Development
npm run dev              # Start dev server with hot reload
npm run type-check      # Check TypeScript errors

# Building
npm run build           # Build for production
npm run build:analyze   # Analyze bundle size

# Database
npm run db:push         # Sync database schema
npm run db:studio       # Open Drizzle Studio

# Admin
npm run bootstrap:admin # Create super admin account

# Deployment
npm start               # Run production server
npm run lint            # Check code quality
```

## Performance Optimization

- **Turbopack**: Next.js 16 uses Turbopack for 5-10x faster builds
- **Image Optimization**: Automatic image optimization via Next.js
- **Code Splitting**: Dynamic imports reduce initial bundle
- **Database Indexing**: Ensure Firestore indexes are created

## Security Best Practices

1. **Never commit `.env.local`** - Use `.env.example` instead
2. **Rotate API keys regularly** - Especially after deployment issues
3. **Enable Firebase Security Rules** - Protect Firestore data
4. **Use HTTPS in production** - Always use secure connections
5. **Validate all user inputs** - Prevent injection attacks
6. **Monitor admin actions** - Audit log all admin operations

## Support & Resources

- **Next.js Docs**: https://nextjs.org/docs
- **Firebase Docs**: https://firebase.google.com/docs
- **Tailwind CSS**: https://tailwindcss.com/docs
- **GitHub Issues**: https://github.com/Sachither/CGameCore/issues

## License

CGameCore © 2024. All rights reserved.
