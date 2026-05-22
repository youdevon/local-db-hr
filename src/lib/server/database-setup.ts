import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type DatabaseSetupStatus =
  | { ready: true }
  | { ready: false; message: string; details: string[] };

const SETUP_MESSAGE =
  "The HR database schema is not ready. Run database migrations and restore a backup before using the application.";

const SETUP_DETAILS = [
  "Ensure PostgreSQL is running and DATABASE_URL is configured.",
  "Run: npx prisma migrate deploy",
  "If upgrading an existing database, restore your backup or run sql/performance-indexes.sql as documented.",
  "Verify installation with: npm run validate:install",
];

export function isMissingEmployeesTableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021") return true;
    if (error.code === "P2010") {
      const message = String(error.meta?.message ?? error.message ?? "").toLowerCase();
      return message.includes("employees") && message.includes("does not exist");
    }
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      (message.includes("relation") && message.includes("employees") && message.includes("does not exist")) ||
      (message.includes("table") && message.includes("employees") && message.includes("does not exist"))
    );
  }

  return false;
}

export async function employeesTableExists(): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<Array<{ exists: boolean }>>(Prisma.sql`
      SELECT to_regclass('public.employees') IS NOT NULL AS "exists"
    `);
    return rows[0]?.exists === true;
  } catch {
    return false;
  }
}

export async function getDatabaseSetupStatus(): Promise<DatabaseSetupStatus> {
  const exists = await employeesTableExists();
  if (exists) return { ready: true };

  return {
    ready: false,
    message: SETUP_MESSAGE,
    details: SETUP_DETAILS,
  };
}

export async function assertEmployeesTableReady(): Promise<void> {
  const status = await getDatabaseSetupStatus();
  if (!status.ready) {
    throw new DatabaseSetupError(status.message, status.details);
  }
}

export class DatabaseSetupError extends Error {
  readonly details: string[];

  constructor(message: string, details: string[] = SETUP_DETAILS) {
    super(message);
    this.name = "DatabaseSetupError";
    this.details = details;
  }
}
