import "server-only";

import * as XLSX from "xlsx-js-style";

import {
  type WorkbookToBase64Options,
} from "@/lib/export/excel-export";
import { patchXlsxBytes, type XlsxSheetPatch } from "@/lib/export/excel-export-patch";
import { EXCEL_MIME_TYPE, type ExcelExportValue } from "@/lib/export/excel-style";

export { EXCEL_MIME_TYPE } from "@/lib/export/excel-style";
export type { ExcelExportValue } from "@/lib/export/excel-style";

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

function assertXlsxZipBuffer(buffer: Buffer): void {
  if (buffer.length < 4 || buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error("Generated workbook is not a valid XLSX zip archive");
  }
}

export function writeStyledWorkbookBuffer(
  workbook: XLSX.WorkBook,
  _options: WorkbookToBase64Options = {},
): Buffer {
  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  assertXlsxZipBuffer(raw);
  return raw;
}

export function patchXlsxBuffer(buffer: Buffer, patches: XlsxSheetPatch[]): Buffer {
  return Buffer.from(patchXlsxBytes(buffer, patches));
}

export function writeWorkbookBuffer(workbook: XLSX.WorkBook, patches: XlsxSheetPatch[]): Buffer {
  const raw = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return patchXlsxBuffer(raw, patches);
}

export function styledWorkbookToBase64(workbook: XLSX.WorkBook, patches: XlsxSheetPatch[]): string {
  return writeWorkbookBuffer(workbook, patches).toString("base64");
}

export type { XlsxSheetPatch } from "@/lib/export/excel-export-patch";

export function workbookToBase64(
  workbook: XLSX.WorkBook,
  options: WorkbookToBase64Options = {},
): string {
  return writeStyledWorkbookBuffer(workbook, options).toString("base64");
}

export function jsonRowsToExcelBase64(input: {
  rows: Array<Record<string, ExcelExportValue>>;
  sheetName?: string;
}): string {
  const workbook = buildWorkbookFromJsonRows(input);
  return workbookToBase64(workbook);
}
