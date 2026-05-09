import { NextResponse } from "next/server";

import { clearSessionCookie, getSession } from "@/lib/get-session";
import { getSessionSettings } from "@/lib/security-settings";
import { getSessionExpiryReason } from "@/lib/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Lightweight session probe for client visibility/wake and fetch wrappers.
 * Returns 401 + SESSION_EXPIRED when there is no valid signed-in user.
 */
export async function GET() {
  const session = await getSession();
  const sessionSettings = await getSessionSettings();
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
  if (!session.user?.userId) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 401, headers });
  }
  const expiryReason = getSessionExpiryReason(session, {
    inactivityTimeoutSeconds: sessionSettings.idleTimeoutMinutes * 60,
    absoluteTimeoutSeconds: sessionSettings.absoluteSessionHours * 60 * 60,
  });
  if (expiryReason) {
    await clearSessionCookie().catch(() => undefined);
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 401, headers });
  }
  return NextResponse.json({ ok: true }, { status: 200, headers });
}
