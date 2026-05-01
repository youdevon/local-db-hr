export const CONTRACT_STATUS_OPTIONS = [
  "Draft",
  "Active",
  "Expiring Soon",
  "Expired",
  "Renewed",
  "Terminated",
  "Cancelled",
] as const;
export type ContractStatus = (typeof CONTRACT_STATUS_OPTIONS)[number];

export const ALLOWANCE_TYPE_OPTIONS = [
  "Travelling",
  "Professional",
  "Housing",
  "Acting",
  "Duty",
  "Telephone",
  "Meal",
  "Other",
] as const;
export type AllowanceType = (typeof ALLOWANCE_TYPE_OPTIONS)[number];

export const ALLOWANCE_FREQUENCY_OPTIONS = [
  "Monthly",
  "One-time",
  "Quarterly",
  "Annually",
  "Per duty",
  "Other",
] as const;
export type AllowanceFrequency = (typeof ALLOWANCE_FREQUENCY_OPTIONS)[number];

export type ContractAllowance = {
  aid: string;
  allowanceType: AllowanceType | "";
  description: string;
  amount: number | null;
  frequency: AllowanceFrequency | "";
  startDate: string;
  endDate: string;
  taxable: boolean;
  notes: string;
};

export type ContractRecord = {
  id: string;
  employeeId: string;
  minuteNumber: string | null;
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  dateReceived: string;
  dateSigned: string;
  salary: number;
  gratuity: number | null;
  vacationLeaveEntitlement: number;
  sickLeaveEntitlement: number;
  vacationRolloverAllowed: boolean;
  sickRolloverAllowed: boolean;
  status: ContractStatus;
  notes: string;
  retirementOverrideRequired?: boolean;
  retirementOverrideReason?: string | null;
  retirementOverrideApprovalReference?: string | null;
  retirementCutoffDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  allowances: ContractAllowance[];
};

export type ContractListRow = {
  id: string;
  minuteNumber: string;
  contractNumber: string;
  employeeName: string;
  fileNumber: string;
  position: string;
  department: string;
  startDate: string;
  endDate: string;
  salary: string;
  gratuity: string;
  status: ContractStatus;
  daysToExpiry: number | null;
};

export const mockContracts: ContractRecord[] = [];

export function formatCurrencyTTD(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-TT", {
    style: "currency",
    currency: "TTD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatContractDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function calculateDaysToExpiry(endDate: string): number {
  const end = new Date(`${endDate}T12:00:00`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase().replaceAll("_", " ");
}

export function formatContractStatusLabel(status: string): string {
  const normalized = normalizeSearch(status);
  if (normalized === "expiring soon") return "Expiring Soon";
  if (normalized === "draft") return "Draft";
  if (normalized === "active") return "Active";
  if (normalized === "expired") return "Expired";
  if (normalized === "renewed") return "Renewed";
  if (normalized === "terminated") return "Terminated";
  if (normalized === "cancelled") return "Cancelled";
  return status;
}

export function contractMatchesQuery(row: ContractListRow, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  const statusLabel = formatContractStatusLabel(row.status);
  const hay = [
    row.minuteNumber,
    row.employeeName,
    row.fileNumber,
    row.contractNumber,
    row.position,
    row.department,
    row.status,
    statusLabel,
    statusLabel.replaceAll(" ", "_"),
  ]
    .join(" ")
    .toLowerCase()
    .replaceAll("_", " ");
  return hay.includes(q);
}
