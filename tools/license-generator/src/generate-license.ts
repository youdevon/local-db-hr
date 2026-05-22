#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

import "dotenv/config";

import {
  LicenseGeneratorError,
  signProviderLicenseKey,
} from "../../../src/lib/licensing/sign-provider-license.js";
import { HR_PRODUCT_NAME, getHardStopDateIso } from "../../../src/lib/licensing/license-payload.js";

function usage(): never {
  console.error(`
Usage:
  npm run generate -- --org "Company Ltd" --type trial --expires "2026-08-05" --grace 14 --max-users 500 --max-employees 500

Options:
  --org              Organisation name (required)
  --type             trial | active | permanent | suspended (required)
  --expires          Expiry date YYYY-MM-DD (required for trial/active; omit for permanent if not needed)
  --grace            Grace period days after expiry (required)
  --max-users        Max users (omit = unlimited)
  --max-employees    Max employees (omit = unlimited)
  --issued-by        Issuer label (default: D3 Services)
  --notes            Free-text notes
  --product          Product name (default: ${HR_PRODUCT_NAME})
  --issued-at        Issue date YYYY-MM-DD (default: today UTC)

Environment:
  LICENSE_PRIVATE_KEY_PEM    Inline PKCS #8 PEM private key (Ed25519)
  LICENSE_PRIVATE_KEY_PATH   Path to PKCS #8 PEM private key (Ed25519)
`);
  process.exit(1);
}

async function resolvePrivateKeyPem(): Promise<string> {
  const inline = process.env.LICENSE_PRIVATE_KEY_PEM?.trim();
  if (inline) return inline.replace(/\\n/g, "\n");

  const privateKeyPath =
    process.env.LICENSE_PRIVATE_KEY_PATH?.trim() || path.join(process.cwd(), "keys", "license-private.pem");

  try {
    return await fs.readFile(privateKeyPath, "utf8");
  } catch {
    throw new LicenseGeneratorError(
      `Missing private key: could not read "${privateKeyPath}". Set LICENSE_PRIVATE_KEY_PEM, LICENSE_PRIVATE_KEY_PATH, or run npm run generate-keypair.`,
    );
  }
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      org: { type: "string" },
      type: { type: "string" },
      expires: { type: "string" },
      grace: { type: "string" },
      "max-users": { type: "string" },
      "max-employees": { type: "string" },
      "issued-by": { type: "string" },
      notes: { type: "string" },
      product: { type: "string" },
      "issued-at": { type: "string" },
    },
    allowPositionals: false,
  });

  if (!values.org?.trim() || !values.type?.trim() || values.grace === undefined) {
    usage();
  }

  const productName = values.product?.trim() || HR_PRODUCT_NAME;
  if (productName !== HR_PRODUCT_NAME) {
    throw new LicenseGeneratorError(`Invalid --product: HR app only accepts "${HR_PRODUCT_NAME}" for verification.`);
  }

  const privateKeyPem = await resolvePrivateKeyPem();
  const { licenseKey, claims } = await signProviderLicenseKey(
    {
      organizationName: values.org.trim(),
      licenseType: values.type.trim().toLowerCase() as "trial" | "active" | "permanent" | "suspended",
      expiresAt: values.expires?.trim() || null,
      gracePeriodDays: Number(values.grace),
      maxUsers: values["max-users"],
      maxEmployees: values["max-employees"],
      issuedBy: values["issued-by"]?.trim() || "D3 Services",
      notes: values.notes ?? "",
      issuedAt: values["issued-at"]?.trim() || null,
    },
    privateKeyPem,
  );

  const hardStop = getHardStopDateIso(claims.expiresAt, claims.gracePeriodDays);

  console.info("");
  console.info("Licence ID:           ", claims.licenceId);
  console.info("Organisation name:    ", claims.organizationName);
  console.info("Licence type:         ", claims.licenseType);
  console.info("Issue date (UTC):     ", claims.issuedAt);
  console.info("Expiry date (UTC):    ", claims.expiresAt ?? "(none)");
  console.info("Grace period (days):  ", String(claims.gracePeriodDays));
  console.info("Hard stop date (UTC): ", hardStop ?? "(n/a — no expiry)");
  console.info("Max users:            ", claims.maxUsers == null ? "(unlimited)" : String(claims.maxUsers));
  console.info("Max employees:        ", claims.maxEmployees == null ? "(unlimited)" : String(claims.maxEmployees));
  console.info("Issued by:            ", claims.issuedBy);
  console.info("");
  console.info("Generated licence key:");
  console.info(licenseKey);
  console.info("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
