import type { SessionOptions } from "iron-session";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
  mustChangePassword?: boolean;
};

export type SessionData = {
  user?: SessionUser;
  createdAt?: number;
  lastActivityAt?: number;
};

/** Cookie name for middleware / manual deletion when iron-session fails to parse. */
export const SESSION_COOKIE_NAME = "local_db_hr_session" as const;

/** Login URL with query param for expired / invalid session recovery (middleware, redirects). */
export const LOGIN_SESSION_EXPIRED_HREF = "/login?reason=session-expired" as const;
export const DASHBOARD_HREF = "/dashboard" as const;
export const PROFILE_HREF = "/profile" as const;

export const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: false,
  path: "/",
  // Keep domain undefined so browsers bind cookie to current host (localhost or LAN IP).
};

export const SESSION_COOKIE_CLEAR_OPTIONS = {
  ...SESSION_COOKIE_OPTIONS,
  maxAge: 0,
};

export const sessionOptions: SessionOptions = {
  // Set SESSION_SECRET in production (32+ characters). Fallback is dev-only.
  password:
    process.env.SESSION_SECRET || "dev-only-secret-change-me-32chars!!",
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    ...SESSION_COOKIE_OPTIONS,
    maxAge: 60 * 60 * 8,
  },
};

export const SESSION_INACTIVITY_TIMEOUT_SECONDS = 60 * 30;
export const SESSION_ABSOLUTE_TIMEOUT_SECONDS = 60 * 60 * 8;
export const SESSION_ACTIVITY_REFRESH_INTERVAL_MS = 60 * 1000;

export type SessionTimeoutConfig = {
  inactivityTimeoutSeconds: number;
  absoluteTimeoutSeconds: number;
};

export function getSessionExpiryReason(
  session: SessionData,
  config: SessionTimeoutConfig = {
    inactivityTimeoutSeconds: SESSION_INACTIVITY_TIMEOUT_SECONDS,
    absoluteTimeoutSeconds: SESSION_ABSOLUTE_TIMEOUT_SECONDS,
  },
  nowMs: number = Date.now(),
): "session_expired" | "inactivity_timeout" | null {
  const createdAtMs = session.createdAt ?? 0;
  const lastActivityAtMs = session.lastActivityAt ?? createdAtMs;

  if (!createdAtMs || !lastActivityAtMs) return "session_expired";

  const absoluteAgeMs = nowMs - createdAtMs;
  const inactivityMs = nowMs - lastActivityAtMs;

  if (absoluteAgeMs >= config.absoluteTimeoutSeconds * 1000) {
    return "session_expired";
  }
  if (inactivityMs >= config.inactivityTimeoutSeconds * 1000) {
    return "inactivity_timeout";
  }
  return null;
}
