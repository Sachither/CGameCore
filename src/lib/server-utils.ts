import { adminAuth, adminDb } from "./firebase-admin";

/**
 * Validates the Firebase ID Token and returns the UID.
 * Centralized for all Server Actions.
 */
export async function getVerifiedUid(idToken?: string) {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");
  try {
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    return decodedToken.uid;
  } catch (error) {
    throw new Error("Unauthorized: Invalid session.");
  }
}

export interface VerifiedAdminContext {
  uid: string;
  role: string;
  isAdmin: boolean;
  isModerator: boolean;
  isSuperAdmin: boolean;
  source: "token" | "legacy";
}

function normalizeRole(value: any): string {
  if (!value) return "USER";
  return String(value).toUpperCase();
}

async function getRoleFromToken(idToken: string): Promise<VerifiedAdminContext> {
  const decodedToken = await adminAuth.verifyIdToken(idToken);
  const roleClaim = normalizeRole(decodedToken.role);
  const isAdminClaim = decodedToken.isAdmin === true || roleClaim === "ADMIN" || roleClaim === "SUPER_ADMIN";
  const isSuperAdminClaim = decodedToken.isSuperAdmin === true || roleClaim === "SUPER_ADMIN";
  const isModeratorClaim = roleClaim === "MODERATOR";

  return {
    uid: decodedToken.uid,
    role: roleClaim,
    isAdmin: isAdminClaim,
    isModerator: isModeratorClaim,
    isSuperAdmin: isSuperAdminClaim,
    source: "token"
  };
}

async function getLegacyRoleFromProfile(uid: string): Promise<VerifiedAdminContext> {
  const userSnap = await adminDb.collection("users").doc(uid).get();
  if (!userSnap.exists) {
    throw new Error("NOT_FOUND: User profile does not exist.");
  }

  const data = userSnap.data()!;
  const role = normalizeRole(data.role || (data.isAdmin ? "ADMIN" : "USER"));
  const isSuperAdminBoolean = data.isSuperAdmin === true;

  return {
    uid,
    role: isSuperAdminBoolean ? "SUPER_ADMIN" : role,
    isAdmin: role === "ADMIN" || role === "SUPER_ADMIN" || isSuperAdminBoolean,
    isModerator: role === "MODERATOR",
    isSuperAdmin: role === "SUPER_ADMIN" || isSuperAdminBoolean,
    source: "legacy"
  };
}

/**
 * Returns both UID and current database profile.
 * Prevents client-side profile injection (e.g., faking username/avatar).
 */
export async function getVerifiedIdentity(idToken?: string) {
  const uid = await getVerifiedUid(idToken);
  const userSnap = await adminDb.collection("users").doc(uid).get();
  
  if (!userSnap.exists) {
    throw new Error("NOT_FOUND: User profile does not exist.");
  }

  return {
    uid,
    profile: userSnap.data()!
  };
}

/**
 * Verifies the ID token AND confirms the caller is an admin or moderator.
 */
export async function getVerifiedAdminUid(idToken?: string, requireHighLevel: boolean = false): Promise<string> {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");

  const tokenContext = await getRoleFromToken(idToken);
  let resolvedContext = tokenContext;

  if (!tokenContext.isAdmin && !tokenContext.isModerator) {
    // Legacy fallback for existing admin accounts that have not yet been migrated to custom claims.
    const legacyContext = await getLegacyRoleFromProfile(tokenContext.uid);
    resolvedContext = legacyContext;
  }

  if (requireHighLevel) {
    if (!resolvedContext.isAdmin) {
      throw new Error("Forbidden: Full Admin clearance required.");
    }
  } else {
    if (!resolvedContext.isAdmin && !resolvedContext.isModerator) {
      throw new Error("Forbidden: Moderator clearance required.");
    }
  }

  return resolvedContext.uid;
}

export async function getVerifiedSuperAdminUid(idToken?: string): Promise<string> {
  if (!idToken) throw new Error("Unauthorized: Identity token required.");

  const tokenContext = await getRoleFromToken(idToken);
  let resolvedContext = tokenContext;

  if (!tokenContext.isSuperAdmin) {
    // 🔒 [SECURITY] Legacy fallback for Super Admin boolean in Firestore
    const legacyContext = await getLegacyRoleFromProfile(tokenContext.uid);
    resolvedContext = legacyContext;
  }

  if (!resolvedContext.isSuperAdmin) {
    throw new Error("Forbidden: Super-admin clearance required.");
  }

  return resolvedContext.uid;
}
