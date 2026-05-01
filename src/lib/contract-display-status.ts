import type { StatusTone } from "@/components/status-badge";

/** Priority for sorting status labels (lower = earlier). */
const STATUS_ORDER: Record<string, number> = {
  current: 0,
  upcoming: 1,
  active: 2,
  "expiring soon": 3,
  renewed: 4,
  draft: 5,
  expired: 6,
  terminated: 7,
  cancelled: 8,
};

function normalizeStored(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\s+/g, " ");
}

/** Local calendar date as YYYY-MM-DD (no UTC drift). */
export function todayLocalIso(): string {
  const n = new Date();
  const y = n.getFullYear();
  const m = String(n.getMonth() + 1).padStart(2, "0");
  const d = String(n.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isoDateOnly(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  return iso.trim().slice(0, 10);
}

function formatTitleCaseWords(raw: string): string {
  const s = raw.trim();
  if (!s) return "—";
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export type ContractLikeForStatus = {
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  status: string | null | undefined;
};

/**
 * Derives a single display status from stored contract status + effective dates.
 * Stored terminal / draft states override date inference where appropriate.
 */
export function getContractDisplayStatus(contract: ContractLikeForStatus): string {
  const storedRaw = normalizeStored(contract.status);
  if (storedRaw === "terminated") return "Terminated";
  if (storedRaw === "cancelled") return "Cancelled";
  if (storedRaw === "draft") return "Draft";
  if (storedRaw === "renewed") return "Renewed";

  const today = todayLocalIso();
  const start = isoDateOnly(contract.startDate ?? undefined);
  const end = isoDateOnly(contract.endDate ?? undefined);

  if (storedRaw === "expiring soon") return "Expiring Soon";

  if (start && start > today) return "Upcoming";

  if (end && end < today) return "Expired";

  if (start && end && start <= today && today <= end) return "Current";

  if (start && !end) {
    if (start <= today && (storedRaw === "active" || storedRaw === "")) return "Current";
    if (start > today) return "Upcoming";
    return storedRaw === "active" ? "Active" : formatTitleCaseWords(storedRaw) || "Current";
  }

  if (storedRaw === "active") return "Active";
  if (storedRaw === "expired") return "Expired";

  return formatTitleCaseWords(storedRaw) || "—";
}

export function getContractDisplayStatusTone(label: string): StatusTone {
  const n = label.trim().toLowerCase();
  if (n === "current" || n === "active") return "success";
  if (n === "upcoming") return "default";
  if (n === "expiring soon") return "warning";
  if (n === "renewed") return "default";
  if (n === "draft") return "muted";
  if (n === "expired") return "muted";
  if (n === "terminated" || n === "cancelled") return "danger";
  return "muted";
}

export function compareContractStatusLabel(a: string, b: string): number {
  const na = normalizeStored(a);
  const nb = normalizeStored(b);
  const ra = STATUS_ORDER[na] ?? 99;
  const rb = STATUS_ORDER[nb] ?? 99;
  if (ra !== rb) return ra - rb;
  return compareString(a, b);
}

function compareString(x: string, y: string): number {
  return x.trim().toLowerCase().localeCompare(y.trim().toLowerCase(), undefined, { sensitivity: "base" });
}
