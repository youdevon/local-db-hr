import * as crypto from "node:crypto";

import { SignJWT, importPKCS8, type KeyLike } from "jose";

import {
  D3HR_LICENSE_PREFIX,
  HR_PRODUCT_NAME,
  PROVIDER_LICENSE_TYPES,
  getHardStopDateIso,
  normalizeExpiresAtInput,
  parseOptionalNumber,
  type ProviderLicenseType,
  type SignedLicencePayload,
} from "./license-payload";

export type GenerateProviderLicenseInput = {
  organizationName: string;
  licenseType: ProviderLicenseType;
  expiresAt: string | null | undefined;
  gracePeriodDays: number;
  maxUsers: number | null | undefined;
  maxEmployees: number | null | undefined;
  issuedBy: string;
  notes?: string | null;
  issuedAt?: string | null;
};

export type LicenseStatusPreview = {
  summary: string;
  hardStopDateIso: string | null;
  daysUntilExpiry: number | null;
};

export class LicenseGeneratorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LicenseGeneratorError";
  }
}

async function importPrivateKeyFromPem(pem: string): Promise<KeyLike> {
  try {
    return await importPKCS8(pem, "Ed25519");
  } catch {
    throw new LicenseGeneratorError(
      "Invalid private signing key: expected PKCS #8 PEM for Ed25519. Check LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH.",
    );
  }
}

export function validateGenerateProviderLicenseInput(input: GenerateProviderLicenseInput): {
  organizationName: string;
  licenseType: ProviderLicenseType;
  expiresAt: string | null;
  gracePeriodDays: number;
  maxUsers: number | null;
  maxEmployees: number | null;
  issuedBy: string;
  notes: string;
  issuedAt: string;
} {
  const organizationName = input.organizationName.trim();
  if (!organizationName) {
    throw new LicenseGeneratorError("Organization name is required.");
  }
  if (organizationName.length > 180) {
    throw new LicenseGeneratorError("Organization name must be 180 characters or fewer.");
  }

  const licenseType = input.licenseType;
  if (!PROVIDER_LICENSE_TYPES.includes(licenseType)) {
    throw new LicenseGeneratorError(`Unsupported licence type "${String(licenseType)}".`);
  }

  const gracePeriodDays = Number(input.gracePeriodDays);
  if (!Number.isFinite(gracePeriodDays) || gracePeriodDays < 0 || gracePeriodDays > 3650) {
    throw new LicenseGeneratorError("Grace days must be an integer between 0 and 3650.");
  }

  let expiresAt: string | null;
  try {
    expiresAt = normalizeExpiresAtInput(input.expiresAt ?? null);
  } catch (e) {
    throw new LicenseGeneratorError(e instanceof Error ? e.message : "Invalid expiry date.");
  }

  if ((licenseType === "trial" || licenseType === "active") && !expiresAt) {
    throw new LicenseGeneratorError(`Expiry date is required for ${licenseType} licences.`);
  }

  let maxUsers: number | null;
  let maxEmployees: number | null;
  try {
    maxUsers = parseOptionalNumber(input.maxUsers, "max users");
    maxEmployees = parseOptionalNumber(input.maxEmployees, "max employees");
  } catch (e) {
    throw new LicenseGeneratorError(e instanceof Error ? e.message : "Invalid numeric limit.");
  }

  if (maxUsers != null && maxUsers > 100_000) {
    throw new LicenseGeneratorError("Max users must be 100,000 or fewer.");
  }
  if (maxEmployees != null && maxEmployees > 10_000_000) {
    throw new LicenseGeneratorError("Max employees must be 10,000,000 or fewer.");
  }

  const issuedBy = (input.issuedBy?.trim() || "D3 Services").slice(0, 180);
  const notes = (input.notes?.trim() ?? "").slice(0, 4000);

  let issuedAt: string;
  if (input.issuedAt?.trim()) {
    try {
      issuedAt = normalizeExpiresAtInput(input.issuedAt) ?? new Date().toISOString();
    } catch {
      throw new LicenseGeneratorError("Invalid issued date.");
    }
  } else {
    issuedAt = new Date().toISOString();
  }

  return {
    organizationName,
    licenseType,
    expiresAt,
    gracePeriodDays,
    maxUsers,
    maxEmployees,
    issuedBy,
    notes,
    issuedAt,
  };
}

export async function signProviderLicenseKey(
  input: GenerateProviderLicenseInput,
  privateKeyPem: string,
): Promise<{ licenseKey: string; claims: SignedLicencePayload }> {
  const validated = validateGenerateProviderLicenseInput(input);
  const pem = privateKeyPem.trim();
  if (!pem) {
    throw new LicenseGeneratorError(
      "Private signing key is not configured. Set LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH on the server.",
    );
  }

  const privateKey = await importPrivateKeyFromPem(pem);
  const licenceId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  const claims: SignedLicencePayload = {
    licenceId,
    organizationName: validated.organizationName,
    productName: HR_PRODUCT_NAME,
    licenseType: validated.licenseType,
    issuedAt: validated.issuedAt,
    expiresAt: validated.expiresAt,
    gracePeriodDays: validated.gracePeriodDays,
    maxUsers: validated.maxUsers,
    maxEmployees: validated.maxEmployees,
    issuedBy: validated.issuedBy,
    notes: validated.notes,
    generatedAt,
  };

  const jwt = await new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .sign(privateKey);

  return {
    licenseKey: `${D3HR_LICENSE_PREFIX}${jwt}`,
    claims,
  };
}

export function previewLicenseStatus(
  claims: Pick<SignedLicencePayload, "licenseType" | "expiresAt" | "gracePeriodDays">,
  now: Date = new Date(),
): LicenseStatusPreview {
  const licenseType = claims.licenseType;
  const expires = claims.expiresAt ? new Date(claims.expiresAt) : null;
  const graceDays = claims.gracePeriodDays;
  const hardStopDateIso = getHardStopDateIso(claims.expiresAt, graceDays);

  let summary: string;
  if (licenseType === "permanent") {
    summary = "Permanent (no expiry).";
  } else if (licenseType === "suspended") {
    summary = "Suspended (access should be blocked by the HR app).";
  } else if (!expires || Number.isNaN(expires.getTime())) {
    summary = "Invalid (missing expiry for this licence type).";
  } else if (now <= expires) {
    const days = Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 86_400_000));
    summary = `Active (before expiry — ${days} calendar day${days === 1 ? "" : "s"} until expiry).`;
  } else {
    const hard = hardStopDateIso ? new Date(hardStopDateIso) : null;
    if (licenseType === "trial" && hard && now <= hard) {
      summary = "Grace period (trial expired but within grace — renew or activate before hard stop).";
    } else {
      summary = "Expired (past expiry" + (licenseType === "trial" && hard && now > hard ? " and past hard stop" : "") + ").";
    }
  }

  const daysUntilExpiry =
    expires && !Number.isNaN(expires.getTime()) ? Math.ceil((expires.getTime() - now.getTime()) / 86_400_000) : null;

  return { summary, hardStopDateIso, daysUntilExpiry };
}

export function formatLicenseGeneratorAuditMetadata(
  claims: Pick<
    SignedLicencePayload,
    | "licenceId"
    | "organizationName"
    | "licenseType"
    | "expiresAt"
    | "gracePeriodDays"
    | "maxUsers"
    | "maxEmployees"
    | "issuedBy"
  >,
  licenseKey: string,
) {
  const trimmed = licenseKey.trim();
  return {
    licenceId: claims.licenceId,
    organizationName: claims.organizationName,
    licenseType: claims.licenseType,
    expiresAt: claims.expiresAt,
    gracePeriodDays: claims.gracePeriodDays,
    maxUsers: claims.maxUsers,
    maxEmployees: claims.maxEmployees,
    issuedBy: claims.issuedBy,
    keyFingerprint: trimmed.length <= 12 ? "****" : `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`,
  };
}
