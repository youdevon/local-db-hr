#!/usr/bin/env node
/**
 * Called by install-update.sh with env:
 * DBHR_PROJECT_ROOT, DBHR_AUDIT_ACTOR_USER_ID, DBHR_AUDIT_ACTOR_EMAIL, DBHR_AUDIT_ACTOR_NAME
 * DATABASE_URL must be available (sourced from .env by the shell script before invoking node).
 */
"use strict";

const path = require("path");
const { PrismaClient, Prisma } = require("@prisma/client");

const action = process.argv[2];
const success = process.argv[3] !== "false";
const failureReasonRaw = process.argv[4];
const failureReason =
  !failureReasonRaw || failureReasonRaw === "__NULL__" ? null : failureReasonRaw;

let metadata = {};
try {
  metadata = JSON.parse(process.argv[5] || "{}");
} catch {
  metadata = { metadataParseFailed: true };
}

const uidRaw = process.env.DBHR_AUDIT_ACTOR_USER_ID;
const actorUserId = uidRaw && /^[0-9a-fA-F-]{36}$/.test(uidRaw.trim()) ? uidRaw.trim() : null;
const actorEmail = process.env.DBHR_AUDIT_ACTOR_EMAIL?.trim() || null;
const actorName = process.env.DBHR_AUDIT_ACTOR_NAME?.trim() || null;

const projectRoot = process.env.DBHR_PROJECT_ROOT || process.cwd();
process.chdir(projectRoot);

async function main() {
  if (!action) {
    throw new Error("Missing audit action argument.");
  }

  const prisma = new PrismaClient();
  const retentionUntil = new Date();
  retentionUntil.setFullYear(retentionUntil.getFullYear() + 7);
  const retentionDate = retentionUntil.toISOString().slice(0, 10);

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.system_audit_logs (
        actor_user_id,
        actor_email,
        actor_name,
        module,
        action,
        target_type,
        target_label,
        success,
        failure_reason,
        metadata,
        retention_until,
        legal_hold
      )
      VALUES (
        ${actorUserId}::uuid,
        ${actorEmail},
        ${actorName},
        ${"Global Settings"},
        ${action},
        ${"settings"},
        ${"Settings: Licence & Updates"},
        ${success},
        ${failureReason},
        ${JSON.stringify(metadata)}::jsonb,
        ${retentionDate}::date,
        false
      )
    `,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("[log-update-audit]", e);
  process.exit(1);
});
