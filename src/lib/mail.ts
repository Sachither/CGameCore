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

    if (process.env.NODE_ENV === 'development') {
      console.log(`[MailSystem] DEV MODE: Skipped sending actual email to ${to}. Subject: ${subject}`);
      return { success: true, testMode: true };
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
      from: 'CGame Intelligence <command@cgamecore.online>',
      to: [to],
      replyTo: 'support@cgamecore.online',
      subject: subject,
      html: html,
      headers: {
        'List-Unsubscribe': '<https://cgamecore.online/unsubscribe>',
        'X-Entity-Ref-ID': Math.random().toString(36).substring(2, 12)
      },
      tags: [
        { name: 'category', value: 'tactical_onboarding' },
        { name: 'environment', value: process.env.NODE_ENV || 'development' }
      ]
    });

    if (error) {
      const errorMsg = error.message || 'Unknown Resend Error';
      console.error(`🛑 MAIL SYSTEM: Delivery Failed. Reason: ${errorMsg}`);
      
      if (errorMsg.includes('verify a domain')) {
        console.error("💡 TACTICAL INTEL: Your domain 'mail.cgamecore.online' is not fully verified in Resend. Check DNS records.");
      }

      // Gracefully handle Resend's own rate limit error
      if (error.name === 'rate_limit_exceeded') {
        console.error("🛑 MAIL SYSTEM: Daily quota exceeded on Resend side.");
        await statsRef.set({ [today]: 100 }, { merge: true });
      }
      return { success: false, error };
    }

    // 3. Increment usage count
    await statsRef.set({
      [today]: admin.firestore.FieldValue.increment(1),
      totalSent: admin.firestore.FieldValue.increment(1)
    }, { merge: true });

    console.log(`[MailSystem] SUCCESS: Email dispatched to ${to}. ID: ${data?.id}`);

    return { success: true, data };
  } catch (err: any) {
    console.error("[MailSystem] Unexpected Error:", err);
    return { success: false, error: err.message };
  }
}
