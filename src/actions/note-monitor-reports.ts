"use server";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import {
  buildNoteMonitorNoteFileName,
  buildNoteMonitorNoteWorkbook,
  buildNoteMonitorReportAuditLabel,
  buildNoteMonitorReportFileName,
  buildNoteMonitorReportWorkbook,
  isValidXlsxBase64,
  normalizeNoteMonitorReportFilters,
  NOTE_MONITOR_EXCEL_MIME,
  validateNoteMonitorReportFilters,
  workbookToBase64,
} from "@/lib/server/note-monitor-export";
import {
  buildNoteMonitorIndividualExportAuditDescription,
  getNoteMonitorReportRecordForExport,
  queryNoteMonitorReportRecords,
  type NoteMonitorReportFilters,
} from "@/lib/server/note-monitor-reports";

export type NoteMonitorExportActionResult =
  | {
      success: true;
      fileName: string;
      contentBase64: string;
      mimeType: string;
      recordCount: number;
    }
  | { success: false; message: string };

function formatGeneratedTimestamp(value: Date): string {
  return value.toLocaleString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

async function logNoteMonitorExport(input: {
  action: string;
  targetLabel: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const session = await getSession();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: session.user?.userId ?? null,
    actorEmail: session.user?.email ?? null,
    actorName: session.user?.name ?? null,
    module: "Note Monitor",
    action: input.action,
    targetType: "note_monitor_report",
    targetLabel: input.targetLabel,
    success: true,
    metadata: input.metadata ?? null,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
}

export async function exportNoteMonitorReportAction(
  filters: NoteMonitorReportFilters = {},
): Promise<NoteMonitorExportActionResult> {
  const auth = await requirePermission("noteMonitor.view");
  if (!auth) {
    return { success: false, message: "You do not have permission to export Note Monitor reports." };
  }

  const normalized = normalizeNoteMonitorReportFilters(filters);
  const validationError = validateNoteMonitorReportFilters(normalized);
  if (validationError) {
    return { success: false, message: validationError };
  }

  try {
    const session = await getSession();
    const generatedAt = formatGeneratedTimestamp(new Date());
    const generatedBy = session.user?.name?.trim() || session.user?.email?.trim() || null;
    const queryResult = await queryNoteMonitorReportRecords(normalized);
    const rows = queryResult.rows;

    if (rows.length > 0) {
      console.info(
        `[note-monitor-export] Exporting ${rows.length} record(s) (total matching: ${queryResult.totalCount})`,
      );
    } else if (queryResult.totalCount > 0) {
      console.warn(
        `[note-monitor-export] Query returned 0 rows but totalCount is ${queryResult.totalCount}`,
      );
    }

    const workbook = buildNoteMonitorReportWorkbook({
      generatedAt,
      generatedBy,
      filters: normalized,
      rows,
    });
    const fileName = buildNoteMonitorReportFileName(normalized);
    const contentBase64 = workbookToBase64(workbook);
    if (!isValidXlsxBase64(contentBase64)) {
      return { success: false, message: "Failed to export Note Monitor report. Please try again." };
    }

    await logNoteMonitorExport({
      action: "exported_report",
      targetLabel: buildNoteMonitorReportAuditLabel(normalized),
      metadata: {
        fileName,
        recordCount: rows.length,
        filters: normalized,
      },
    });

    return {
      success: true,
      fileName,
      contentBase64,
      mimeType: NOTE_MONITOR_EXCEL_MIME,
      recordCount: rows.length,
    };
  } catch {
    return { success: false, message: "Failed to export Note Monitor report. Please try again." };
  }
}

export async function exportNoteMonitorNoteAction(
  recordId: string,
): Promise<NoteMonitorExportActionResult> {
  const auth = await requirePermission("noteMonitor.view");
  if (!auth) {
    return { success: false, message: "You do not have permission to export Note Monitor records." };
  }

  const trimmedId = recordId?.trim();
  if (!trimmedId) {
    return { success: false, message: "A note record is required for export." };
  }

  try {
    const record = await getNoteMonitorReportRecordForExport(trimmedId);
    if (!record) {
      return { success: false, message: "Note record not found." };
    }

    const session = await getSession();
    const generatedAt = formatGeneratedTimestamp(new Date());
    const generatedBy = session.user?.name?.trim() || session.user?.email?.trim() || null;
    const workbook = buildNoteMonitorNoteWorkbook({
      record,
      generatedAt,
      generatedBy,
    });
    const fileName = buildNoteMonitorNoteFileName(record.displayReference);
    const contentBase64 = workbookToBase64(workbook);
    if (!isValidXlsxBase64(contentBase64)) {
      return { success: false, message: "Failed to export note record. Please try again." };
    }

    await logNoteMonitorExport({
      action: "exported_report",
      targetLabel: buildNoteMonitorIndividualExportAuditDescription(record.displayReference),
      metadata: {
        fileName,
        displayReference: record.displayReference,
        recordCount: 1,
      },
    });

    return {
      success: true,
      fileName,
      contentBase64,
      mimeType: NOTE_MONITOR_EXCEL_MIME,
      recordCount: 1,
    };
  } catch {
    return { success: false, message: "Failed to export note record. Please try again." };
  }
}

export async function previewNoteMonitorReportAction(
  filters: NoteMonitorReportFilters = {},
): Promise<{
  rows: import("@/lib/server/note-monitor-reports").NoteMonitorReportRow[];
  totalCount: number;
  filters: NoteMonitorReportFilters;
  validationError: string | null;
}> {
  const auth = await requirePermission("noteMonitor.view");
  if (!auth) {
    return {
      rows: [],
      totalCount: 0,
      filters: normalizeNoteMonitorReportFilters(filters),
      validationError: "Unauthorized",
    };
  }

  const normalized = normalizeNoteMonitorReportFilters(filters);
  const validationError = validateNoteMonitorReportFilters(normalized);
  if (validationError) {
    return { rows: [], totalCount: 0, filters: normalized, validationError };
  }

  const result = await queryNoteMonitorReportRecords(normalized, { limit: 100 });
  return { ...result, validationError: null };
}
