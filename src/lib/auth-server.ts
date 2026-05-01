import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import {
  canAccessRoute,
  canPerformAction,
  isViewerRole,
  MUTATION_NOT_PERMITTED_MESSAGE,
  normalizeUserRole,
  type Permission,
  type UserRole,
} from "@/lib/roles";
import { LOGIN_SESSION_EXPIRED_HREF, type SessionUser } from "@/lib/session";

export { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";

/** Returns the signed-in user id, or `null` if there is no session. */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session.user?.userId ?? null;
}

export async function getSessionUserRole(): Promise<UserRole | null> {
  const session = await getSession();
  if (!session.user?.role) return null;
  return normalizeUserRole(session.user.role);
}

/**
 * Requires a signed-in user; redirects to login when the session is missing or invalid.
 */
export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  const user = session.user;
  if (!user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  return user;
}

/**
 * Hard block for viewers before any HR mutation (employees, contracts, leave, etc.).
 * Throws so direct action invocation cannot bypass return-shape handling.
 */
export async function assertViewerCannotMutateOrThrow(): Promise<void> {
  const user = await requireUser();
  if (isViewerRole(user.role)) {
    throw new Error(MUTATION_NOT_PERMITTED_MESSAGE);
  }
}

/** Requires a signed-in user id; redirects to login when the session is missing or invalid. */
export async function requireSessionUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  return userId;
}

export async function requirePermission(permission: Permission): Promise<{ userId: string; role: UserRole } | null> {
  const session = await getSession();
  const userId = session.user?.userId ?? null;
  const role = normalizeUserRole(session.user?.role ?? null);
  if (!userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  if (!canPerformAction(role, permission)) return null;
  return { userId, role };
}

export async function canAccessPath(pathname: string): Promise<boolean> {
  const session = await getSession();
  return canAccessRoute(session.user?.role ?? null, pathname);
}
