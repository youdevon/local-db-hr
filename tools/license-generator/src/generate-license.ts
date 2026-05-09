#!/usr/bin/env node
import * as crypto from "node:crypto";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

import { SignJWT, importPKCS8, type KeyLike } from "jose";
import "dotenv/config";

import { HR_PRODUCT_NAME, type LicenseType, type SignedLicencePayload } from "./payload.js";

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
  LICENSE_PRIVATE_KEY_PATH   Path to PKCS #8 PEM private key (Ed25519)
`);
  process.exit(1);
}

function parseIsoDateDay(value: string, label: string): string {
  const d = new Date(`${value.trim()}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date for ${label}: "${value}". Use YYYY-MM-DD.`);
  }
  return d.toISOString();
}

function parseOptionalNumber(raw: string | undefined, label: string): number | null {
  if (raw === undefined || raw.trim() === "") return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid ${label}: expected a non-negative number.`);
  }
  return Math.floor(n);
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

  const licenseType = values.type.trim().toLowerCase() as LicenseType;
  const allowed: LicenseType[] = ["trial", "active", "permanent", "suspended"];
  if (!allowed.includes(licenseType)) {
    throw new Error(`Unsupported licence type "${values.type}". Use: ${allowed.join(", ")}.`);
  }

  const grace = Number(values.grace);
  if (!Number.isFinite(grace) || grace < 0 || grace > 3650) {
    throw new Error("Invalid --grace: expected an integer between 0 and 3650.");
  }

  let expiresAt: string | null = null;
  if (values.expires?.trim()) {
    expiresAt = parseIsoDateDay(values.expires, "--expires");
  }

  if ((licenseType === "trial" || licenseType === "active") && !expiresAt) {
    throw new Error(`Missing or invalid --expires: required for licence type "${licenseType}".`);
  }

  if (licenseType === "permanent" && !expiresAt) {
    expiresAt = null;
  }

  /* suspended: expires optional (e.g. end of suspension window) */

  const issuedAtRaw = values["issued-at"]?.trim();
  const issuedAt = issuedAtRaw ? parseIsoDateDay(issuedAtRaw, "--issued-at") : new Date().toISOString();

  const productName = (values.product?.trim() || HR_PRODUCT_NAME) as SignedLicencePayload["productName"];
  if (productName !== HR_PRODUCT_NAME) {
    throw new Error(`Invalid --product: HR app only accepts "${HR_PRODUCT_NAME}" for verification.`);
  }

  const maxUsers = parseOptionalNumber(values["max-users"], "--max-users");
  const maxEmployees = parseOptionalNumber(values["max-employees"], "--max-employees");

  const privateKeyPath =
    process.env.LICENSE_PRIVATE_KEY_PATH?.trim() || path.join(process.cwd(), "keys", "license-private.pem");

  let pem: string;
  try {
    pem = await fs.readFile(privateKeyPath, "utf8");
  } catch {
    throw new Error(
      `Missing private key: could not read "${privateKeyPath}". Set LICENSE_PRIVATE_KEY_PATH or run npm run generate-keypair.`,
    );
  }

  let privateKey: KeyLike;
  try {
    privateKey = await importPKCS8(pem, "Ed25519");
  } catch {
    throw new Error("Invalid private key file: expected PKCS #8 PEM for Ed25519.");
  }

  const licenceId = crypto.randomUUID();
  const generatedAt = new Date().toISOString();

  const payload: SignedLicencePayload = {
    licenceId,
    organizationName: values.org.trim(),
    productName,
    licenseType,
    issuedAt,
    expiresAt,
    gracePeriodDays: grace,
    maxUsers,
    maxEmployees,
    issuedBy: values["issued-by"]?.trim() || "D3 Services",
    notes: values.notes?.trim() ?? "",
    generatedAt,
  };

  const jwt = await new SignJWT({
    ...payload,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "JWT" })
    .sign(privateKey);

  const licenceKey = `D3HR.${jwt}`;

  function addDaysUtc(base: Date, days: number): Date {
    const next = new Date(base);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }
  const expiresDate = expiresAt ? new Date(expiresAt) : null;
  const hardStop =
    expiresDate == null || Number.isNaN(expiresDate.getTime())
      ? "(n/a — no expiry)"
      : addDaysUtc(expiresDate, grace).toISOString();

  console.info("");
  console.info("Licence ID:           ", licenceId);
  console.info("Organisation name:    ", payload.organizationName);
  console.info("Licence type:         ", payload.licenseType);
  console.info("Issue date (UTC):     ", payload.issuedAt);
  console.info("Expiry date (UTC):    ", payload.expiresAt ?? "(none)");
  console.info("Grace period (days):  ", String(grace));
  console.info("Hard stop date (UTC): ", hardStop);
  console.info("Max users:            ", maxUsers == null ? "(unlimited)" : String(maxUsers));
  console.info("Max employees:        ", maxEmployees == null ? "(unlimited)" : String(maxEmployees));
  console.info("Issued by:            ", payload.issuedBy);
  console.info("");
  console.info("Generated licence key:");
  console.info(licenceKey);
  console.info("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
