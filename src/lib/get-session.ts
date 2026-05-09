import { getIronSession } from "iron-session";
import type { IronSession } from "iron-session";
import { cookies } from "next/headers";

import {
  SESSION_COOKIE_CLEAR_OPTIONS,
  SESSION_COOKIE_NAME,
  sessionOptions,
  type SessionData,
} from "@/lib/session";

function authLog(message: string, meta?: Record<string, unknown>) {
  console.info(`[auth-session] ${message}`, meta ?? {});
}

/** Removes the session cookie (e.g. after decrypt failure or forced logout). */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  authLog("clearing session cookie", { cookieName: SESSION_COOKIE_NAME });
  jar.set(SESSION_COOKIE_NAME, "", {
    ...SESSION_COOKIE_CLEAR_OPTIONS,
    expires: new Date(0),
  });
}

/**
 * Loads the iron-session. Never throws: invalid/malformed cookies are cleared and an empty session is returned.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  try {
    return await getIronSession<SessionData>(await cookies(), sessionOptions);
  } catch {
    authLog("session parse failed; clearing cookie and retrying");
    await clearSessionCookie();
    return await getIronSession<SessionData>(await cookies(), sessionOptions);
  }
}
