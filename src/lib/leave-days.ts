/**
 * Leave day calculations for Trinidad and Tobago working-week rules:
 * Monday–Friday count; weekends and listed public holidays excluded (inclusive range).
 */

export type LeaveCalculationMode = "working_days_tt" | "calendar_days_legacy";

export type CalculateLeaveDaysInput = {
  startDate: string;
  endDate: string;
  /** ISO date strings YYYY-MM-DD for active public holidays overlapping the range */
  holidayDates: ReadonlySet<string>;
  /** When set, this value wins (manual override) */
  manualLeaveDays?: number | null;
  calculationMode?: LeaveCalculationMode;
};

export function parseIsoLocal(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Format local calendar date as YYYY-MM-DD (no UTC shift). */
export function formatLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Iterates each calendar day from start through end inclusive. */
export function eachLocalDayInclusive(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  while (cur <= last) {
    out.push(new Date(cur.getTime()));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

/** Monday (1) through Friday (5) in local time. */
export function isWeekdayLocal(d: Date): boolean {
  const day = d.getDay();
  return day >= 1 && day <= 5;
}

/**
 * Counts working days between start and end (inclusive): weekdays excluding holiday dates.
 * Holidays on weekends do not affect the count (weekends are already excluded).
 */
export function calculateWorkingLeaveDays(
  startDate: string | Date,
  endDate: string | Date,
  holidayDates: ReadonlySet<string>,
): number {
  const start = typeof startDate === "string" ? parseIsoLocal(startDate) : parseIsoLocal(formatLocalIsoDate(startDate));
  const end = typeof endDate === "string" ? parseIsoLocal(endDate) : parseIsoLocal(formatLocalIsoDate(endDate));
  if (!start || !end || end < start) return 0;

  let n = 0;
  for (const day of eachLocalDayInclusive(start, end)) {
    if (!isWeekdayLocal(day)) continue;
    const iso = formatLocalIsoDate(day);
    if (holidayDates.has(iso)) continue;
    n += 1;
  }
  return n;
}

/** Legacy calendar inclusive count (natural days). */
export function calculateCalendarInclusiveLeaveDays(startDate: string | Date, endDate: string | Date): number {
  const start = typeof startDate === "string" ? parseIsoLocal(startDate) : parseIsoLocal(formatLocalIsoDate(startDate));
  const end = typeof endDate === "string" ? parseIsoLocal(endDate) : parseIsoLocal(formatLocalIsoDate(endDate));
  if (!start || !end || end < start) return 0;
  const msPerDay = 86400000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function calculateLeaveDays(input: CalculateLeaveDaysInput): {
  autoCalculatedDays: number;
  finalDays: number;
  usedManualOverride: boolean;
} {
  const mode = input.calculationMode ?? "working_days_tt";
  const autoCalculatedDays =
    mode === "calendar_days_legacy"
      ? calculateCalendarInclusiveLeaveDays(input.startDate, input.endDate)
      : calculateWorkingLeaveDays(input.startDate, input.endDate, input.holidayDates);

  const manual =
    input.manualLeaveDays != null && Number.isFinite(Number(input.manualLeaveDays))
      ? Math.round(Number(input.manualLeaveDays))
      : null;

  if (manual != null && manual >= 0) {
    return {
      autoCalculatedDays,
      finalDays: manual,
      usedManualOverride: manual !== autoCalculatedDays,
    };
  }

  return {
    autoCalculatedDays,
    finalDays: autoCalculatedDays,
    usedManualOverride: false,
  };
}
