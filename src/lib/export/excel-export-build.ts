import * as XLSX from "xlsx-js-style";

import {
  buildStyledWorkbook,
  type ExcelCellValue,
  type ExcelColumnDef,
} from "@/lib/export/excel-export";
import { cleanExcelValue } from "@/lib/export/excel-sanitize";
import { EXCEL_LAYOUT, type AuditExcelRow, type ExcelExportValue, excelDateStamp } from "@/lib/export/excel-style";

export function sanitizeExportFileName(fileName: string): string {
  const trimmed = fileName.trim();
  const withExtension = trimmed.toLowerCase().endsWith(".xlsx") ? trimmed : `${trimmed}.xlsx`;
  return withExtension.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
}

export function slugifyExportFileName(title: string, dateStamp = excelDateStamp()): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return sanitizeExportFileName(`${slug || "export"}-${dateStamp}.xlsx`);
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const UUID_COLUMN_KEY_PATTERN = /^(id|.*Id|.*_id|uuid)$/i;

const LONG_TEXT_COLUMN_KEYS = new Set([
  "details",
  "summary",
  "failureReason",
  "target",
  "deviceName",
  "linkedContracts",
  "contractPeriod",
  "notes",
  "description",
]);

function isUuidValue(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isUuidColumnKey(key: string): boolean {
  return UUID_COLUMN_KEY_PATTERN.test(key);
}

export type ReportExportColumn = {
  key: string;
  label: string;
  type: string;
};

function resolveReportExportColumns(
  columns: ReportExportColumn[] | undefined,
  rows: Array<Record<string, ExcelExportValue>>,
): ReportExportColumn[] {
  const sourceColumns =
    columns ??
    (rows.length > 0
      ? Object.keys(rows[0]).map((key) => ({ key, label: key, type: "text" }))
      : []);

  return sourceColumns.filter((column) => !isUuidColumnKey(column.key));
}

function reportColumnToExcelDef(
  column: ReportExportColumn,
): ExcelColumnDef<Record<string, ExcelCellValue>> {
  const isStatus = column.type === "status";
  const isDate = column.type === "date";
  const isNumber = column.type === "number" || column.type === "currency" || column.type === "days";
  const isLongText = LONG_TEXT_COLUMN_KEYS.has(column.key);

  return {
    key: column.key,
    header: column.label,
    isStatus,
    isDate,
    isLongText,
    wrapText: isLongText,
    align: isNumber ? "right" : isStatus || isDate ? "center" : "left",
    width: isLongText ? EXCEL_LAYOUT.longTextColumnWidth : undefined,
  };
}

export type ReportExcelExportInput = {
  title: string;
  generatedAt: string;
  filtersApplied?: Record<string, unknown> | string | null;
  rows: Array<Record<string, ExcelExportValue>>;
  columns?: ReportExportColumn[];
  includeMetadata?: boolean;
};

export function buildReportExportWorkbook(input: ReportExcelExportInput): XLSX.WorkBook {
  const exportColumns = resolveReportExportColumns(input.columns, input.rows);
  const exportRows = input.rows.map((row) => {
    const next: Record<string, ExcelCellValue> = {};
    for (const column of exportColumns) {
      const value = row[column.key];
      next[column.key] = isUuidValue(value)
        ? "—"
        : cleanExcelValue(value, { emptyDisplay: "—" });
    }
    return next;
  });

  return buildStyledWorkbook({
    sheetName: "Report",
    header: {
      title: input.title,
      generatedAt: input.generatedAt,
      filtersUsed: input.includeMetadata === false ? "—" : input.filtersApplied,
      totalRecords: input.rows.length,
    },
    columns: exportColumns.map(reportColumnToExcelDef),
    rows: exportRows,
  });
}

export type AuditExcelExportOptions = {
  filtersUsed?: Record<string, string> | string | null;
  generatedAt?: string;
};

const AUDIT_EXPORT_COLUMNS: ExcelColumnDef<AuditExcelRow>[] = [
  { key: "Date / Time", header: "Date / Time", width: 22 },
  { key: "Audit Type", header: "Audit Type", width: 14, align: "center" },
  { key: "Who Attempted It", header: "Who Attempted It", width: 24 },
  { key: "Action", header: "Action", width: 20 },
  { key: "Target", header: "Target", width: 28, isLongText: true, wrapText: true },
  { key: "Summary", header: "Summary", isLongText: true, wrapText: true },
  { key: "Module", header: "Module", width: 18 },
  { key: "Success", header: "Success", width: 12, isStatus: true },
  { key: "Failure Reason", header: "Failure Reason", isLongText: true, wrapText: true },
  { key: "IP Address", header: "IP Address", width: 16, align: "center" },
  { key: "Device Name", header: "Device Name", width: 24, wrapText: true },
];

export function buildAuditTrailExportWorkbook(
  rows: AuditExcelRow[],
  options: AuditExcelExportOptions = {},
): XLSX.WorkBook {
  const generatedAt =
    options.generatedAt ??
    new Date().toLocaleString("en-TT", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return buildStyledWorkbook({
    sheetName: "Audit Trail",
    header: {
      title: "Audit Trail Export",
      generatedAt,
      filtersUsed: options.filtersUsed ?? "None",
      totalRecords: rows.length,
    },
    columns: AUDIT_EXPORT_COLUMNS,
    rows,
    emptyMessage: "No audit records match the selected filters.",
  });
}
