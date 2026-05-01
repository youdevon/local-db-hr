"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { runReport } from "@/lib/server/reports";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";

export async function runReportAction(reportType: string, filters: Record<string, string>) {
  const session = await getSession();
  if (!session.user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "reports.view")) {
    throw new Error("Unauthorized");
  }

  try {
    return await runReport(reportType, filters);
  } catch {
    throw new Error("Failed to run report. Please review your filters and try again.");
  }
}
