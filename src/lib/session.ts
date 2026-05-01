import type { SessionOptions } from "iron-session";

export type SessionUser = {
  userId: string;
  email: string;
  name: string;
  role: string;
  department: string | null;
};

export type SessionData = {
  user?: SessionUser;
};

/** Cookie name for middleware / manual deletion when iron-session fails to parse. */
export const SESSION_COOKIE_NAME = "local_db_hr_session" as const;

/** Login URL with query param for expired / invalid session recovery (middleware, redirects). */
export const LOGIN_SESSION_EXPIRED_HREF = "/login?reason=session-expired" as const;

export const sessionOptions: SessionOptions = {
  // Set SESSION_SECRET in production (32+ characters). Fallback is dev-only.
  password:
    process.env.SESSION_SECRET || "dev-only-secret-change-me-32chars!!",
  cookieName: SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: false,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  },
};
