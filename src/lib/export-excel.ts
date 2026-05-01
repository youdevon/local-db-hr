import * as XLSX from "xlsx";

export type AuditExcelRow = {
  "Date / Time": string;
  "Audit Type": string;
  "Who Attempted It": string;
  Action: string;
  Target: string;
  Module: string;
  Success: string;
  "Failure Reason": string;
  "IP Address": string;
  "Device Name": string;
};

export function exportAuditTrailToExcel(rows: AuditExcelRow[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Audit Trail");
  XLSX.writeFile(workbook, "audit-trail.xlsx");
}

type GenericExportValue = string | number | null | undefined;

function prettyFilters(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
  if (!entries.length) return "None";
  return entries
    .map(([key, value]) => `${key}: ${String(value)}`)
    .join(" | ");
}

export function exportReportToExcel(input: {
  title: string;
  generatedAt: string;
  filtersApplied: Record<string, unknown>;
  rows: Array<Record<string, GenericExportValue>>;
  fileName: string;
}) {
  const worksheetRows: Array<Record<string, GenericExportValue>> = [];
  worksheetRows.push({ A: "Report Title", B: input.title });
  worksheetRows.push({ A: "Generated At", B: input.generatedAt });
  worksheetRows.push({ A: "Filters Applied", B: prettyFilters(input.filtersApplied) });
  worksheetRows.push({});
  if (input.rows.length > 0) {
    worksheetRows.push(...input.rows);
  } else {
    worksheetRows.push({ Notice: "No records found for the selected filters." });
  }

  const worksheet = XLSX.utils.json_to_sheet(worksheetRows, { skipHeader: false });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Report");
  XLSX.writeFile(workbook, input.fileName);
}
