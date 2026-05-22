/**
 * Canonical signed licence claims (embedded in the JWS payload).
 * Shared by the provider generator UI, CLI tool, and app verifier.
 */
export type ProviderLicenseType = "trial" | "active" | "permanent" | "suspended";

export const HR_PRODUCT_NAME = "Local DB HR" as const;
export const D3HR_LICENSE_PREFIX = "D3HR." as const;

export type SignedLicencePayload = {
  licenceId: string;
  organizationName: string;
  productName: typeof HR_PRODUCT_NAME;
  licenseType: ProviderLicenseType;
  issuedAt: string;
  expiresAt: string | null;
  gracePeriodDays: number;
  maxUsers: number | null;
  maxEmployees: number | null;
  issuedBy: string;
  notes: string;
  generatedAt: string;
};

export const PROVIDER_LICENSE_TYPES: ProviderLicenseType[] = ["trial", "active", "permanent", "suspended"];

export function parseIsoDateDay(value: string, label: string): string {
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for ${label}: "${value}". Use YYYY-MM-DD.`);
  }
  return d.toISOString();
}

export function parseOptionalNumber(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${label}: expected a non-negative number.`);
  }
  return Math.floor(n);
}

export function normalizeExpiresAtInput(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return parseIsoDateDay(trimmed, "expiry date");
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Invalid expiry date.");
  }
  return parsed.toISOString();
}

export function addDaysUtc(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function getHardStopDateIso(expiresAt: string | null, gracePeriodDays: number): string | null {
  if (!expiresAt) return null;
  const expires = new Date(expiresAt);
  if (Number.isNaN(expires.getTime())) return null;
  return addDaysUtc(expires, gracePeriodDays).toISOString();
}
