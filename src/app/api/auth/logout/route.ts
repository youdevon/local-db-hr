import { NextResponse } from "next/server";

import { logoutWithoutRedirectAction } from "@/actions/auth";
import { clearSessionCookie } from "@/lib/get-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type LogoutReason = "manual" | "inactivity_timeout" | "session_expired";

function normalizeReason(value: unknown): LogoutReason {
  if (value === "inactivity_timeout") return "inactivity_timeout";
  if (value === "session_expired") return "session_expired";
  return "manual";
}

export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
  };
  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = normalizeReason(body.reason);
    await logoutWithoutRedirectAction(reason);
    return NextResponse.json({ success: true }, { headers });
  } catch {
    await clearSessionCookie().catch(() => undefined);
    return NextResponse.json({ success: false }, { status: 500, headers });
  }
}
