/** Client-side table sorting helpers (case-insensitive strings, nulls last). */

export function compareString(a: unknown, b: unknown): number {
  const sa = String(a ?? "")
    .trim()
    .toLowerCase();
  const sb = String(b ?? "")
    .trim()
    .toLowerCase();
  if (!sa && !sb) return 0;
  if (!sa) return 1;
  if (!sb) return -1;
  return sa.localeCompare(sb, undefined, { sensitivity: "base" });
}

export function compareNumber(a: unknown, b: unknown): number {
  const na = typeof a === "number" && Number.isFinite(a) ? a : Number.NaN;
  const nb = typeof b === "number" && Number.isFinite(b) ? b : Number.NaN;
  const aMissing = Number.isNaN(na);
  const bMissing = Number.isNaN(nb);
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return na - nb;
}

export function compareDateIso(a: unknown, b: unknown): number {
  const ta = toTime(a);
  const tb = toTime(b);
  const aMissing = ta === null;
  const bMissing = tb === null;
  if (aMissing && bMissing) return 0;
  if (aMissing) return 1;
  if (bMissing) return -1;
  return ta - tb;
}

function toTime(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(`${s}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }
  const parsed = Date.parse(s);
  return Number.isNaN(parsed) ? null : parsed;
}

/** Parses currency / salary display strings to a number; empty → NaN. */
export function parseCurrencyToNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "");
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Parses "5 days", "1 day", "—" from leave / dashboard cells. */
export function parseDaysLabel(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const s = String(value ?? "").trim();
  if (!s || s === "—") return Number.NaN;
  const m = s.match(/-?\d+(\.\d+)?/);
  if (!m) return Number.NaN;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : Number.NaN;
}

export type NormalizedSortKind = "text" | "number" | "date" | "currency" | "days";

export function normalizeSortValue(value: unknown, kind: NormalizedSortKind): string | number | null {
  switch (kind) {
    case "text":
      return String(value ?? "").trim().toLowerCase() || null;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? value : parseCurrencyToNumber(value);
    case "currency":
      return parseCurrencyToNumber(value);
    case "days":
      return parseDaysLabel(value);
    case "date": {
      const t = toTime(value);
      return t === null ? null : t;
    }
    default:
      return String(value ?? "").trim().toLowerCase() || null;
  }
}
