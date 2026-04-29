import { Resend } from 'resend';
import { adminDb } from './firebase-admin';
import admin from 'firebase-admin';

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * CORE COMMAND: Send Tactical Email
 * Includes fail-safes for Resend's 100/day free limit.
 */
export async function sendTacticalEmail(to: string, subject: string, html: string) {
  try {
    if (!process.env.RESEND_API_KEY || 
        process.env.RESEND_API_KEY === 're_123' || 
        process.env.RESEND_API_KEY === 're_your_actual_key_here') {
      console.warn("⚠️ MAIL SYSTEM: Skipping email send. RESEND_API_KEY is still a placeholder.");
      return { success: false, error: "API Key Missing" };
    }

    // 1. Check Daily Limit in Firestore
    const today = new Date().toISOString().split('T')[0];
    const statsRef = adminDb.collection("stats").doc("mail_usage");
    const statsSnap = await statsRef.get();
    const statsData = statsSnap.data() || {};
    
    const dailyCount = statsData[today] || 0;
    if (dailyCount >= 100) {
      console.warn(`🛑 MAIL SYSTEM: Daily quota reached (${dailyCount}/100). Suppression active.`);
      return { success: false, error: "Daily limit exceeded" };
    }

    console.log(`[MailSystem] Attempting to send tactical email to ${to}...`);

    // 2. Dispatch Email
    const { data, error } = await resend.emails.send({
      from: 'CGame Intelligence <command@mail.cgamecore.online>',
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error("🛑 MAIL SYSTEM: Resend API Error:", error);
      // Gracefully handle Resend's own rate limit error
      if (error.name === 'rate_limit_exceeded') {
        console.error("🛑 MAIL SYSTEM: Resend reported rate limit exceeded.");
        await statsRef.set({ [today]: 100 }, { merge: true });
      }
      return { success: false, error };
    }

    // 3. Increment usage count
    await statsRef.set({
      [today]: admin.firestore.FieldValue.increment(1),
      totalSent: admin.firestore.FieldValue.increment(1)
    }, { merge: true });

    return { success: true, data };
  } catch (err: any) {
    console.error("[MailSystem] Unexpected Error:", err);
    return { success: false, error: err.message };
  }
}
