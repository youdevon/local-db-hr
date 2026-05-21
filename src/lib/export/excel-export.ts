import * as XLSX from "xlsx-js-style";

import { cleanExcelValue } from "@/lib/export/excel-sanitize";

import {
  EXCEL_LAYOUT,
  EXCEL_MIME_TYPE,
  EXCEL_STYLES,
  buildTableBodyStyle,
  excelDateStamp,
  formatExcelDisplayDate,
  resolveOrganizationName,
  type AuditExcelRow,
  type CellStyle,
  type ExcelExportValue,
} from "@/lib/export/excel-style";

export type {
  AuditExcelRow,
  CellStyle,
  ExcelBodyStyleOptions,
  ExcelExportValue,
  ExcelStatusTone,
  TableBodyStyleOptions,
} from "@/lib/export/excel-style";

export {
  DEFAULT_ORGANIZATION_NAME,
  DEFAULT_WRAP_COLUMN_WIDTH,
  EXCEL_COLORS,
  EXCEL_DATE_DISPLAY_LOCALE,
  EXCEL_DATE_DISPLAY_OPTIONS,
  EXCEL_DATE_NUM_FMT,
  EXCEL_FONTS,
  EXCEL_LAYOUT,
  EXCEL_MIME_TYPE,
  EXCEL_STYLES,
  STATUS_TONE_MAP,
  THIN_BORDER,
  buildTableBodyStyle,
  excelDateStamp,
  formatExcelDisplayDate,
  normalizeStatusKey,
  prettyExcelFilters,
  resolveOrganizationName,
  resolveStatusTone,
  tableBodyStyleForColumn,
} from "@/lib/export/excel-style";

export { cleanExcelValue } from "@/lib/export/excel-sanitize";

export type ExcelCellValue = string | number | boolean | Date | null | undefined;

/** @deprecated Prefer {@link ExcelCellValue} for styled exports. */
export type GenericExportValue = ExcelExportValue;

export type ExcelColumnAlign = "left" | "center" | "right";

export type ExcelColumnDef<TRow extends Record<string, ExcelCellValue>> = {
  key: keyof TRow & string;
  header: string;
  width?: number;
  wrapText?: boolean;
  isLongText?: boolean;
  isDate?: boolean;
  isStatus?: boolean;
  align?: ExcelColumnAlign;
};

export type ExcelReportHeader = {
  title: string;
  generatedAt: string;
  generatedBy?: string | null;
  filtersUsed?: Record<string, unknown> | string | null;
  totalRecords?: number;
  organizationName?: string | null;
};

export type StyledWorkbookSheetConfig<TRow extends Record<string, ExcelCellValue>> = {
  sheetName: string;
  header: ExcelReportHeader;
  columns: ExcelColumnDef<TRow>[];
  rows: TRow[];
  alternateRowShading?: boolean;
  emptyMessage?: string;
};

export type BuildStyledWorkbookConfig<TRow extends Record<string, ExcelCellValue>> =
  | StyledWorkbookSheetConfig<TRow>
  | {
      sheets: StyledWorkbookSheetConfig<TRow>[];
    };

export type ExcelSheetExportMeta = {
  sheetName: string;
  headerRow1Based: number;
  landscape?: boolean;
  repeatHeader?: boolean;
};

export type ExcelWorkbookExportMeta = {
  sheets: ExcelSheetExportMeta[];
};

export const EXCEL_EXPORT_META_KEY = "__excelExportMeta" as const;

export type WorkbookToBase64Options = {
  landscape?: boolean;
  repeatHeader?: boolean;
  meta?: ExcelWorkbookExportMeta;
};

function isMultiSheetConfig<TRow extends Record<string, ExcelCellValue>>(
  config: BuildStyledWorkbookConfig<TRow>,
): config is { sheets: StyledWorkbookSheetConfig<TRow>[] } {
  return "sheets" in config;
}

function prettyFilters(filters: Record<string, unknown> | string | null | undefined): string {
  if (typeof filters === "string") {
    const trimmed = filters.trim();
    return trimmed.length > 0 ? trimmed : "None";
  }
  if (!filters) return "None";

  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });

  if (!entries.length) return "None";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

export function cellValue(value: ExcelCellValue): string | number {
  if (value instanceof Date) {
    return cleanExcelValue(formatExcelDisplayDate(value));
  }
  return cleanExcelValue(value);
}

export function setCell(
  ws: XLSX.WorkSheet,
  row: number,
  col: number,
  value: ExcelCellValue,
  style?: CellStyle,
): void {
  const ref = XLSX.utils.encode_cell({ r: row, c: col });
  const raw = cellValue(value);
  const isNumber = typeof raw === "number";
  ws[ref] = {
    t: isNumber ? "n" : "s",
    v: raw,
    ...(style ? { s: style } : {}),
  };
}

export function estimateWrappedRowHeight(text: string, columnWidthChars: number): number {
  const content = text.trim();
  if (!content) return EXCEL_LAYOUT.defaultRowHeight;

  const charsPerLine = Math.max(20, Math.floor(columnWidthChars * 0.9));
  const lines = content.split(/\r?\n/);
  let totalLines = 0;

  for (const line of lines) {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }

  return Math.min(
    EXCEL_LAYOUT.maxRowHeight,
    Math.max(
      EXCEL_LAYOUT.defaultRowHeight,
      totalLines * EXCEL_LAYOUT.wrappedLineHeight + EXCEL_LAYOUT.wrappedRowPadding,
    ),
  );
}

export function updateSheetRange(ws: XLSX.WorkSheet, maxRow: number, maxCol: number): void {
  ws["!ref"] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: maxRow, c: maxCol },
  });
}

export function initRowHeights(rowCount: number): Array<{ hpt?: number } | null> {
  return Array.from({ length: rowCount }, () => ({ hpt: EXCEL_LAYOUT.defaultRowHeight }));
}

export function writeMetaSection(
  ws: XLSX.WorkSheet,
  rows: Array<[string, ExcelCellValue]>,
): number {
  let metaRowCount = 0;

  rows.forEach(([label, value], index) => {
    if (!label && (value === null || value === undefined || value === "")) return;
    setCell(ws, index, 0, label, EXCEL_STYLES.metaLabel);
    setCell(ws, index, 1, value, EXCEL_STYLES.metaValue);
    metaRowCount = index + 1;
  });

  return metaRowCount;
}

export function writeTableHeaderRow(
  ws: XLSX.WorkSheet,
  row: number,
  headers: readonly string[] | string[],
): void {
  headers.forEach((header, col) => {
    setCell(ws, row, col, header, EXCEL_STYLES.tableHeader);
  });
}

function resolveColumnWidth<TRow extends Record<string, ExcelCellValue>>(
  column: ExcelColumnDef<TRow>,
): number {
  if (column.width !== undefined) return column.width;
  if (column.isLongText) return EXCEL_LAYOUT.longTextColumnWidth;
  return EXCEL_LAYOUT.defaultColumnWidth;
}

function resolveColumnAlign<TRow extends Record<string, ExcelCellValue>>(
  column: ExcelColumnDef<TRow>,
): ExcelColumnAlign {
  if (column.align) return column.align;
  if (column.isDate || column.isStatus) return "center";
  return "left";
}

function shouldWrapColumn<TRow extends Record<string, ExcelCellValue>>(
  column: ExcelColumnDef<TRow>,
): boolean {
  return Boolean(column.wrapText || column.isLongText);
}

function formatCellValue<TRow extends Record<string, ExcelCellValue>>(
  column: ExcelColumnDef<TRow>,
  row: TRow,
): ExcelCellValue {
  const raw = row[column.key];
  if (column.isDate) {
    if (raw === null || raw === undefined || raw === "") return "";
    if (typeof raw === "string" || raw instanceof Date) {
      return formatExcelDisplayDate(raw);
    }
  }
  return raw;
}

function buildMetaRows<TRow extends Record<string, ExcelCellValue>>(
  header: ExcelReportHeader,
  rowCount: number,
): Array<[string, ExcelCellValue]> {
  return [
    ["Report Title", header.title],
    ["Generated At", header.generatedAt],
    ["Generated By", header.generatedBy?.trim() || "—"],
    ["Filters Used", prettyFilters(header.filtersUsed)],
    ["Total Records", header.totalRecords ?? rowCount],
    ["Organization", resolveOrganizationName(header.organizationName)],
  ];
}

const AUTO_FILTER_REF_PATTERN = /^[A-Z]{1,3}[1-9]\d*:[A-Z]{1,3}[1-9]\d*$/;

export function isSafeAutoFilterRef(
  ref: string,
  maxRow0: number,
  maxCol0: number,
): boolean {
  if (!AUTO_FILTER_REF_PATTERN.test(ref)) return false;

  try {
    const range = XLSX.utils.decode_range(ref);
    if (range.s.r < 0 || range.s.c < 0) return false;
    if (range.s.r > range.e.r || range.s.c > range.e.c) return false;
    if (range.e.r > maxRow0 || range.e.c > maxCol0) return false;
    return true;
  } catch {
    return false;
  }
}

export function applyWorksheetLayout(
  ws: XLSX.WorkSheet,
  input: {
    cols: Array<{ wch: number }>;
    rows?: Array<{ hpt?: number } | null>;
    autofilterRef?: string;
    sheetName?: string;
    maxRow0?: number;
    maxCol0?: number;
  },
): void {
  ws["!cols"] = input.cols;
  if (input.rows?.length) {
    ws["!rows"] = input.rows as XLSX.RowInfo[];
  }
  if (
    input.autofilterRef &&
    input.maxRow0 !== undefined &&
    input.maxCol0 !== undefined &&
    isSafeAutoFilterRef(input.autofilterRef, input.maxRow0, input.maxCol0)
  ) {
    ws["!autofilter"] = { ref: input.autofilterRef };
  }
  ws["!margins"] = {
    left: 0.5,
    right: 0.5,
    top: 0.75,
    bottom: 0.75,
    header: 0.3,
    footer: 0.3,
  };
  if (input.sheetName) {
    ws["!name"] = input.sheetName;
  }
}

function buildStyledSheet<TRow extends Record<string, ExcelCellValue>>(
  config: StyledWorkbookSheetConfig<TRow>,
): { worksheet: XLSX.WorkSheet; meta: ExcelSheetExportMeta } {
  const ws: XLSX.WorkSheet = {};
  const { columns, rows, header, alternateRowShading = true } = config;
  const lastCol = Math.max(columns.length - 1, 0);
  const metaRows = buildMetaRows(header, rows.length);
  const headerRow0 = metaRows.length + EXCEL_LAYOUT.metaBlankRowsAfter;
  const columnWidths = columns.map(resolveColumnWidth);

  writeMetaSection(ws, metaRows);
  writeTableHeaderRow(ws, headerRow0, columns.map((column) => column.header));

  const rowHeights = initRowHeights(headerRow0 + 1);

  let currentRow = headerRow0 + 1;
  const emptyMessage = config.emptyMessage ?? "No records found for the selected filters.";

  if (rows.length > 0) {
    rows.forEach((row, rowIndex) => {
      let rowHeight: number = EXCEL_LAYOUT.defaultRowHeight;

      columns.forEach((column, col) => {
        const value = formatCellValue(column, row);
        const align = resolveColumnAlign(column);
        const wrap = shouldWrapColumn(column);
        const statusText = column.isStatus ? String(cellValue(value)) : undefined;
        const style = buildTableBodyStyle({
          align,
          wrapText: wrap,
          alternateFill: alternateRowShading && rowIndex % 2 === 1,
          status: statusText,
        });

        setCell(ws, currentRow, col, value, style);

        if (wrap) {
          rowHeight = Math.max(
            rowHeight,
            estimateWrappedRowHeight(
              String(cellValue(value)),
              columnWidths[col] ?? EXCEL_LAYOUT.defaultColumnWidth,
            ),
          );
        }
      });

      rowHeights[currentRow] = { hpt: rowHeight };
      currentRow += 1;
    });
  } else {
    setCell(ws, currentRow, 0, emptyMessage, EXCEL_STYLES.notice);
    currentRow += 1;
  }

  const maxRow0 = Math.max(currentRow - 1, headerRow0);

  updateSheetRange(ws, maxRow0, lastCol);

  const headerRow1Based = headerRow0 + 1;
  const lastDataRow1Based = currentRow;

  applyWorksheetLayout(ws, {
    cols: columnWidths.map((wch) => ({ wch })),
    rows: rowHeights,
    autofilterRef:
      rows.length > 0
        ? `A${headerRow1Based}:${XLSX.utils.encode_col(lastCol)}${lastDataRow1Based}`
        : undefined,
    maxRow0,
    maxCol0: lastCol,
    sheetName: config.sheetName,
  });

  return {
    worksheet: ws,
    meta: {
      sheetName: config.sheetName,
      headerRow1Based,
      landscape: true,
      repeatHeader: true,
    },
  };
}

function attachWorkbookMeta(workbook: XLSX.WorkBook, meta: ExcelWorkbookExportMeta): XLSX.WorkBook {
  (workbook as XLSX.WorkBook & { [EXCEL_EXPORT_META_KEY]?: ExcelWorkbookExportMeta })[EXCEL_EXPORT_META_KEY] =
    meta;
  return workbook;
}

export function getWorkbookExportMeta(workbook: XLSX.WorkBook): ExcelWorkbookExportMeta | undefined {
  return (workbook as XLSX.WorkBook & { [EXCEL_EXPORT_META_KEY]?: ExcelWorkbookExportMeta })[
    EXCEL_EXPORT_META_KEY
  ];
}

export function buildStyledWorkbook<TRow extends Record<string, ExcelCellValue>>(
  config: BuildStyledWorkbookConfig<TRow>,
): XLSX.WorkBook {
  const sheetConfigs = isMultiSheetConfig(config) ? config.sheets : [config];
  const workbook = XLSX.utils.book_new();
  const metaSheets: ExcelSheetExportMeta[] = [];

  for (const sheetConfig of sheetConfigs) {
    const { worksheet, meta } = buildStyledSheet(sheetConfig);
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetConfig.sheetName);
    metaSheets.push(meta);
  }

  return attachWorkbookMeta(workbook, { sheets: metaSheets });
}

function normalizeWriteResult(raw: unknown): Uint8Array {
  if (raw instanceof Uint8Array) return raw;
  if (raw instanceof ArrayBuffer) return new Uint8Array(raw);
  if (Array.isArray(raw)) return Uint8Array.from(raw);
  throw new Error("Unexpected workbook write result");
}

/** Browser-safe write (cell styles, autofilter, and layout metadata preserved). */
export function writeWorkbookBytes(workbook: XLSX.WorkBook): Uint8Array {
  return normalizeWriteResult(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
}

export { EXCEL_MIME_TYPE as STYLED_EXCEL_MIME_TYPE };
