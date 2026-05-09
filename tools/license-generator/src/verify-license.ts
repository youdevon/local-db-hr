#!/usr/bin/env node
import * as fs from "node:fs/promises";
import * as path from "node:path";
import { parseArgs } from "node:util";

import { jwtVerify, importSPKI } from "jose";
import "dotenv/config";

import { HR_PRODUCT_NAME, type LicenseType, type SignedLicencePayload } from "./payload.js";

function usage(): never {
  console.error(`
Usage:
  npm run verify -- --key "D3HR.<token>"

Environment:
  LICENSE_PUBLIC_KEY_PATH    Path to SPKI PEM public key (Ed25519)
`);
  process.exit(1);
}

const D3HR_PREFIX = "D3HR.";

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addDaysUtc(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function hardStopFrom(isoExpires: string | null, graceDays: number): string | null {
  const expires = parseDate(isoExpires);
  if (!expires) return null;
  return addDaysUtc(expires, graceDays).toISOString();
}

function isPayloadShape(v: Record<string, unknown>): v is SignedLicencePayload {
  const t = v.licenseType;
  if (typeof t !== "string") return false;
  return ["trial", "active", "permanent", "suspended"].includes(t);
}

async function main() {
  const { values } = parseArgs({
    args: process.argv.slice(2),
    options: {
      key: { type: "string" },
    },
    allowPositionals: false,
  });

  const raw = values.key?.trim();
  if (!raw) usage();

  if (!raw.startsWith(D3HR_PREFIX)) {
    console.error('Invalid licence key format: key must start with "D3HR.".');
    process.exit(2);
  }

  const token = raw.slice(D3HR_PREFIX.length).trim();
  if (!token || token.split(".").length !== 3) {
    console.error("Invalid licence key format: expected D3HR.<header>.<payload>.<signature>.");
    process.exit(2);
  }

  const publicKeyPath =
    process.env.LICENSE_PUBLIC_KEY_PATH?.trim() || path.join(process.cwd(), "keys", "license-public.pem");

  let pem: string;
  try {
    pem = await fs.readFile(publicKeyPath, "utf8");
  } catch {
    console.error(`Missing public key: could not read "${publicKeyPath}". Set LICENSE_PUBLIC_KEY_PATH.`);
    process.exit(2);
  }

  let publicKey: Awaited<ReturnType<typeof importSPKI>>;
  try {
    publicKey = await importSPKI(pem, "Ed25519");
  } catch {
    console.error("Invalid public key file: expected SPKI PEM for Ed25519.");
    process.exit(2);
  }

  let payload: Record<string, unknown>;
  try {
    const verified = await jwtVerify(token, publicKey, { algorithms: ["EdDSA"] });
    payload = verified.payload as Record<string, unknown>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("signature") || msg.includes("verification")) {
      console.error("Invalid signature: this licence key was not signed by the paired private key.");
    } else {
      console.error("Invalid licence key: signature verification failed.");
    }
    process.exit(2);
  }

  if (!isPayloadShape(payload)) {
    console.error("Invalid payload: unsupported licence type or malformed claims.");
    process.exit(2);
  }

  if (payload.productName !== HR_PRODUCT_NAME) {
    console.error(`Invalid product: expected productName "${HR_PRODUCT_NAME}" for this HR application.`);
    process.exit(2);
  }

  const licenseType = payload.licenseType as LicenseType;

  const issued = parseDate(typeof payload.issuedAt === "string" ? payload.issuedAt : null);
  const expires = parseDate(typeof payload.expiresAt === "string" ? payload.expiresAt : null);
  const generated = parseDate(typeof payload.generatedAt === "string" ? payload.generatedAt : null);

  if (!issued || !generated) {
    console.error("Invalid date: issuedAt or generatedAt is missing or not a valid ISO date.");
    process.exit(2);
  }

  if ((licenseType === "trial" || licenseType === "active") && !expires) {
    console.error("Invalid date: expiresAt is required for trial/active licences.");
    process.exit(2);
  }

  const graceDays = Number(payload.gracePeriodDays);
  if (!Number.isFinite(graceDays) || graceDays < 0) {
    console.error("Invalid payload: gracePeriodDays must be a non-negative number.");
    process.exit(2);
  }

  const now = new Date();
  const hardStopIso = expires ? hardStopFrom(expires.toISOString(), graceDays) : null;

  console.info("");
  console.info("Signature:            VALID");
  console.info("Licence ID:          ", payload.licenceId);
  console.info("Organisation:        ", payload.organizationName);
  console.info("Product:             ", payload.productName);
  console.info("Type:                ", licenseType);
  console.info("Issued at:           ", issued.toISOString());
  console.info("Expires at:          ", expires ? expires.toISOString() : "(none)");
  console.info("Grace (days):        ", String(graceDays));
  console.info("Hard stop:           ", hardStopIso ?? "(n/a)");
  console.info("Max users:           ", payload.maxUsers == null ? "(unlimited)" : String(payload.maxUsers));
  console.info("Max employees:       ", payload.maxEmployees == null ? "(unlimited)" : String(payload.maxEmployees));
  console.info("Issued by:           ", payload.issuedBy);
  if (payload.notes) console.info("Notes:              ", payload.notes);
  console.info("");

  let lifecycle: string;
  if (licenseType === "permanent") {
    lifecycle = "State: PERMANENT (no expiry).";
  } else if (licenseType === "suspended") {
    lifecycle = "State: SUSPENDED (access should be blocked by the HR app).";
  } else if (!expires) {
    lifecycle = "State: INVALID (missing expiry for this licence type).";
  } else if (now <= expires) {
    lifecycle = `State: ACTIVE (before expiry — ${Math.max(0, Math.ceil((expires.getTime() - now.getTime()) / 86400000))} calendar days until expiry).`;
  } else {
    const hard = hardStopIso ? parseDate(hardStopIso) : null;
    if (licenseType === "trial" && hard && now <= hard) {
      lifecycle = "State: GRACE PERIOD (trial expired but within grace — renew or activate before hard stop).";
    } else if (now > expires) {
      lifecycle = "State: EXPIRED (past expiry" + (licenseType === "trial" && hard && now > hard ? " and past hard stop" : "") + ").";
    } else {
      lifecycle = "State: EXPIRED.";
    }
  }

  console.info(lifecycle);
  console.info("");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
