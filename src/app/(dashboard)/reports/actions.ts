"use server";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import {
  buildReportExportWorkbook,
  slugifyExportFileName,
  type ReportExcelExportInput,
} from "@/lib/export/excel-export-build";
import { EXCEL_MIME_TYPE } from "@/lib/export/excel-style";
import { workbookToBase64 } from "@/lib/export/excel-export-server";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { runReport } from "@/lib/server/reports";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";

export type ReportExcelExportActionResult =
  | {
      success: true;
      fileName: string;
      contentBase64: string;
      mimeType: string;
      recordCount: number;
    }
  | { success: false; message: string };

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

export async function exportReportExcelAction(
  input: ReportExcelExportInput & { fileName: string },
): Promise<ReportExcelExportActionResult> {
  const session = await getSession();
  if (!session.user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }

  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "reports.export")) {
    return { success: false, message: "You do not have permission to export reports." };
  }

  try {
    const workbook = buildReportExportWorkbook(input);
    const fileName = input.fileName.trim() || slugifyExportFileName(input.title);
    const contentBase64 = workbookToBase64(workbook);
    if (!contentBase64.trim()) {
      return { success: false, message: "Failed to export report. Please try again." };
    }

    return {
      success: true,
      fileName,
      contentBase64,
      mimeType: EXCEL_MIME_TYPE,
      recordCount: input.rows.length,
    };
  } catch {
    return { success: false, message: "Failed to export report. Please try again." };
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
