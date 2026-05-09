import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getPublicHolidayMapForRange } from "@/lib/server/public-holidays";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const session = await getSession();
  if (!session.user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "leave.view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return NextResponse.json({ error: "Query params from and to (YYYY-MM-DD) are required." }, { status: 400 });
  }
  if (from > to) {
    return NextResponse.json({ error: "Invalid date range." }, { status: 400 });
  }

  const map = await getPublicHolidayMapForRange(from, to);
  const holidays: Record<string, string> = {};
  map.forEach((name, date) => {
    holidays[date] = name;
  });

  return NextResponse.json({ holidays });
}
