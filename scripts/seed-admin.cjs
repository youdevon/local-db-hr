#!/usr/bin/env node
/**
 * Idempotent default administrator seed.
 * Creates the first admin only when no administrator user profile exists.
 */
"use strict";

const crypto = require("node:crypto");
const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

function initialsFromFullName(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) {
    const w = parts[0];
    return w.slice(0, Math.min(2, w.length)).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function generateTempPassword() {
  return crypto.randomBytes(18).toString("base64url");
}

async function adminExists() {
  const row = await prisma.userProfile.findFirst({
    where: { role: "administrator" },
    select: { user_id: true },
  });
  return Boolean(row);
}

async function main() {
  if (await adminExists()) {
    console.info("[seed-admin] Administrator account already exists; skipping.");
    return;
  }

  const email = (process.env.DEFAULT_ADMIN_EMAIL || "admin@local-db-hr.local").trim().toLowerCase();
  const fullName = (process.env.DEFAULT_ADMIN_NAME || "System Administrator").trim();
  let password = process.env.DEFAULT_ADMIN_PASSWORD?.trim() || "";
  let generatedPassword = false;

  if (!password) {
    password = generateTempPassword();
    generatedPassword = true;
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

  await prisma.$transaction(async (tx) => {
    const inserted = await tx.$queryRaw(
      Prisma.sql`
        INSERT INTO public.users (email, password_hash, is_active, is_locked, failed_login_attempts)
        VALUES (
          ${email}::text,
          crypt(${password}::text, gen_salt('bf')),
          true,
          false,
          0
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
  });

  console.info(`[seed-admin] Created default administrator: ${email} (${fullName})`);
  if (generatedPassword) {
    console.info("================================================================");
    console.info("DEFAULT ADMIN TEMPORARY PASSWORD (shown once — change after login):");
    console.info(password);
    console.info("================================================================");
  } else {
    console.info("[seed-admin] Used DEFAULT_ADMIN_PASSWORD from environment.");
  }
}

main()
  .catch((err) => {
    console.error("[seed-admin] Failed:", err instanceof Error ? err.message : err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
