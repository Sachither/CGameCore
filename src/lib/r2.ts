import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY || !process.env.R2_SECRET_KEY) {
  console.warn("Cloudflare R2 environment variables are missing. Direct video hosting will be disabled.");
}

export const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY || "",
    secretAccessKey: process.env.R2_SECRET_KEY || "",
  },
});

export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || "cgame-hall-of-fame";
export const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL;

/**
 * Attempts to extract an object key from a public URL and delete it from R2.
 * This fails gracefully so it doesn't block database cleanup if the file is already gone.
 */
export async function deleteR2FileByUrl(publicUrl: string) {
  if (!publicUrl) return;

  try {
    // Attempt to extract the key. Assuming URLs look like:
    // https://pub-xxxx.r2.dev/hof/uid/timestamp-video.mp4
    // or https://cgamecore.online/hof/uid/timestamp-video.mp4
    const keyMatch = publicUrl.match(/(hof\/.*)/);
    if (!keyMatch || !keyMatch[1]) {
      console.warn("[R2 Deletion] Could not extract object key from URL:", publicUrl);
      return;
    }

    const objectKey = keyMatch[1];
    
    const command = new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
    });

    await s3Client.send(command);
    console.log(`[R2 Deletion] Successfully purged: ${objectKey}`);
  } catch (error) {
    console.error("[R2 Deletion] Failed to delete object from R2:", error);
  }
}

