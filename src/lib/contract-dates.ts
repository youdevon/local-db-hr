function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseIsoDate(value: string): Date | null {
  if (!value) return null;
  const d = new Date(`${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function addMonthsClamped(start: Date, months: number): Date {
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  const targetFirst = new Date(year, month + months, 1, 12, 0, 0);
  const targetYear = targetFirst.getFullYear();
  const targetMonth = targetFirst.getMonth();
  const lastDayTargetMonth = new Date(targetYear, targetMonth + 1, 0, 12, 0, 0).getDate();
  const clampedDay = Math.min(day, lastDayTargetMonth);
  return new Date(targetYear, targetMonth, clampedDay, 12, 0, 0);
}

export function calculateContractEndDate(startDate: string, durationMonths: number): string {
  const start = parseIsoDate(startDate);
  if (!start || !Number.isFinite(durationMonths) || durationMonths <= 0) return "";
  const nextPeriodStart = addMonthsClamped(start, durationMonths);
  const end = new Date(nextPeriodStart);
  end.setDate(end.getDate() - 1);
  return toIsoDate(end);
}

export function contractEndDateMatchesPeriod(
  startDate: string,
  endDate: string,
  durationMonths: number,
): boolean {
  const expected = calculateContractEndDate(startDate, durationMonths);
  if (!expected || !endDate) return false;
  return expected === endDate;
}
