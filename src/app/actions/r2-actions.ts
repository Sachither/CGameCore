"use server";

import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { s3Client, R2_BUCKET_NAME } from "@/lib/r2";
import { adminAuth } from "@/lib/firebase-admin";

/**
 * Generates a presigned URL for direct browser-to-R2 upload
 */
export async function getR2PresignedUrlAction(idToken: string, fileName: string, fileType: string) {
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Generate a secure, unique filename
    const timestamp = Date.now();
    const cleanFileName = `hof/${uid}/${timestamp}-${fileName.replace(/[^a-zA-Z0-9.-]/g, "_")}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: cleanFileName,
      ContentType: fileType,
    });

    // URL valid for 10 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 600 });

    return { 
      success: true, 
      signedUrl, 
      key: cleanFileName,
      publicUrl: `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${cleanFileName}`
    };
  } catch (err: any) {
    console.error("[R2 Action] Presigned URL Error:", err);
    return { success: false, error: err.message || "Failed to generate upload link." };
  }
}
