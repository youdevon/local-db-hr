import type XLSX from "xlsx-js-style";

export type CellStyle = XLSX.CellStyle;

/** Simple value type for unstyled JSON-to-sheet exports. */
export type ExcelExportValue = string | number | null | undefined;

export type AuditExcelRow = {
  "Date / Time": string;
  "Audit Type": string;
  "Who Attempted It": string;
  Action: string;
  Target: string;
  Summary?: string;
  Module: string;
  Success: string;
  "Failure Reason": string;
  "IP Address": string;
  "Device Name": string;
};

/** Matches {@link DEFAULT_COMPANY_NAME} in branding; kept here so exports work client-side. */
export const DEFAULT_ORGANIZATION_NAME = "Local DB HR" as const;

export const EXCEL_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" as const;

export const EXCEL_DATE_DISPLAY_LOCALE = "en-TT" as const;

export const EXCEL_DATE_DISPLAY_OPTIONS: Intl.DateTimeFormatOptions = {
  year: "numeric",
  month: "short",
  day: "numeric",
};

/** Excel number format string for date cells when storing native date values. */
export const EXCEL_DATE_NUM_FMT = "dd mmm yyyy" as const;

export const EXCEL_COLORS = {
  reportTitle: "1F3864",
  metaLabelText: "404040",
  metaLabelFill: "F2F2F2",
  tableHeaderFill: "4472C4",
  tableHeaderText: "FFFFFF",
  border: "D0D0D0",
  bodyText: "000000",
  noticeText: "666666",
  rowAltFill: "F7F9FC",
  status: {
    pending: { fill: "FFF4CE", text: "7A5C00" },
    confirmed: { fill: "E2F0D9", text: "375623" },
    approved: { fill: "E2F0D9", text: "375623" },
    rejected: { fill: "FCE4D6", text: "9C0006" },
    denied: { fill: "FCE4D6", text: "9C0006" },
    cancelled: { fill: "F2F2F2", text: "595959" },
    canceled: { fill: "F2F2F2", text: "595959" },
    draft: { fill: "EDEDED", text: "595959" },
    active: { fill: "DDEBF7", text: "1F4E79" },
    inactive: { fill: "F2F2F2", text: "595959" },
    expired: { fill: "F2F2F2", text: "595959" },
    completed: { fill: "E2F0D9", text: "375623" },
    open: { fill: "DDEBF7", text: "1F4E79" },
    closed: { fill: "EDEDED", text: "595959" },
    success: { fill: "E2F0D9", text: "375623" },
    failed: { fill: "FCE4D6", text: "9C0006" },
    healthy: { fill: "E2F0D9", text: "375623" },
    low: { fill: "FFF4CE", text: "7A5C00" },
    overused: { fill: "FCE4D6", text: "9C0006" },
    exhausted: { fill: "F2F2F2", text: "595959" },
    default: { fill: "F9F9F9", text: "404040" },
  },
} as const;

export const EXCEL_FONTS = {
  reportTitleSize: 16,
  metaSize: 10,
  tableHeaderSize: 10,
  bodySize: 10,
} as const;

export const EXCEL_LAYOUT = {
  defaultColumnWidth: 14,
  longTextColumnWidth: 65,
  defaultRowHeight: 18,
  maxRowHeight: 240,
  wrappedLineHeight: 15,
  wrappedRowPadding: 6,
  metaBlankRowsAfter: 1,
} as const;

export const DEFAULT_WRAP_COLUMN_WIDTH = EXCEL_LAYOUT.longTextColumnWidth;

export const THIN_BORDER = {
  top: { style: "thin" as const, color: { rgb: EXCEL_COLORS.border } },
  bottom: { style: "thin" as const, color: { rgb: EXCEL_COLORS.border } },
  left: { style: "thin" as const, color: { rgb: EXCEL_COLORS.border } },
  right: { style: "thin" as const, color: { rgb: EXCEL_COLORS.border } },
};

export type ExcelStatusTone = {
  fill: string;
  text: string;
};

export const STATUS_TONE_MAP: Record<string, ExcelStatusTone> = {
  pending: EXCEL_COLORS.status.pending,
  confirmed: EXCEL_COLORS.status.confirmed,
  approved: EXCEL_COLORS.status.approved,
  rejected: EXCEL_COLORS.status.rejected,
  denied: EXCEL_COLORS.status.denied,
  cancelled: EXCEL_COLORS.status.cancelled,
  canceled: EXCEL_COLORS.status.canceled,
  draft: EXCEL_COLORS.status.draft,
  active: EXCEL_COLORS.status.active,
  inactive: EXCEL_COLORS.status.inactive,
  expired: EXCEL_COLORS.status.expired,
  completed: EXCEL_COLORS.status.completed,
  open: EXCEL_COLORS.status.open,
  closed: EXCEL_COLORS.status.closed,
  success: EXCEL_COLORS.status.success,
  failed: EXCEL_COLORS.status.failed,
  healthy: EXCEL_COLORS.status.healthy,
  low: EXCEL_COLORS.status.low,
  overused: EXCEL_COLORS.status.overused,
  exhausted: EXCEL_COLORS.status.exhausted,
};

export function normalizeStatusKey(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveStatusTone(status: string): ExcelStatusTone {
  const key = normalizeStatusKey(status);
  return STATUS_TONE_MAP[key] ?? EXCEL_COLORS.status.default;
}

export function resolveOrganizationName(name?: string | null): string {
  const trimmed = name?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT_ORGANIZATION_NAME;
}

export function formatExcelDisplayDate(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(EXCEL_DATE_DISPLAY_LOCALE, EXCEL_DATE_DISPLAY_OPTIONS);
}

export function prettyExcelFilters(filters: Record<string, unknown>): string {
  const entries = Object.entries(filters).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    return true;
  });
  if (!entries.length) return "None";
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join(" | ");
}

export function excelDateStamp(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export const EXCEL_STYLES = {
  reportTitle: {
    font: { bold: true, sz: EXCEL_FONTS.reportTitleSize, color: { rgb: EXCEL_COLORS.reportTitle } },
    alignment: { vertical: "center" },
  } satisfies CellStyle,
  metaLabel: {
    font: { bold: true, sz: EXCEL_FONTS.metaSize, color: { rgb: EXCEL_COLORS.metaLabelText } },
    fill: { fgColor: { rgb: EXCEL_COLORS.metaLabelFill } },
    alignment: { vertical: "top" },
    border: THIN_BORDER,
  } satisfies CellStyle,
  metaValue: {
    font: { sz: EXCEL_FONTS.metaSize },
    alignment: { vertical: "top", wrapText: true },
    border: THIN_BORDER,
  } satisfies CellStyle,
  tableHeader: {
    font: {
      bold: true,
      sz: EXCEL_FONTS.tableHeaderSize,
      color: { rgb: EXCEL_COLORS.tableHeaderText },
    },
    fill: { fgColor: { rgb: EXCEL_COLORS.tableHeaderFill } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: THIN_BORDER,
  } satisfies CellStyle,
  tableBody: {
    font: { sz: EXCEL_FONTS.bodySize },
    alignment: { vertical: "top" },
    border: THIN_BORDER,
  } satisfies CellStyle,
  tableBodyCenter: {
    font: { sz: EXCEL_FONTS.bodySize },
    alignment: { horizontal: "center", vertical: "top" },
    border: THIN_BORDER,
  } satisfies CellStyle,
  tableBodyRight: {
    font: { sz: EXCEL_FONTS.bodySize },
    alignment: { horizontal: "right", vertical: "top" },
    border: THIN_BORDER,
  } satisfies CellStyle,
  tableBodyWrap: {
    font: { sz: EXCEL_FONTS.bodySize },
    alignment: { vertical: "top", wrapText: true },
    border: THIN_BORDER,
  } satisfies CellStyle,
  fieldLabel: {
    font: { bold: true, sz: EXCEL_FONTS.metaSize, color: { rgb: EXCEL_COLORS.metaLabelText } },
    fill: { fgColor: { rgb: EXCEL_COLORS.metaLabelFill } },
    alignment: { vertical: "top" },
    border: THIN_BORDER,
  } satisfies CellStyle,
  fieldValue: {
    font: { sz: EXCEL_FONTS.metaSize },
    alignment: { vertical: "top", wrapText: true },
    border: THIN_BORDER,
  } satisfies CellStyle,
  notice: {
    font: { italic: true, sz: EXCEL_FONTS.bodySize, color: { rgb: EXCEL_COLORS.noticeText } },
    alignment: { vertical: "top" },
  } satisfies CellStyle,
} as const;

export type ExcelBodyStyleOptions = {
  align?: "left" | "center" | "right";
  wrapText?: boolean;
  alternateFill?: boolean;
  status?: string;
};

export function buildTableBodyStyle(options: ExcelBodyStyleOptions = {}): CellStyle {
  const { align = "left", wrapText = false, alternateFill = false, status } = options;

  const style: CellStyle = {
    font: { sz: EXCEL_FONTS.bodySize, color: { rgb: EXCEL_COLORS.bodyText } },
    alignment: {
      horizontal: align,
      vertical: "top",
      wrapText,
    },
    border: THIN_BORDER,
  };

  if (status) {
    const tone = resolveStatusTone(status);
    style.fill = { fgColor: { rgb: tone.fill } };
    style.font = { ...style.font, color: { rgb: tone.text } };
  } else if (alternateFill) {
    style.fill = { fgColor: { rgb: EXCEL_COLORS.rowAltFill } };
  }

  return style;
}

export type TableBodyStyleOptions = {
  wrapColumns?: Set<number>;
  numberColumns?: Set<number>;
  dateColumns?: Set<number>;
  statusColumns?: Set<number>;
  alternateFill?: boolean;
};

export function tableBodyStyleForColumn(
  colIndex: number,
  options: TableBodyStyleOptions = {},
  statusValue?: string,
): CellStyle {
  if (options.statusColumns?.has(colIndex) && statusValue) {
    return buildTableBodyStyle({ align: "center", status: statusValue });
  }
  if (options.wrapColumns?.has(colIndex)) {
    return buildTableBodyStyle({ wrapText: true, alternateFill: options.alternateFill });
  }
  if (options.numberColumns?.has(colIndex)) {
    return buildTableBodyStyle({ align: "right", alternateFill: options.alternateFill });
  }
  if (options.dateColumns?.has(colIndex)) {
    return buildTableBodyStyle({ align: "center", alternateFill: options.alternateFill });
  }
  return buildTableBodyStyle({ alternateFill: options.alternateFill });
}
