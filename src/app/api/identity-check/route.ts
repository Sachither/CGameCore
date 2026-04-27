import { adminDb } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const field = url.searchParams.get("field");
  const value = url.searchParams.get("value");

  console.log(`[IdentityCheck API] Received request for ${field}: "${value}"`);

  if (!field || !value) {
    console.log(`[IdentityCheck] Missing field or value`);
    return NextResponse.json({ success: false, error: "Missing field or value." }, { status: 400 });
  }

  if (field === "referralCode") {
    const normalized = value.trim().toUpperCase();
    const query = await adminDb.collection("users")
      .where("myReferralCode", "==", normalized)
      .limit(1)
      .get();
    
    if (query.empty) {
      console.log(`[IdentityCheck] No partner found for code: "${normalized}"`);
      return NextResponse.json({ success: true, exists: false });
    } else {
      const partnerData = query.docs[0].data();
      console.log(`[IdentityCheck] MATCH FOUND: Partner "${partnerData.username}" (UID: ${query.docs[0].id}) for code: "${normalized}"`);
      return NextResponse.json({ 
        success: true, 
        exists: true, 
        uid: query.docs[0].id,
        username: partnerData.username
      });
    }
  }

  if (field !== "username" && field !== "phone") {
    console.log(`[IdentityCheck] Invalid field: ${field}`);
    return NextResponse.json({ success: false, error: "Invalid field." }, { status: 400 });
  }

  const normalized = field === "username"
    ? value.toLowerCase()
    : value.replace(/[^0-9]/g, "");

  console.log(`[IdentityCheck] Normalized ${field} to: "${normalized}"`);

  const collectionName = field === "username" ? "usernames" : "phones";
  const docRef = adminDb.collection(collectionName).doc(normalized);
  const docSnap = await docRef.get();

  const available = !docSnap.exists;
  console.log(`[IdentityCheck] ${field} "${normalized}" available: ${available}`);

  return NextResponse.json({
    success: true,
    field,
    value: normalized,
    available
  });
}
