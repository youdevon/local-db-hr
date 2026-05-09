"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
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

export async function logReportExportAction(reportType: string, reason?: string) {
  const session = await getSession();
  if (!session.user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "reports.export")) {
    throw new Error("Unauthorized");
  }

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: session.user.userId,
    actorEmail: session.user.email,
    actorName: session.user.name,
    module: "Reports",
    action: "report_exported",
    targetType: "report",
    targetLabel: `Report: ${reportType}`,
    success: true,
    metadata: { reportType, reason: reason?.trim() || null },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
}
