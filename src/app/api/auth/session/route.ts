import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";

export const dynamic = "force-dynamic";

/**
 * Lightweight session probe for client visibility/wake and fetch wrappers.
 * Returns 401 + SESSION_EXPIRED when there is no valid signed-in user.
 */
export async function GET() {
  const session = await getSession();
  if (!session.user?.userId) {
    return NextResponse.json({ error: "SESSION_EXPIRED" }, { status: 401 });
  }
  return NextResponse.json({ ok: true }, { status: 200 });
}
