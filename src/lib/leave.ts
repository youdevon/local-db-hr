export const LEAVE_TYPE_OPTIONS = [
  { value: "sick", label: "Sick Leave" },
  { value: "vacation", label: "Vacation Leave" },
  { value: "maternity", label: "Maternity Leave" },
  { value: "paternity", label: "Paternity Leave" },
  { value: "extended", label: "Extended Leave" },
  { value: "casual", label: "Casual Leave" },
  { value: "compassionate", label: "Compassionate Leave" },
  { value: "study", label: "Study Leave" },
  { value: "no_pay", label: "No-Pay Leave" },
  { value: "other", label: "Other" },
] as const;

export type LeaveType = (typeof LEAVE_TYPE_OPTIONS)[number]["value"];

export function getLeaveTypeLabel(leaveType: string): string {
  const match = LEAVE_TYPE_OPTIONS.find((item) => item.value === leaveType);
  if (match) return match.label;
  return leaveType
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatDateLabel(isoDate: string | null | undefined): string {
  if (!isoDate) return "—";
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export function formatContractPeriod(startDate?: string | null, endDate?: string | null): string {
  if (!startDate || !endDate) return "—";
  return `${formatDateLabel(startDate)} – ${formatDateLabel(endDate)}`;
}

export function toDateOnly(value: string | Date): Date | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function calculateInclusiveLeaveDays(startDate: string | Date, endDate: string | Date): number {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  if (!start || !end || end < start) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function formatLeaveDays(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(Number(value));
  if (rounded === 1) return "1 day";
  return `${rounded} days`;
}

export const formatDays = formatLeaveDays;
