"use server";

import { adminDb } from "@/lib/firebase-admin";
import { adminAuth } from "@/lib/firebase-admin";
import { createNotificationInternal } from "@/lib/notifications";
import admin from "firebase-admin";

/**
 * Helper: Convert Firestore timestamps to plain Date objects
 */
function convertTimestamps(obj: any): any {
  if (!obj) return obj;
  
  const result = { ...obj };
  const timestampFields = ['createdAt', 'updatedAt', 'lastReplyAt', 'resolvedAt', 'closedAt'];
  
  for (const field of timestampFields) {
    if (result[field] && typeof result[field].toDate === 'function') {
      result[field] = result[field].toDate();
    }
  }
  
  return result;
}

/**
 * SERVER ACTION: Create a new support ticket
 */
export async function createSupportTicketAction(
  idToken: string,
  category: string,
  message: string
) {
  if (!idToken || !message.trim()) {
    return { success: false, error: "Invalid input" };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return { success: false, error: "User not found" };
    }

    const userData = userSnap.data();
    const ticketId = `TKT-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const ticketRef = adminDb.collection("support_tickets").doc(ticketId);
    
    await ticketRef.set({
      ticketId,
      uid,
      username: userData?.username || "Unknown",
      category,
      subject: category, // Map category to subject for consistency
      status: "OPEN", // OPEN, IN_PROGRESS, RESOLVED, CLOSED
      priority: "NORMAL", // Can be set by admin
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      resolvedAt: null,
      closedAt: null,
      adminAssigned: null,
      thread: []  // Will hold all messages/replies
    });

    // Create initial message in thread
    await ticketRef.collection("messages").doc("msg-0").set({
      messageId: "msg-0",
      authorUid: uid,
      authorName: userData?.username || "User",
      authorRole: "USER",
      message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isSystemMessage: false,
    });

    // Update thread count in main ticket
    await ticketRef.update({
      messageCount: 1,
    });

    return { success: true, ticketId };
  } catch (error: any) {
    console.error("[TicketAction] Error creating ticket:", error);
    return { success: false, error: error.message || "Failed to create ticket" };
  }
}

/**
 * SERVER ACTION: Add a reply to support ticket (user or admin)
 */
export async function addTicketReplyAction(
  idToken: string,
  ticketId: string,
  message: string
) {
  if (!idToken || !ticketId || !message.trim()) {
    return { success: false, error: "Invalid input" };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const ticketRef = adminDb.collection("support_tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return { success: false, error: "Ticket not found" };
    }

    const ticketData = ticketSnap.data();

    // Verify user is either the ticket owner or an admin
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isAdmin = userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.isAdmin;

    if (ticketData?.uid !== uid && !isAdmin) {
      return { success: false, error: "Unauthorized" };
    }

    // Create message in thread
    const messageCount = (ticketData?.messageCount || 0) + 1;
    const messageId = `msg-${messageCount}`;

    await ticketRef.collection("messages").doc(messageId).set({
      messageId,
      authorUid: uid,
      authorName: userData?.username || "Admin",
      authorRole: isAdmin ? "ADMIN" : "USER",
      message,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isSystemMessage: false,
    });

    // Update ticket metadata
    await ticketRef.update({
      messageCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastReplyAt: admin.firestore.FieldValue.serverTimestamp(),
      lastReplyBy: isAdmin ? "ADMIN" : "USER",
    });

    // If admin replied and ticket was OPEN, move to IN_PROGRESS
    if (isAdmin && ticketData?.status === "OPEN") {
      await ticketRef.update({
        status: "IN_PROGRESS",
        adminAssigned: uid,
      });
    }

    // Send notification to ticket owner if admin replied
    if (isAdmin && ticketData?.uid !== uid) {
      const messagePreview = message.length > 50 ? message.substring(0, 50) + "..." : message;
      await createNotificationInternal(
        ticketData?.uid,
        "Admin Reply - Support Ticket",
        `Admin replied: ${messagePreview}`,
        "ALERT"
      );
    }

    return { success: true, messageId };
  } catch (error: any) {
    console.error("[TicketAction] Error adding reply:", error);
    return { success: false, error: error.message || "Failed to add reply" };
  }
}

/**
 * SERVER ACTION: Update ticket status (admin only)
 */
export async function updateTicketStatusAction(
  idToken: string,
  ticketId: string,
  newStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
) {
  if (!idToken || !ticketId || !newStatus) {
    return { success: false, error: "Invalid input" };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Verify user is admin
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isAdmin = userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.isAdmin;

    if (!isAdmin) {
      return { success: false, error: "Admin access required" };
    }

    const ticketRef = adminDb.collection("support_tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();
    
    if (!ticketSnap.exists) {
      return { success: false, error: "Ticket not found" };
    }

    const ticketData = ticketSnap.data();
    const ticketOwnerUid = ticketData?.uid;

    const updateData: any = {
      status: newStatus,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      adminAssigned: uid,
    };

    if (newStatus === "RESOLVED") {
      updateData.resolvedAt = admin.firestore.FieldValue.serverTimestamp();
    } else if (newStatus === "CLOSED") {
      updateData.closedAt = admin.firestore.FieldValue.serverTimestamp();
    }

    await ticketRef.update(updateData);

    // Add system message to thread
    const messageCount = (await ticketRef.get()).data()?.messageCount || 0;
    await ticketRef.collection("messages").doc(`msg-${messageCount + 1}`).set({
      messageId: `msg-${messageCount + 1}`,
      authorUid: uid,
      authorName: "System",
      authorRole: "SYSTEM",
      message: `Ticket status changed to ${newStatus}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      isSystemMessage: true,
    });

    // Send notification to ticket owner about status change
    if (ticketOwnerUid) {
      const statusMessages: Record<string, string> = {
        "IN_PROGRESS": "Your support ticket is being reviewed",
        "RESOLVED": "Your support ticket has been resolved",
        "CLOSED": "Your support ticket has been closed",
      };
      const notificationMessage = statusMessages[newStatus] || `Ticket status updated to ${newStatus}`;
      await createNotificationInternal(
        ticketOwnerUid,
        "Support Ticket Update",
        notificationMessage,
        "ALERT"
      );
    }

    return { success: true };
  } catch (error: any) {
    console.error("[TicketAction] Error updating status:", error);
    return { success: false, error: error.message || "Failed to update ticket" };
  }
}

/**
 * SERVER ACTION: Get user's support tickets
 */
export async function getUserTicketsAction(idToken: string) {
  if (!idToken) {
    return { success: false, error: "Not authenticated", tickets: [] };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const ticketsSnap = await adminDb
      .collection("support_tickets")
      .where("uid", "==", uid)
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const tickets = ticketsSnap.docs.map((doc) => convertTimestamps(doc.data()));

    return { success: true, tickets };
  } catch (error: any) {
    console.error("[TicketAction] Error fetching tickets:", error);
    return { success: false, error: error.message || "Failed to fetch tickets", tickets: [] };
  }
}

/**
 * SERVER ACTION: Get single ticket with full thread
 */
export async function getTicketDetailAction(idToken: string, ticketId: string) {
  if (!idToken || !ticketId) {
    return { success: false, error: "Invalid input", ticket: null, messages: [] };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const ticketRef = adminDb.collection("support_tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return { success: false, error: "Ticket not found", ticket: null, messages: [] };
    }

    const ticketData = ticketSnap.data();

    // Verify user is ticket owner or admin
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isAdmin = userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.isAdmin;

    if (ticketData?.uid !== uid && !isAdmin) {
      return { success: false, error: "Unauthorized", ticket: null, messages: [] };
    }

    // Get all messages in thread
    const messagesSnap = await ticketRef.collection("messages").orderBy("createdAt", "asc").get();
    const messages = messagesSnap.docs.map((doc) => convertTimestamps(doc.data()));

    const ticket = convertTimestamps(ticketData || {});

    return { success: true, ticket, messages };
  } catch (error: any) {
    console.error("[TicketAction] Error fetching ticket detail:", error);
    return { success: false, error: error.message || "Failed to fetch ticket", ticket: null, messages: [] };
  }
}

/**
 * SERVER ACTION: Get all tickets (admin only)
 */
export async function getAllTicketsAction(idToken: string) {
  if (!idToken) {
    return { success: false, error: "Not authenticated", tickets: [] };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    // Verify user is admin
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isAdmin = userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.isAdmin;

    if (!isAdmin) {
      return { success: false, error: "Admin access required", tickets: [] };
    }

    const ticketsSnap = await adminDb
      .collection("support_tickets")
      .orderBy("updatedAt", "desc")
      .limit(100)
      .get();

    const tickets = ticketsSnap.docs.map((doc) => convertTimestamps(doc.data()));

    return { success: true, tickets };
  } catch (error: any) {
    console.error("[TicketAction] Error fetching all tickets:", error);
    return { success: false, error: error.message || "Failed to fetch tickets", tickets: [] };
  }
}

/**
 * SERVER ACTION: Delete a support ticket (admin only or ticket owner)
 */
export async function deleteTicketAction(idToken: string, ticketId: string) {
  if (!idToken || !ticketId) {
    return { success: false, error: "Invalid input" };
  }

  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const ticketRef = adminDb.collection("support_tickets").doc(ticketId);
    const ticketSnap = await ticketRef.get();

    if (!ticketSnap.exists) {
      return { success: false, error: "Ticket not found" };
    }

    const ticketData = ticketSnap.data();

    // Verify user is either the ticket owner or an admin
    const userSnap = await adminDb.collection("users").doc(uid).get();
    const userData = userSnap.data();
    const isAdmin = userData?.role === "ADMIN" || userData?.role === "SUPER_ADMIN" || userData?.isAdmin;

    if (ticketData?.uid !== uid && !isAdmin) {
      return { success: false, error: "Unauthorized" };
    }

    // Delete all messages in the thread first
    const messagesSnap = await ticketRef.collection("messages").get();
    const deleteOps = messagesSnap.docs.map((doc) => doc.ref.delete());
    if (deleteOps.length > 0) {
      await Promise.all(deleteOps);
    }

    // Delete the main ticket document
    await ticketRef.delete();

    return { success: true };
  } catch (error: any) {
    console.error("[TicketAction] Error deleting ticket:", error);
    return { success: false, error: error.message || "Failed to delete ticket" };
  }
}
