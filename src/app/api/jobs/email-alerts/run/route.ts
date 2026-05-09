import { NextResponse } from "next/server";

import { runEmailAlertCheckNow } from "@/lib/email/email-alert-generator";
import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function isValidJobSecret(request: Request): boolean {
  const configured = process.env.EMAIL_JOB_SECRET?.trim();
  if (!configured) return false;
  const supplied = request.headers.get("x-job-secret")?.trim();
  return Boolean(supplied && supplied === configured);
}

export async function POST(request: Request) {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const authorized = role === "administrator" || isValidJobSecret(request);

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await runEmailAlertCheckNow();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    console.error("[email-alert-job] Failed to run email alert job", error);
    return NextResponse.json({ error: "Failed to run alert job" }, { status: 500 });
  }
}
