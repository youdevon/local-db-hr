#!/usr/bin/env node
/**
 * Idempotent default administrator seed for fresh remote installs.
 * Creates the first admin only when no administrator user profile exists.
 */
"use strict";

const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

const DEFAULT_ADMIN_EMAIL = "admin@dbhr.local";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe@12345";
const DEFAULT_ADMIN_NAME = "System Administrator";

function initialsFromFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, Math.min(2, w.length)).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

async function adminExists() {
  const row = await prisma.userProfile.findFirst({
    where: { role: "administrator" },
    select: { user_id: true },
  });
  return Boolean(row);
}

async function writeSeedAuditLog(userId, email, fullName) {
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
        target_id,
        target_label,
        success,
        metadata,
        retention_until,
        legal_hold
      )
      VALUES (
        NULL,
        NULL,
        ${"System"},
        ${"Authentication"},
        ${"created_default_admin"},
        ${"user"},
        ${userId}::uuid,
        ${`User: ${email}`},
        true,
        ${JSON.stringify({ email, fullName, mustChangePassword: true })}::jsonb,
        ${retentionDate}::date,
        false
      )
    `,
  );
}

async function main() {
  if (await adminExists()) {
    console.info("[seed-admin] Administrator account already exists; skipping.");
    return;
  }

  const email = (process.env.DEFAULT_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL).trim().toLowerCase();
  const fullName = (process.env.DEFAULT_ADMIN_NAME || DEFAULT_ADMIN_NAME).trim();
  const password = (process.env.DEFAULT_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD).trim();

  if (!email || !password || !fullName) {
    throw new Error("Default administrator email, password, and display name are required.");
  }

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existingUser) {
    console.error(
      `[seed-admin] Cannot create default admin: user ${email} exists but no administrator profile was found.`,
    );
    process.exit(1);
  }

  const initials = initialsFromFullName(fullName);

  const created = await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw(
      Prisma.sql`
        INSERT INTO public.users (
          email,
          password_hash,
          is_active,
          is_locked,
          failed_login_attempts,
          must_change_password
        )
        VALUES (
          ${email}::text,
          crypt(${password}::text, gen_salt('bf')),
          true,
          false,
          0,
          true
        )
        RETURNING id::text AS id
      `,
    );
    const id = inserted[0]?.id;
    if (!id) throw new Error("Failed to create default administrator user.");

    await tx.userProfile.create({
      data: {
        user_id: id,
        full_name: fullName,
        initials,
        role: "administrator",
      },
    });

    return { id, email, fullName };
  });

  await writeSeedAuditLog(created.id, created.email, created.fullName);

  console.info(`[seed-admin] Created default administrator: ${email} (${fullName})`);
  console.info("================================================================");
  console.info("TEMPORARY DEFAULT ADMIN CREDENTIALS (change immediately after first login):");
  console.info(`  Email:    ${email}`);
  console.info(`  Password: ${password}`);
  console.info("================================================================");
}

main()
  .catch((err) => {
    console.error("[seed-admin] Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
