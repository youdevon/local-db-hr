"use server";

import { redirect } from "next/navigation";

import {
  buildAuditTrailExportWorkbook,
  slugifyExportFileName,
} from "@/lib/export/excel-export-build";
import { EXCEL_MIME_TYPE, type AuditExcelRow } from "@/lib/export/excel-style";
import { workbookToBase64 } from "@/lib/export/excel-export-server";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";

export type ExcelExportActionResult =
  | {
      success: true;
      fileName: string;
      contentBase64: string;
      mimeType: string;
      recordCount: number;
    }
  | { success: false; message: string };

export async function exportAuditExcelAction(input: {
  rows: AuditExcelRow[];
  filtersUsed?: Record<string, string> | string | null;
  fileName?: string;
}): Promise<ExcelExportActionResult> {
  const session = await getSession();
  if (!session.user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }

  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "audit.export")) {
    return { success: false, message: "You do not have permission to export audit records." };
  }

  try {
    const workbook = buildAuditTrailExportWorkbook(input.rows, {
      filtersUsed: input.filtersUsed,
    });
    const fileName = input.fileName?.trim() || slugifyExportFileName("audit-trail");
    const contentBase64 = workbookToBase64(workbook);
    if (!contentBase64.trim()) {
      return { success: false, message: "Failed to export audit trail. Please try again." };
    }

    return {
      success: true,
      fileName,
      contentBase64,
      mimeType: EXCEL_MIME_TYPE,
      recordCount: input.rows.length,
    };
  } catch {
    return { success: false, message: "Failed to export audit trail. Please try again." };
  }
}
