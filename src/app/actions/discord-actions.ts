"use server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import admin from "firebase-admin";
import { submitMatchResultAction } from "./match-actions";
import { createNotificationInternal } from "@/lib/notifications";
import Tesseract from "tesseract.js";

const CODM_KEYWORDS = ["victory", "defeat", "match", "kills", "assists", "mvp", "first blood", "score"];
const EFOOTBALL_KEYWORDS = ["full time", "goals", "shots", "passes", "interceptions", "tackles", "saves", "possession"];
const RUBBISH_KEYWORDS = ["whatsapp", "youtube", "tiktok", "instagram", "battery", "settings", "facebook", "snapchat", "google"];

/**
 * AI Evidence Bouncer (Triage Function)
 * 
 * FIX R-004: Validate image before processing and reject on error
 */
async function validateImageAI(file: File, username: string, inGameName: string, game: 'CODM' | 'EFOOTBALL'): Promise<{ success: boolean; error?: string; requiresAdminReview?: boolean; reason?: string }> {
  try {
    // FIX R-004: Validate image file first
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    
    if (file.size > maxSize) {
      return { success: false, error: `Image must be under 5MB. Your file: ${(file.size / 1024 / 1024).toFixed(1)}MB` };
    }
    
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: `Only JPEG, PNG, or WebP images allowed. Your file type: ${file.type}` };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    const ocrResult = await Promise.race([
      Tesseract.recognize(buffer, "eng"),
      new Promise((_, reject) => setTimeout(() => reject(new Error("SCAN_TIMEOUT")), 12000))
    ]) as any;

    const text = ocrResult.data.text.toLowerCase();
    
    // 1. HARD REJECTION: RUBBISH & UI CONTENT
    const isRubbish = RUBBISH_KEYWORDS.some(kw => text.includes(kw));
    if (isRubbish) {
      console.warn(`[AI Scanner] RUBBISH REJECTED from ${username}: System/Social UI detect.`);
      return { success: false, error: "AI Error: Non-game content detected (System/Social UI). Only share in-game victory screens." };
    }

    // 2. SEGREGATED KEYWORD CLOCKING
    const keywords = game === 'CODM' ? CODM_KEYWORDS : EFOOTBALL_KEYWORDS;
    const hasKeyword = keywords.some(kw => text.includes(kw));
    
    // 3. PLAYER IDENTITY VERIFICATION (STRICT WORD MATCH)
    const normalizedName = (inGameName || username).toLowerCase();
    // Look for the name with word boundaries to avoid substring false positives
    const nameRegex = new RegExp(`\\b${normalizedName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
    const hasPlayerIdentifier = nameRegex.test(text) || text.includes(normalizedName);
    
    if (!hasKeyword && !hasPlayerIdentifier) {
      console.warn(`[AI Scanner] MISMATCH REJECTED from ${username}. Text Context:`, text.substring(0, 80));
      return { success: false, error: `AI Error: Evidence mismatched. No ${game} victory indicators found for '${normalizedName}'.` };
    }
    
    console.log(`[AI Scanner] VERIFIED for ${username}. [KW: ${hasKeyword}] [ID: ${hasPlayerIdentifier}]`);
    return { success: true };
  } catch (ocrError: any) {
    if (ocrError.message === "SCAN_TIMEOUT") {
       console.warn(`[AI Scanner] TIMEOUT for ${username}. Evidence flagged for manual admin review.`);
       // FIXED: Allow submission but flag for manual review instead of blocking
       return { success: true, requiresAdminReview: true, reason: "Scan timeout" };
    } else {
       console.error("[AI Scanner] CRASHED during analysis:", ocrError);
       // FIX R-004: CRITICAL FIX - Don't allow through on error!
       return { success: false, error: "Evidence verification failed. Please try again or contact support." };
    }
  }
}

/**
 * Parses FormData from the client, uploads the image to Discord privately,
 * and passes the resulting CDN URL to the database.
 */
export async function submitResultWithDiscordAction(formData: FormData) {
  const idToken = formData.get("idToken") as string;
  const matchId = formData.get("matchId") as string;
  const claim = formData.get("claim") as "WIN" | "LOSS";
  const file = formData.get("file") as File | null;
  const username = formData.get("username") as string || "Player";
  const inGameName = formData.get("inGameName") as string || "";
  const scoreFor = formData.get("scoreFor") ? Number(formData.get("scoreFor")) : undefined;
  const scoreAgainst = formData.get("scoreAgainst") ? Number(formData.get("scoreAgainst")) : undefined;
  const kills = formData.get("kills") ? Number(formData.get("kills")) : undefined;

  if (!idToken || !matchId || !claim) {
    return { success: false, error: "Missing required fields." };
  }

  // Determine the game from Firestore before AI scan
  let game: 'CODM' | 'EFOOTBALL' = 'CODM';
  try {
     const snap = await adminDb.collection("matches").doc(matchId).get();
     if (snap.exists) game = snap.data()?.game || 'CODM';
  } catch(e) {}

  let finalProofUrl = "";

  // 1. AI Evidence Triage
  let requiresAdminReview = false;
  if (file && file.size > 0 && claim === 'WIN') {
    const aiCheck = await validateImageAI(file, username, inGameName, game);
    if (!aiCheck.success) {
       return aiCheck;
    }
    // Track if evidence needs manual review (e.g., scan timeout)
    if ((aiCheck as any).requiresAdminReview) {
       requiresAdminReview = true;
       console.log(`[Discord] Evidence marked for admin review: ${(aiCheck as any).reason}`);
    }

    let webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    
    if (!webhookUrl) {
      console.warn("DISCORD_WEBHOOK_URL is not set in .env.local. Skipping Discord upload.");
      finalProofUrl = "pending_discord_setup_" + Date.now();
    } else {
      try {
        if (!webhookUrl.includes("wait=true")) {
          webhookUrl += webhookUrl.includes("?") ? "&wait=true" : "?wait=true";
        }

        const discordFormData = new FormData();
        let displayMetric = "";
        if (game === 'EFOOTBALL' && scoreFor !== undefined) {
           displayMetric = `\n**Scoreline:** \`${scoreFor} - ${scoreAgainst}\``;
        } else if (game === 'CODM' && kills !== undefined) {
           displayMetric = `\n**Kills:** \`${kills}\``;
        }

        discordFormData.append("content", `🚨 **New Match Evidence**\n**Match ID:** \`${matchId}\`\n**Operator:** \`${username}\` claimed **${claim}**${displayMetric}`);
        discordFormData.append("file", file, file.name || "proof.jpg");

        const discordRes = await fetch(webhookUrl, {
          method: "POST",
          body: discordFormData,
          cache: "no-store" 
        });

        if (!discordRes.ok) {
           const errText = await discordRes.text();
           throw new Error(`Discord API Error (${discordRes.status}): ${errText}`);
        }

        const messageData = await discordRes.json();
        
        if (messageData.attachments && messageData.attachments.length > 0) {
          finalProofUrl = messageData.attachments[0].url;
        } else {
          throw new Error("Discord accepted the file but returned no attachment URL.");
        }
      } catch(e: any) {
        console.error("Discord Upload Pipeline Failed:", e);
        return { success: false, error: `Transmission Error: ${e.message || "Unknown Vault Error"}` };
      }
    }
  }

  // 2. Delegate to the standard Firestore match resolution action
  return await submitMatchResultAction(idToken, matchId, claim, finalProofUrl, scoreFor, scoreAgainst, kills, undefined, undefined, requiresAdminReview);
}

/**
 * DISPUTE ACTION: TRANSMIT TO DISCORD
 * Uploads Image and Video evidence to the Tribunal Vault.
 */
export async function disputeMatchWithDiscordAction(formData: FormData) {
  const idToken = formData.get("idToken") as string;
  const matchId = formData.get("matchId") as string;
  const reason = formData.get("reason") as string;
  const imageFile = formData.get("image") as File | null;
  const videoFile = formData.get("video") as File | null;
  const username = formData.get("username") as string || "Operator";

  if (!idToken || !matchId || !reason) {
     return { success: false, error: "Missing required dispute parameters." };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const matchRef = adminDb.collection("matches").doc(matchId);
    const matchSnap = await matchRef.get();
    
    if (!matchSnap.exists) throw new Error("Match record not found.");
    const matchData = matchSnap.data();
    
    if (!matchData?.playerIds.includes(uid)) {
       throw new Error("Unauthorized: Identity not verified for this arena.");
    }

    let proofImageUrl = "";
    let proofVideoUrl = "";
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (webhookUrl) {
       const urlWithWait = webhookUrl.includes("?wait=true") ? webhookUrl : (webhookUrl.includes("?") ? webhookUrl + "&wait=true" : webhookUrl + "?wait=true");
       
       // Handle Image
       if (imageFile && imageFile.size > 0) {
          const imgFormData = new FormData();
          imgFormData.append("content", `⚖️ **Dispute Evidence (Image)**\n**Match:** \`${matchId}\`\n**Operative:** \`${username}\``);
          imgFormData.append("file", imageFile, "evidence.jpg");
          
          const imgRes = await fetch(urlWithWait, { method: "POST", body: imgFormData });
          const imgData = await imgRes.json();
          if (imgData.attachments?.[0]) proofImageUrl = imgData.attachments[0].url;
       }

       // Handle Video
       if (videoFile && videoFile.size > 0) {
          const vidFormData = new FormData();
          vidFormData.append("content", `🎥 **Dispute Evidence (Video)**\n**Match:** \`${matchId}\`\n**Operative:** \`${username}\``);
          vidFormData.append("file", videoFile, "evidence.mp4");
          
          const vidRes = await fetch(urlWithWait, { method: "POST", body: vidFormData });
          const vidData = await vidRes.json();
          if (vidData.attachments?.[0]) proofVideoUrl = vidData.attachments[0].url;
       }
    }

    // Update Match Status to DISPUTED
    await matchRef.update({
       status: "DISPUTED",
       disputeReason: reason,
       disputeImageProof: proofImageUrl,
       disputeVideoProof: proofVideoUrl,
       disputedBy: uid,
       disputedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 🛡️ TRIBUNAL VISIBILITY: Record dispute evidence in the dedicated subcollection
    if (proofImageUrl) {
       await matchRef.collection("match_evidence").doc(`dispute_${uid}_img`).set({
          id: `dispute_${uid}_img`,
          url: proofImageUrl,
          type: 'image',
          ownerUid: uid,
          username: username,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
       });
    }
    if (proofVideoUrl) {
       await matchRef.collection("match_evidence").doc(`dispute_${uid}_vid`).set({
          id: `dispute_${uid}_vid`,
          url: proofVideoUrl,
          type: 'video',
          ownerUid: uid,
          username: username,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
       });
    }

    // Notify Players
    for (const pId of matchData?.playerIds || []) {
       await createNotificationInternal(
          pId,
          "Arena Frozen: Dispute Filed",
          `Match #${matchId.slice(0, 8)} has been flagged for Tribunal review. All funds are frozen pending investigation.`,
          "DISPUTE"
       );
    }

    return { success: true };
  } catch (e: any) {
    console.error("[DiscordDispute] Critical failure:", e);
    return { success: false, error: e.message };
  }
}
