/** Matches `StatusBadge` / `StatusTone` in the UI. */
export type ContractUiStatusTone = "default" | "success" | "warning" | "danger" | "muted";

/**
 * Maps stored / display contract status strings to user-facing leave summary labels.
 */
export function getLeaveContractUiStatus(statusInput: string | null | undefined): {
  label: string;
  tone: ContractUiStatusTone;
} {
  const key = (statusInput ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");

  if (!key) return { label: "Unknown", tone: "muted" };

  if (key === "active" || key === "current" || key === "in_force" || key === "live") {
    return { label: "Current", tone: "success" };
  }
  if (key === "expired" || key === "expiry") {
    return { label: "Expired", tone: "danger" };
  }
  if (key === "expiring" || key === "due_to_expire" || key === "ending_soon") {
    return { label: "Expiring", tone: "warning" };
  }
  if (key === "upcoming" || key === "future" || key === "scheduled" || key === "pending_start") {
    return { label: "Upcoming", tone: "default" };
  }
  if (key === "ended" || key === "closed" || key === "terminated" || key === "complete" || key === "completed") {
    return { label: "Closed", tone: "muted" };
  }
  if (key === "draft" || key === "unknown") {
    return { label: "Unknown", tone: "muted" };
  }

  return { label: "Unknown", tone: "muted" };
}
