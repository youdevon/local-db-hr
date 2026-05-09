/**
 * Canonical signed licence claims (embedded in the JWS payload).
 * Must stay in sync with the HR app verifier in src/lib/license-key-verification.ts
 */
export type LicenseType = "trial" | "active" | "permanent" | "suspended";

export type SignedLicencePayload = {
  licenceId: string;
  organizationName: string;
  productName: string;
  licenseType: LicenseType;
  issuedAt: string;
  expiresAt: string | null;
  gracePeriodDays: number;
  maxUsers: number | null;
  maxEmployees: number | null;
  issuedBy: string;
  notes: string;
  generatedAt: string;
};

export const HR_PRODUCT_NAME = "Local DB HR" as const;
