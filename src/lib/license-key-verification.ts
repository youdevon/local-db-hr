import { importSPKI, jwtVerify } from "jose";
import { z } from "zod";

/** Must match tools/license-generator and issued tokens. */
export const D3HR_PREFIX = "D3HR." as const;
export const EXPECTED_LICENSE_PRODUCT_NAME = "Local DB HR" as const;

const claimsSchema = z.object({
  licenceId: z.string().min(1).max(80),
  organizationName: z.string().min(1).max(180),
  productName: z.string().min(1).max(120),
  licenseType: z.enum(["trial", "active", "permanent", "suspended"]),
  issuedAt: z.string().min(1),
  expiresAt: z.preprocess((v) => (v === undefined ? null : v), z.union([z.string().min(1), z.null()])),
  gracePeriodDays: z.coerce.number().int().min(0).max(3650),
  maxUsers: z.union([z.number().int().min(0).max(100000), z.null()]).optional(),
  maxEmployees: z.union([z.number().int().min(0).max(10000000), z.null()]).optional(),
  issuedBy: z.string().max(180).optional(),
  notes: z.string().max(4000).optional(),
  generatedAt: z.string().min(1),
});

export type SignedLicenseClaims = z.infer<typeof claimsSchema>;

export type VerifyLicenseKeyErrorCode =
  | "MISSING_PUBLIC_KEY"
  | "INVALID_FORMAT"
  | "INVALID_SIGNATURE"
  | "INVALID_PAYLOAD"
  | "UNSUPPORTED_PRODUCT"
  | "UNSUPPORTED_LICENSE_TYPE"
  | "INVALID_DATE";

export class VerifyLicenseKeyError extends Error {
  constructor(
    message: string,
    public readonly code: VerifyLicenseKeyErrorCode,
  ) {
    super(message);
    this.name = "VerifyLicenseKeyError";
  }
}

function parseIsoDate(value: string, field: string): Date {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    throw new VerifyLicenseKeyError(`Invalid date in licence key (${field}).`, "INVALID_DATE");
  }
  return d;
}

/** Read PEM from process.env.LICENSE_PUBLIC_KEY_PEM (multiline or \n-escaped single line). */
export function getLicensePublicKeyPemFromEnv(): string | null {
  const raw = process.env.LICENSE_PUBLIC_KEY_PEM?.trim();
  if (!raw) return null;
  return raw.replace(/\\n/g, "\n");
}

export async function verifyD3hrLicenseToken(token: string, publicKeyPem: string): Promise<SignedLicenseClaims> {
  let publicKey: Awaited<ReturnType<typeof importSPKI>>;
  try {
    publicKey = await importSPKI(publicKeyPem, "Ed25519");
  } catch {
    throw new VerifyLicenseKeyError(
      "Licence public key is misconfigured (invalid PEM). Check LICENSE_PUBLIC_KEY_PEM.",
      "MISSING_PUBLIC_KEY",
    );
  }

  let payload: unknown;
  try {
    const { payload: p } = await jwtVerify(token, publicKey, { algorithms: ["EdDSA"] });
    payload = p;
  } catch {
    throw new VerifyLicenseKeyError("Invalid licence key: signature verification failed.", "INVALID_SIGNATURE");
  }

  const parsed = claimsSchema.safeParse(payload);
  if (!parsed.success) {
    throw new VerifyLicenseKeyError(
      "Invalid licence payload: missing or invalid fields in the signed token.",
      "INVALID_PAYLOAD",
    );
  }

  const data = parsed.data;
  if (data.productName !== EXPECTED_LICENSE_PRODUCT_NAME) {
    throw new VerifyLicenseKeyError(
      `This licence is not for ${EXPECTED_LICENSE_PRODUCT_NAME} (unexpected product name in token).`,
      "UNSUPPORTED_PRODUCT",
    );
  }

  parseIsoDate(data.issuedAt, "issuedAt");
  parseIsoDate(data.generatedAt, "generatedAt");
  if (data.expiresAt != null) {
    parseIsoDate(data.expiresAt, "expiresAt");
  }

  if ((data.licenseType === "trial" || data.licenseType === "active") && data.expiresAt == null) {
    throw new VerifyLicenseKeyError(
      "Invalid licence: trial and active licences must include an expiry date in the key.",
      "INVALID_DATE",
    );
  }

  return data;
}

/**
 * Verifies a pasted `D3HR.<token>` licence string with the given public key PEM.
 */
export async function verifyD3hrLicenseKey(rawKey: string, publicKeyPem: string): Promise<SignedLicenseClaims> {
  const trimmed = rawKey.trim();
  if (!trimmed.startsWith(D3HR_PREFIX)) {
    throw new VerifyLicenseKeyError(
      'Invalid licence key format: value must start with "D3HR."',
      "INVALID_FORMAT",
    );
  }

  const token = trimmed.slice(D3HR_PREFIX.length).trim();
  if (!token) {
    throw new VerifyLicenseKeyError("Invalid licence key format: missing signed token after D3HR.", "INVALID_FORMAT");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new VerifyLicenseKeyError(
      "Invalid licence key format: expected D3HR.<header>.<payload>.<signature>.",
      "INVALID_FORMAT",
    );
  }

  return verifyD3hrLicenseToken(token, publicKeyPem);
}
