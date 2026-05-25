"use server";

import { db } from "@/db";
import { messages, announcements } from "@/db/schema";
import { desc, eq, and, lte, sql } from "drizzle-orm";
import { getVerifiedIdentity, getVerifiedAdminUid } from "@/lib/server-utils";
import { sanitize } from "@/lib/validation-utils";
import { adminDb } from "@/lib/firebase-admin";
import { createNotificationInternal } from "@/lib/notifications";
import { getTierFromWins } from "@/lib/tier-utils";

/**
 * FETCH: Get Community Messages for a specific channel
 * Returns the last 100 messages with real-time user Tiers.
 */
export async function getCommunityMessagesAction(game: 'CODM' | 'EFOOTBALL' | 'GENERAL') {
  try {
    const result = await db.query.messages.findMany({
      where: eq(messages.game, game),
      orderBy: [desc(messages.createdAt)],
      limit: 100,
    });
    
    // 🛡️ BATCH FETCH TIERS: Fetch current wins for all unique senders in this batch
    const uniqueUserIds = Array.from(new Set(result.map(m => m.userId).filter(id => !!id && !id.startsWith('seed-'))));
    const userTiers: Record<string, number> = {};

    if (uniqueUserIds.length > 0) {
      const MAX_TIER_LOOKUPS = 20; // keep Firestore pressure low during high traffic
      const tierUserIds = uniqueUserIds.slice(0, MAX_TIER_LOOKUPS);

      try {
        const userRefs = tierUserIds.map(uid => adminDb.collection("users").doc(uid!));
        const userSnaps = await adminDb.getAll(...userRefs);

        userSnaps.forEach(snap => {
          if (snap.exists) {
            userTiers[snap.id] = snap.data()?.totalWins || 0;
          }
        });
      } catch (fetchError: any) {
        if (fetchError?.code === 8 || String(fetchError?.message).includes("Quota exceeded")) {
          console.warn("[CommunityAction] Firestore quota exceeded while loading user tiers. Continuing without user tiers.", fetchError?.message);
        } else {
          throw fetchError;
        }
      }
    }

    const messagesWithTiers = result.map(m => {
      let simulatedWins = 0;
      if (m.userId?.startsWith('seed-')) {
        // Deterministic pseudo-random wins based on string length and char code
        const hash = m.userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        simulatedWins = (hash * 13) % 250; // Max 250 wins (Tier 3)
      }

      return {
        ...m,
        userWins: m.userId?.startsWith('seed-') ? simulatedWins : (userTiers[m.userId || ''] || 0)
      };
    });

    // Reverse to show oldest first in the chat window (standard chat UI)
    return { success: true, messages: messagesWithTiers.reverse() };
  } catch (error: any) {
    console.error("[CommunityAction] getMessages error:", error);
    return { success: false, error: "Communications down. Check neural link." };
  }
}

/**
 * ADMIN: Get all messages flagged as reported
 */
export async function getReportedMessagesAction(idToken: string) {
  try {
    await getVerifiedAdminUid(idToken);
    
    const result = await db.query.messages.findMany({
      where: eq(messages.isReported, true),
      orderBy: [desc(messages.reportCount), desc(messages.createdAt)],
      limit: 50,
    });
    
    return { success: true, messages: result };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * SEND: Post a new message to the community
 */
export async function sendCommunityMessageAction(
  idToken: string | null, 
  content: string, 
  game: 'CODM' | 'EFOOTBALL' | 'GENERAL',
  isGif: boolean = false,
  replyTo?: { id: string; user: string; content: string }
) {
  if (!idToken) return { success: false, error: "REGISTRATION_REQUIRED: Join the Arena to participate." };
  
  try {
    const { uid, profile } = await getVerifiedIdentity(idToken);

    // 🛡️ CHAT SUSPENSION CHECK
    const now = new Date();
    const suspendedUntil = profile.chatSuspendedUntil ? (profile.chatSuspendedUntil.toDate ? profile.chatSuspendedUntil.toDate() : new Date(profile.chatSuspendedUntil)) : null;

    if (profile.isChatSuspended || (suspendedUntil && suspendedUntil > now)) {
      const timeRemaining = suspendedUntil ? ` (Ends in ${Math.ceil((suspendedUntil.getTime() - now.getTime()) / (1000 * 60 * 60))} hours)` : "";
      throw new Error(`SUSPENDED_ACCESS: Your communication privileges have been revoked by HQ for violation of war room protocols.${timeRemaining}`);
    }

    // 🛡️ SMART BANNED WORDS FILTER
    const tradeKeywords = ['buy', 'sell', 'swap', 'trade', 'transfer', 'vendor'];
    const targetKeywords = ['account', 'id', 'coin', 'cr', 'login', 'pass', 'scam', 'whatsapp', 'call me', 'inbox me'];
    
    const lowerContent = content.toLowerCase();
    
    // Check for "buy account", "selling coins", etc.
    const isTrading = tradeKeywords.some(tk => 
      targetKeywords.some(tk2 => lowerContent.includes(tk) && lowerContent.includes(tk2))
    );

    if (isTrading) {
      throw new Error("UNAUTHORIZED_TRADE: Trading accounts, IDs, or Coins is strictly prohibited. Your handle has been flagged.");
    }
    
    const sanitizedContent = sanitize(content);
    if (!sanitizedContent && !isGif) throw new Error("Blank transmission blocked.");
    if (sanitizedContent.length > 500) throw new Error("Transmission too long.");

    await db.insert(messages).values({
      userId: uid,
      username: profile.username || "Unknown Operative",
      avatarId: profile.avatarId || 0,
      content: sanitizedContent,
      game: game,
      isGif: isGif,
      replyToId: replyTo?.id,
      replyToUser: replyTo?.user,
      replyToContent: replyTo?.content,
    });

    // 📣 NOTIFICATION: Notify the original sender if this is a reply
    if (replyTo?.id) {
       try {
         const originalMessage = await db.query.messages.findFirst({
           where: eq(messages.id, replyTo.id)
         });

         if (originalMessage && originalMessage.userId && originalMessage.userId !== uid) {
            await createNotificationInternal(
               originalMessage.userId,
               "💬 New Reply",
               `${profile.username || "Operative"} replied to your transmission.`,
               "SYSTEM"
            );
         }
       } catch (notifyErr) {
         console.error("[CommunityAction] Reply notification failure:", notifyErr);
       }
    }

    // 📣 NOTIFICATION: Handle @mentions
    const mentionRegex = /@(\w+)/g;
    const matchResult = sanitizedContent.match(mentionRegex);
    const mentionsFound = matchResult ? Array.from(new Set(matchResult)) : [];
    
    if (mentionsFound.length > 0) {
      for (const mention of mentionsFound) {
        const exactMentionStr = mention.substring(1);
        const targetUsername = exactMentionStr.toLowerCase();
        if (targetUsername === profile.username?.toLowerCase()) continue;

        try {
          let userSnap = await adminDb.collection("users")
            .where("usernameLower", "==", targetUsername)
            .limit(1)
            .get();
            
          // Fallback for older users without usernameLower
          if (userSnap.empty) {
            userSnap = await adminDb.collection("users")
              .where("username", "==", exactMentionStr)
              .limit(1)
              .get();
          }

          if (!userSnap.empty) {
            const targetUid = userSnap.docs[0].id;
            await createNotificationInternal(
              targetUid,
              "🎯 Tactical Mention",
              `${profile.username || "Operative"} tagged you in the ${game} sector.`,
              "ALERT"
            );
          }
        } catch (mentionErr) {
          console.error("[CommunityAction] Mention notification failure:", mentionErr);
        }
      }
    }

    return { success: true };
  } catch (error: any) {
    console.error("[CommunityAction] sendMessage error:", error);
    return { success: false, error: error.message || "Transmission failed." };
  }
}

/**
 * INTERACTION: Toggle like on a message
 */
export async function toggleLikeMessageAction(idToken: string, messageId: string) {
  try {
    const { uid, profile } = await getVerifiedIdentity(idToken);
    
    const message = await db.query.messages.findFirst({
      where: eq(messages.id, messageId)
    });
    
    if (!message) throw new Error("Message not found.");
    
    let currentLikes = (message.likes as string[]) || [];
    const hasLiked = currentLikes.includes(uid);
    
    const newLikes = hasLiked 
      ? currentLikes.filter(id => id !== uid)
      : [...currentLikes, uid];
      
    await db.update(messages)
      .set({ likes: newLikes })
      .where(eq(messages.id, messageId));

    // 📣 NOTIFICATION: Notify the message owner if this is a new like
    if (!hasLiked && message.userId && message.userId !== uid) {
       try {
          await adminDb.collection("users").doc(message.userId).collection("notifications").add({
             recipientUid: message.userId,
             senderUid: uid,
             senderName: profile.username || "Operative",
             title: "❤️ New Tactical Like",
             message: `${profile.username || "Operative"} liked your transmission: "${message.content?.substring(0, 30)}${message.content?.length > 30 ? '...' : ''}"`,
             type: 'LIKE',
             messageId: messageId,
             messageSnippet: message.content?.substring(0, 50) || "Image/Gif",
             game: message.game,
             isRead: false,
             read: false,
             createdAt: new Date()
          });
       } catch (notifyErr) {
          console.error("[CommunityAction] Like notification failure:", notifyErr);
       }
    }
      
    return { success: true, liked: !hasLiked };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * REPORT: Flag a message for review
 */
export async function reportCommunityMessageAction(idToken: string, messageId: string) {
  try {
    await getVerifiedIdentity(idToken);
    
    await db.update(messages)
      .set({ 
        isReported: true,
        reportCount: sql`${messages.reportCount} + 1`
      })
      .where(eq(messages.id, messageId));
      
    return { success: true };
  } catch (error: any) {
    return { success: false, error: "Report failed to synchronize." };
  }
}

/**
 * FETCH: Get the active announcement for a channel
 * Only returns announcements newer than 24 hours.
 */
export async function getActiveAnnouncementAction(game: 'CODM' | 'EFOOTBALL' | 'GENERAL' = 'GENERAL') {
  try {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);

    const result = await db.query.announcements.findFirst({
      where: and(
        eq(announcements.game, game), 
        eq(announcements.isActive, true),
        sql`${announcements.createdAt} > ${cutoff}`
      ),
      orderBy: [desc(announcements.createdAt)],
    });
    return { success: true, announcement: result };
  } catch (error) {
    return { success: false, error: "Failed to fetch HQ broadcasts." };
  }
}

/**
 * ADMIN: Update/Set active announcement
 */
export async function adminUpdateAnnouncementAction(
  idToken: string,
  content: string,
  game: 'CODM' | 'EFOOTBALL' | 'GENERAL' = 'GENERAL'
) {
  try {
    await getVerifiedAdminUid(idToken); // Verify admin clearance
    
    const sanitized = content.trim();
    
    // Deactivate old announcements for this channel
    await db.update(announcements)
      .set({ isActive: false })
      .where(eq(announcements.game, game));

    if (sanitized) {
      await db.insert(announcements).values({
        content: sanitized,
        game: game,
        isActive: true,
      });
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Unauthorized clearance." };
  }
}

/**
 * ADMIN: Purge messages by age to save database space
 */
export async function adminPurgeMessagesAction(idToken: string, daysAgo: number) {
  try {
    await getVerifiedAdminUid(idToken);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);

    // Using native SQL for robust date comparison in Neon/Postgres
    await db.delete(messages).where(sql`${messages.createdAt} <= ${cutoffDate}`);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: Delete a single specific message
 */
export async function adminDeleteMessageAction(idToken: string, messageId: string) {
  try {
    await getVerifiedAdminUid(idToken);
    const existing = await db.query.messages.findFirst({ where: eq(messages.id, messageId) });
    if (!existing) {
      return { success: false, error: "Message not found or already deleted." };
    }
    await db.delete(messages).where(eq(messages.id, messageId));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Delete failed." };
  }
}

/**
 * ADMIN: Seed the community with tactical chatter to simulate activity
 */
export async function adminSeedCommunityMessagesAction(idToken: string) {
  try {
    await getVerifiedAdminUid(idToken);
    
    const personas = [
      { name: "Ghost_Operative", av: 1 },
      { name: "NeonShadow", av: 4 },
      { name: "CyberKing", av: 2 },
      { name: "Pro_Gamer_01", av: 7 },
      { name: "TacticalSniper", av: 5 },
      { name: "eFootball_God", av: 3 },
      { name: "ViperQueen", av: 6 },
      { name: "Alpha_Squad", av: 8 },
      { name: "Silent_Assassin", av: 9 },
      { name: "GlitchHunter", av: 10 }
    ];

    const general_messages = [
      "The community vibe here is top-tier. Real players only.",
      "Just cashed out my winnings. Withdrawal was instant. Respect.",
      "New operative joining the ranks. Ready to dominate the leaderboard.",
      "Connectivity is 10/10 today. Zero lag during the final round.",
      "Shoutout to HQ for the quick support resolution. Top notch.",
      "The UI looks incredible after the latest update. Loving the aesthetic.",
      "Ready for the next deployment. Lock and load! 🎯",
      "Who's ready for the weekend tournament? Prize pool looks massive.",
      "Almost had the 10-win streak achievement. One more to go!",
      "GGs all around. This platform is the future of competitive gaming.",
      "Just shared some intel in the sector. Check it out.",
      "The reward system is fire 🔥",
      "Anyone want to join my squad for the next event?",
      "Finally reached the Top 50 on the Global Leaderboard!",
      "Just topped up my wallet. Ready for some serious competition."
    ];

    const codm_messages = [
      "Just secured a clinical win in CODM! GGs to the lobby. 🔥",
      "Is the CODM arena popping right now? Need some action.",
      "Looking for a solid squad for the next 4v4 tournament. Who's in?",
      "Any tips for the CODM sniper challenge? Stuck on the final rank.",
      "Just secured a nuklear in the public lobby. Feeling dangerous.",
      "CODM sector is intense today. The competition is real.",
      "GGs to @TacticalSniper for that headshot. I didn't even see you!",
      "Who's grinding the CODM seasonal ranks?",
      "Just won a 1v1 in CODM! GGs to the lobby.",
      "That last S&D match was too close. My heart was pounding.",
      "Searching for CODM scrims. Join my sector lobby if you have a team.",
      "Best loadout for the new SMG? It feels a bit bouncy.",
      "Just hit a cross-map axe. Clip coming soon to the hub.",
      "CODM tournaments here are the most balanced I've played.",
      "Lock and load. CODM tournament starting in 15 minutes!"
    ];

    const efootball_messages = [
      "Anyone up for eFootball high stakes? I'm waiting in the arena.",
      "Who saw that clutch play in the eFootball finals? Insane skill.",
      "GG to @CyberKing for that last-minute goal. Almost had you!",
      "eFootball server feels smooth. Ready for some rank pushing.",
      "My tactical formation is finally working. 4-3-3 is the way.",
      "Just beat a Division 1 player in eFootball. Tactical masterclass.",
      "Who's your top striker in the current meta? Need advice.",
      "Searching for eFootball co-op partners for the weekend.",
      "GGs, that game was a tactical chess match. Well played.",
      "Just reached 2000 points in eFootball. Peak performance.",
      "The goalie saved me in the 90th minute. PHEW. 🧤",
      "eFootball stakes are high today. Protect your coins!",
      "Anyone want to test a new tactic in a friendly match?",
      "Just pulled a legendary card. My squad is complete.",
      "The pitch feels great today. Time to score some screamers."
    ];

    const seedData: any[] = [];

    // Helper to add seeds
    const addSeeds = (list: string[], channel: 'GENERAL' | 'CODM' | 'EFOOTBALL') => {
      list.forEach((content, i) => {
        const persona = personas[Math.floor(Math.random() * personas.length)];
        const randomMinutes = Math.floor(Math.random() * 240); // Last 4 hours
        const createdAt = new Date();
        createdAt.setMinutes(createdAt.getMinutes() - randomMinutes);

        seedData.push({
          userId: `seed-${channel}-${i}`,
          username: persona.name,
          avatarId: persona.av,
          content: content,
          game: channel,
          isSeed: true,
          createdAt: createdAt,
          likes: []
        });
      });
    };

    addSeeds(general_messages, 'GENERAL');
    addSeeds(codm_messages, 'CODM');
    addSeeds(efootball_messages, 'EFOOTBALL');

    // Execute bulk insert
    if (seedData.length > 0) {
      await db.insert(messages).values(seedData);
    }

    // Diagnostic: Check total count
    const totalCount = await db.select({ count: sql<number>`count(*)` }).from(messages);

    return { success: true, count: seedData.length, totalInDb: totalCount[0]?.count };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * ADMIN: Purge all tactical seed messages
 */
export async function adminDeleteSeedMessagesAction(idToken: string) {
  try {
    await getVerifiedAdminUid(idToken);
    await db.delete(messages).where(eq(messages.isSeed, true));
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
