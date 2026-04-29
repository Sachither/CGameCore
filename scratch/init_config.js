const admin = require("firebase-admin");
const dotenv = require("dotenv");
const path = require("path");

// Load env vars
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    })
  });
}

const db = admin.firestore();

async function initConfig() {
  const configRef = db.collection("system").doc("config");
  await configRef.set({
    matchFeePercentage: 0.10,
    partnerCommissionShare: 0.50,
    withdrawalFiatFee: 10,
    referralCommissionShare: 0.50,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  console.log("System configuration initialized to 10% fee.");
}

initConfig().catch(console.error);
