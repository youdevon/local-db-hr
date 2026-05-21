/** Control characters illegal in XML 1.0 (except tab, LF, CR). */
const INVALID_XML_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

export function stripInvalidXmlChars(value: string): string {
  return value.replace(INVALID_XML_CHARS, "");
}

export type SafeCellValueOptions = {
  /** Shown when value is null, undefined, or blank after trim. Default: empty string. */
  emptyDisplay?: string;
};

/** Sanitize a cell value for safe XLSX/XML export (alias: {@link cleanExcelValue}). */
export function safeCellValue(
  value: unknown,
  options: SafeCellValueOptions = {},
): string | number {
  return cleanExcelValue(value, options);
}

/** Sanitize any value before writing it to an Excel cell. */
export function cleanExcelValue(
  value: unknown,
  options: SafeCellValueOptions = {},
): string | number {
  const emptyDisplay = options.emptyDisplay ?? "";

  if (value === null || value === undefined) {
    return emptyDisplay;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : emptyDisplay;
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value instanceof Date) {
    const text = stripInvalidXmlChars(value.toISOString());
    return text.length > 0 ? text : emptyDisplay;
  }

  const text = stripInvalidXmlChars(String(value).trim());
  return text.length > 0 ? text : emptyDisplay;
}
