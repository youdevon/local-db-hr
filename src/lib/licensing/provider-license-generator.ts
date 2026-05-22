import "server-only";

import * as fs from "node:fs/promises";

import {
  formatLicenseGeneratorAuditMetadata,
  previewLicenseStatus,
  signProviderLicenseKey,
  type GenerateProviderLicenseInput,
  type LicenseStatusPreview,
  LicenseGeneratorError,
  validateGenerateProviderLicenseInput,
} from "@/lib/licensing/sign-provider-license";

export {
  formatLicenseGeneratorAuditMetadata,
  previewLicenseStatus,
  validateGenerateProviderLicenseInput,
  LicenseGeneratorError,
  type GenerateProviderLicenseInput,
  type LicenseStatusPreview,
};

export function isLicenseGeneratorEnabled(): boolean {
  return process.env.ENABLE_LICENSE_GENERATOR === "true";
}

/** True when a private signing key is configured (does not load or expose the key). */
export async function isLicensePrivateKeyConfigured(): Promise<boolean> {
  const pem = await getLicensePrivateKeyPemFromEnv();
  return pem != null && pem.trim().length > 0;
}

/** Read PKCS #8 PEM from LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH. Never log or return in API responses. */
export async function getLicensePrivateKeyPemFromEnv(): Promise<string | null> {
  const inline = process.env.LICENSE_PRIVATE_KEY_PEM?.trim();
  if (inline) {
    return inline.replace(/\\n/g, "\n");
  }

  const keyPath = process.env.LICENSE_PRIVATE_KEY_PATH?.trim();
  if (!keyPath) return null;

  try {
    return await fs.readFile(keyPath, "utf8");
  } catch {
    return null;
  }
}

export async function generateProviderLicenseKey(
  input: GenerateProviderLicenseInput,
  privateKeyPem?: string,
) {
  const pem = privateKeyPem ?? (await getLicensePrivateKeyPemFromEnv());
  if (!pem) {
    throw new LicenseGeneratorError(
      "Private signing key is not configured. Set LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH on the server.",
    );
  }
  return signProviderLicenseKey(input, pem);
}
