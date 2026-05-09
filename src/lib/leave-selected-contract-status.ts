import { todayLocalIso } from "@/lib/contract-display-status";
import type { ContractUiStatusTone } from "@/lib/leave-contract-ui-status";
import { getLeaveContractUiStatus } from "@/lib/leave-contract-ui-status";

/** Default “approaching end” window for contract period (days from today to end date, inclusive). */
const DEFAULT_EXPIRING_WITHIN_DAYS = 90;

type LeaveDetailContract = {
  years: Array<{ yearNumber: number; startDate: string; endDate: string }>;
};

/**
 * First contractual year start through last contractual year end for a leave detail contract.
 */
export function getContractIsoBoundsFromLeaveDetailContract(
  contract: LeaveDetailContract,
): { startIso: string | null; endIso: string | null } {
  const years = contract.years;
  if (!years?.length) return { startIso: null, endIso: null };
  const sorted = [...years].sort((a, b) => a.yearNumber - b.yearNumber);
  return {
    startIso: sorted[0]!.startDate.slice(0, 10),
    endIso: sorted[sorted.length - 1]!.endDate.slice(0, 10),
  };
}

function normalizeKey(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function calendarDaysToEnd(todayIso: string, endIso: string): number {
  const t = new Date(`${todayIso}T12:00:00`).getTime();
  const e = new Date(`${endIso.slice(0, 10)}T12:00:00`).getTime();
  return Math.round((e - t) / 86_400_000);
}

/**
 * Resolves the status badge for the **selected** contract on Leave Transactions (and similar UIs).
 * Prefers date logic when start/end are known; otherwise maps stored status.
 * User-facing: Current, Expired, Upcoming, Expiring, Closed, Unknown (not "Active"/"Active" raw DB).
 */
export function resolveLeaveTransactionsContractStatus(
  storedStatusDisplay: string,
  startIso: string | null | undefined,
  endIso: string | null | undefined,
  options?: { expiringWithinDays?: number },
): { label: string; tone: ContractUiStatusTone } {
  const threshold = options?.expiringWithinDays ?? DEFAULT_EXPIRING_WITHIN_DAYS;
  const key = normalizeKey(storedStatusDisplay);

  if (["closed", "ended", "terminated", "complete", "completed"].includes(key)) {
    return { label: "Closed", tone: "muted" };
  }

  if (["expiring", "due_to_expire", "ending_soon"].includes(key)) {
    return { label: "Expiring", tone: "warning" };
  }

  if (["expired", "expiry"].includes(key)) {
    return { label: "Expired", tone: "danger" };
  }

  if (["upcoming", "future", "scheduled", "pending_start"].includes(key)) {
    return { label: "Upcoming", tone: "default" };
  }

  const today = todayLocalIso();
  const start = startIso?.trim().slice(0, 10) ?? "";
  const end = endIso?.trim().slice(0, 10) ?? "";

  if (start && end) {
    if (today < start) {
      return { label: "Upcoming", tone: "default" };
    }
    if (today > end) {
      return { label: "Expired", tone: "danger" };
    }
    const daysLeft = calendarDaysToEnd(today, end);
    if (daysLeft >= 0 && daysLeft <= threshold) {
      return { label: "Expiring", tone: "warning" };
    }
    return { label: "Current", tone: "success" };
  }

  return getLeaveContractUiStatus(storedStatusDisplay);
}
