import * as XLSX from "xlsx-js-style";

import {
  buildAuditTrailExportWorkbook,
  buildReportExportWorkbook,
  sanitizeExportFileName,
  slugifyExportFileName,
  type AuditExcelExportOptions,
  type ReportExcelExportInput,
  type ReportExportColumn,
} from "@/lib/export/excel-export-build";
import { writeWorkbookBytes, type AuditExcelRow, type ExcelExportValue } from "@/lib/export/excel-export";
import { EXCEL_MIME_TYPE } from "@/lib/export/excel-style";

export {
  sanitizeExportFileName,
  slugifyExportFileName,
  type AuditExcelExportOptions,
  type ReportExcelExportInput,
  type ReportExportColumn,
} from "@/lib/export/excel-export-build";

function assertValidXlsxBytes(bytes: Uint8Array): void {
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
    throw new Error("Generated workbook is not a valid XLSX file");
  }
}

export function writeStyledWorkbookBytesForDownload(workbook: XLSX.WorkBook): Uint8Array {
  const raw = writeWorkbookBytes(workbook);
  assertValidXlsxBytes(raw);
  return raw;
}

export function downloadWorkbookFile(workbook: XLSX.WorkBook, fileName: string): void {
  const bytes = writeStyledWorkbookBytesForDownload(workbook);
  const blob = new Blob([new Uint8Array(bytes)], { type: EXCEL_MIME_TYPE });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = sanitizeExportFileName(fileName);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function buildWorkbookFromJsonRows(input: {
  rows: Array<Record<string, ExcelExportValue>>;
  sheetName?: string;
  skipHeader?: boolean;
}): XLSX.WorkBook {
  const worksheet = XLSX.utils.json_to_sheet(input.rows, {
    skipHeader: input.skipHeader ?? false,
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, input.sheetName ?? "Sheet1");
  return workbook;
}

export function downloadJsonRowsAsExcel(input: {
  rows: Array<Record<string, ExcelExportValue>>;
  fileName: string;
  sheetName?: string;
}): void {
  downloadWorkbookFile(buildWorkbookFromJsonRows(input), input.fileName);
}

export function exportReportToExcel(input: ReportExcelExportInput & { fileName: string }): void {
  const workbook = buildReportExportWorkbook(input);
  downloadWorkbookFile(workbook, input.fileName);
}

export function exportAuditTrailToExcel(
  rows: AuditExcelRow[],
  options: AuditExcelExportOptions & { fileName?: string } = {},
): void {
  const workbook = buildAuditTrailExportWorkbook(rows, options);
  downloadWorkbookFile(workbook, options.fileName ?? slugifyExportFileName("audit-trail"));
}
