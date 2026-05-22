import { describe, expect, it, vi, beforeEach } from "vitest";
import * as fs from "node:fs/promises";
import * as path from "node:path";

vi.mock("server-only", () => ({}));

import { verifyD3hrLicenseKey } from "@/lib/license-key-verification";
import {
  previewLicenseStatus,
  signProviderLicenseKey,
  validateGenerateProviderLicenseInput,
} from "@/lib/licensing/sign-provider-license";

const keysDir = path.join(process.cwd(), "tools/license-generator/keys");

async function loadTestKeys() {
  const privatePem = await fs.readFile(path.join(keysDir, "license-private.pem"), "utf8");
  const publicPem = await fs.readFile(path.join(keysDir, "license-public.pem"), "utf8");
  return { privatePem, publicPem };
}

describe("provider-license-generator", () => {
  beforeEach(() => {
    delete process.env.ENABLE_LICENSE_GENERATOR;
  });

  it("isLicenseGeneratorEnabled respects env flag", async () => {
    const { isLicenseGeneratorEnabled } = await import("@/lib/licensing/provider-license-generator");
    expect(isLicenseGeneratorEnabled()).toBe(false);
    process.env.ENABLE_LICENSE_GENERATOR = "true";
    expect(isLicenseGeneratorEnabled()).toBe(true);
  });

  it("validateGenerateProviderLicenseInput requires expiry for trial", () => {
    expect(() =>
      validateGenerateProviderLicenseInput({
        organizationName: "Acme",
        licenseType: "trial",
        expiresAt: null,
        gracePeriodDays: 14,
        maxUsers: null,
        maxEmployees: null,
        issuedBy: "D3 Services",
      }),
    ).toThrow(/Expiry date is required/);
  });

  it("generates D3HR trial key and verifies with public key", async () => {
    const { privatePem, publicPem } = await loadTestKeys();
    const { licenseKey, claims } = await signProviderLicenseKey(
      {
        organizationName: "Test Org",
        licenseType: "trial",
        expiresAt: "2027-01-15",
        gracePeriodDays: 14,
        maxUsers: 25,
        maxEmployees: 100,
        issuedBy: "D3 Services",
        notes: "Unit test",
      },
      privatePem,
    );

    expect(licenseKey.startsWith("D3HR.")).toBe(true);
    expect(claims.organizationName).toBe("Test Org");
    expect(claims.licenseType).toBe("trial");

    const verified = await verifyD3hrLicenseKey(licenseKey, publicPem);
    expect(verified.licenceId).toBe(claims.licenceId);
    expect(verified.maxUsers).toBe(25);

    const preview = previewLicenseStatus(verified);
    expect(preview.summary.length).toBeGreaterThan(0);
  });

  it("allows permanent licence without expiry", async () => {
    const { privatePem, publicPem } = await loadTestKeys();
    const { licenseKey, claims } = await signProviderLicenseKey(
      {
        organizationName: "Permanent Co",
        licenseType: "permanent",
        expiresAt: null,
        gracePeriodDays: 14,
        maxUsers: null,
        maxEmployees: null,
        issuedBy: "D3 Services",
      },
      privatePem,
    );

    expect(claims.expiresAt).toBeNull();
    await expect(verifyD3hrLicenseKey(licenseKey, publicPem)).resolves.toMatchObject({
      licenseType: "permanent",
      expiresAt: null,
    });
  });
});
