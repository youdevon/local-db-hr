import { getIronSession } from "iron-session";
import type { IronSession } from "iron-session";
import { cookies } from "next/headers";

import { SESSION_COOKIE_NAME, sessionOptions, type SessionData } from "@/lib/session";

/** Removes the session cookie (e.g. after decrypt failure or forced logout). */
export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE_NAME);
}

/**
 * Loads the iron-session. Never throws: invalid/malformed cookies are cleared and an empty session is returned.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  try {
    return await getIronSession<SessionData>(await cookies(), sessionOptions);
  } catch {
    await clearSessionCookie();
    return await getIronSession<SessionData>(await cookies(), sessionOptions);
  }
}
