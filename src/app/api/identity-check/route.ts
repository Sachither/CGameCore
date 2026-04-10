import { adminDb } from "@/lib/firebase-admin";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const field = url.searchParams.get("field");
  const value = url.searchParams.get("value");

  if (!field || !value) {
    return NextResponse.json({ success: false, error: "Missing field or value." }, { status: 400 });
  }

  if (field !== "username" && field !== "phone") {
    return NextResponse.json({ success: false, error: "Invalid field." }, { status: 400 });
  }

  const normalized = field === "username"
    ? value.toLowerCase()
    : value.replace(/[^0-9]/g, "");

  const docRef = adminDb.collection(field === "username" ? "usernames" : "phones").doc(normalized);
  const docSnap = await docRef.get();

  return NextResponse.json({
    success: true,
    field,
    value: normalized,
    available: !docSnap.exists
  });
}
