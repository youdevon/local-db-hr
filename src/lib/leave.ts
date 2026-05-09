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

/** Returned to the client after creating/updating a leave transaction (balances from DB after sync). */
export type LeaveTransactionSummary = {
  leaveType: string;
  daysTaken: number;
  /** Null when this leave type has no entitlement row (e.g. maternity). */
  remainingDays: number | null;
  /** Phrase used after "for …" (e.g. "the 2026 leave period", "this contract period"). */
  periodLabel: string;
  /** Matching `leave_year_balances.id` when a balance row exists for this leave pool/year. */
  leaveBalanceId?: string | null;
};

export function buildLeavePeriodLabelForToast(input: {
  leaveType: string;
  contractYear: { startDate: string; endDate: string; yearNumber: number } | null;
  contractStartDate: string;
  contractEndDate: string;
}): string {
  const { leaveType, contractYear, contractStartDate, contractEndDate } = input;
  if (contractYear) {
    if (leaveType === "sick") {
      return "this contract period";
    }
    const y = new Date(`${contractYear.startDate}T12:00:00`).getFullYear();
    return `the ${y} leave period`;
  }
  return `contract period ${formatContractPeriod(contractStartDate, contractEndDate)}`;
}

function noLeaveRemainPhrase(leaveType: string): string {
  if (leaveType === "sick") return "sick leave";
  if (leaveType === "vacation" || leaveType === "casual") return "vacation leave";
  return getLeaveTypeLabel(leaveType).replace(/ Leave$/, " leave");
}

/**
 * @param verb — use "updated" when editing an existing transaction.
 */
export function formatLeaveRecordedSuccessMessage(
  summary: LeaveTransactionSummary,
  verb: "recorded" | "updated" = "recorded",
): string {
  const label = getLeaveTypeLabel(summary.leaveType).replace(/ Leave$/, " leave");
  const { daysTaken, remainingDays, periodLabel } = summary;
  const head = verb === "updated" ? `${label} updated successfully.` : `${label} recorded successfully.`;
  const takenPhrase =
    daysTaken === 1 ? "1 day was taken." : `${daysTaken} days were taken.`;

  if (remainingDays !== null) {
    let remainder = "";
    if (remainingDays === 0) {
      remainder = `No ${noLeaveRemainPhrase(summary.leaveType)} remains for ${periodLabel}.`;
    } else if (remainingDays < 0) {
      const dayWord = remainingDays === -1 ? "day" : "days";
      remainder = `Balance is now ${remainingDays} ${dayWord} for ${periodLabel}.`;
    } else if (remainingDays === 1) {
      remainder = `1 day remains for ${periodLabel}.`;
    } else {
      remainder = `${remainingDays} days remain for ${periodLabel}.`;
    }
    return `${head} ${takenPhrase} ${remainder}`;
  }

  const takenForPeriod =
    daysTaken === 1
      ? `1 day was taken for ${periodLabel}.`
      : `${daysTaken} days were taken for ${periodLabel}.`;
  return `${head} ${takenForPeriod}`;
}
