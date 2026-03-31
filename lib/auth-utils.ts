import { auth, type UserRole } from "./auth";

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
 * Require authentication. Returns the user or a 401 Response.
 */
export async function requireAuth(): Promise<SessionUser | Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return user;
}

/**
 * Require a specific role. Returns the user or a 401/403 Response.
 */
export async function requireRole(role: UserRole): Promise<SessionUser | Response> {
  const result = await requireAuth();
  if (result instanceof Response) return result;
  if (!hasRole(result, role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}
