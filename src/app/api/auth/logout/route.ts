import { NextResponse } from "next/server";

import { logoutWithoutRedirectAction } from "@/actions/auth";
import { clearSessionCookie } from "@/lib/get-session";

export const dynamic = "force-dynamic";

type LogoutReason = "manual" | "inactivity_timeout" | "session_expired";

function normalizeReason(value: unknown): LogoutReason {
  if (value === "inactivity_timeout") return "inactivity_timeout";
  if (value === "session_expired") return "session_expired";
  return "manual";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { reason?: unknown };
    const reason = normalizeReason(body.reason);
    await logoutWithoutRedirectAction(reason);
    return NextResponse.json({ success: true });
  } catch {
    await clearSessionCookie().catch(() => undefined);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
