import { createHash, randomBytes } from "crypto";
import { auth, type UserRole } from "./auth";
import pool from "./db";

export type SessionUser = {
  id: string;
  entraId: string;
  name: string;
  email: string;
  roles: UserRole[];
};

/**
 * Get the current authenticated user from the session.
 * Returns null if not authenticated.
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return session.user as SessionUser;
}

/**
 * Check whether a user has a specific role.
 */
export function hasRole(user: SessionUser, role: UserRole): boolean {
  return user.roles.includes(role);
}

/**
 * Require authentication. Accepts an optional Request to support Bearer API key auth.
 * Checks Authorization: Bearer <key> first, then falls back to cookie session.
 * Returns the user or a 401 Response.
 */
export async function requireAuth(req?: Request): Promise<SessionUser | Response> {
  const authHeader = req?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const rawKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(rawKey).digest("hex");

    const { rows } = await pool.query<{
      user_id: string;
      entra_id: string;
      name: string;
      email: string;
    }>(
      `SELECT ak.user_id, u.entra_id, u.name, u.email
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = $1 AND ak.revoked_at IS NULL`,
      [keyHash]
    );

    if (rows.length === 0) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    await pool.query(
      `UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
      [keyHash]
    );

    const { rows: roleRows } = await pool.query<{ role: UserRole }>(
      `SELECT role FROM user_roles WHERE user_id = $1`,
      [rows[0].user_id]
    );

    return {
      id: rows[0].user_id,
      entraId: rows[0].entra_id,
      name: rows[0].name,
      email: rows[0].email,
      roles: roleRows.map((r) => r.role),
    };
  }

  // If there's no NextAuth session cookie, skip auth() entirely — it redirects in v5 beta
  // instead of returning null, which would send external callers to the login page.
  const cookie = req?.headers.get("cookie") ?? "";
  if (!cookie.includes("next-auth.session-token") && !cookie.includes("__Secure-next-auth.session-token")) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Fall back to cookie session
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Require a specific role. Returns the user or a 401/403 Response.
 */
export async function requireRole(role: UserRole, req?: Request): Promise<SessionUser | Response> {
  const result = await requireAuth(req);
  if (result instanceof Response) return result;
  if (!hasRole(result, role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

/**
 * Generate a new API key. Returns the raw key (shown once) and values to store in DB.
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 8);
  return { raw, hash, prefix };
}
