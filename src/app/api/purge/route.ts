import { adminDb } from "@/lib/firebase-admin";
import { getVerifiedAdminUid } from "@/lib/server-utils";
import { cleanupExpiredBadges } from "@/lib/cleanup-utils";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  try {
    // 🔒 [SECURITY] Require admin authentication
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.error("🚨 UNAUTHORIZED PURGE ATTEMPT: No bearer token");
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const idToken = authHeader.split('Bearer ')[1];
    const adminUid = await getVerifiedAdminUid(idToken, true);
    console.log(`✅ Admin purge initiated by ${adminUid}`);
    
    const mSnap = await adminDb.collection("matches").get();
    for (const doc of mSnap.docs) {
      await doc.ref.delete();
      console.log(`Deleted Match: ${doc.id}`);
    }
    
    const cSnap = await adminDb.collection("circuits").get();
    for (const doc of cSnap.docs) {
      await doc.ref.delete();
      console.log(`Deleted Circuit: ${doc.id}`);
    }
    
    // 3. Clear expired champion badges
    const badgesCleared = await cleanupExpiredBadges();
    console.log(`✅ Cleared ${badgesCleared} expired champion badges`);
    
    return NextResponse.json({ success: true, message: "Purge complete." });
  } catch (error: any) {
    console.error("API Purge Failed:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
