import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type AuditRetentionSettings = {
  liveRetentionMonths: number;
  totalRetentionYears: number;
  archiveEnabled: boolean;
  legalHoldEnabled: boolean;
  autoDeleteEnabled: boolean;
  deleteOnlyIfNotOnLegalHold: boolean;
};

export const DEFAULT_AUDIT_RETENTION_SETTINGS: AuditRetentionSettings = {
  liveRetentionMonths: 24,
  totalRetentionYears: 7,
  archiveEnabled: true,
  legalHoldEnabled: true,
  autoDeleteEnabled: false,
  deleteOnlyIfNotOnLegalHold: true,
};

export async function getAuditRetentionSettings(): Promise<AuditRetentionSettings> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
    Prisma.sql`
      SELECT setting_value
      FROM public.app_settings
      WHERE setting_key = 'audit_retention'
      LIMIT 1
    `,
  );

  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return DEFAULT_AUDIT_RETENTION_SETTINGS;
  const data = raw as Partial<AuditRetentionSettings>;

  return {
    liveRetentionMonths:
      Number.isFinite(Number(data.liveRetentionMonths)) && Number(data.liveRetentionMonths) > 0
        ? Number(data.liveRetentionMonths)
        : DEFAULT_AUDIT_RETENTION_SETTINGS.liveRetentionMonths,
    totalRetentionYears:
      Number.isFinite(Number(data.totalRetentionYears)) && Number(data.totalRetentionYears) > 0
        ? Number(data.totalRetentionYears)
        : DEFAULT_AUDIT_RETENTION_SETTINGS.totalRetentionYears,
    archiveEnabled:
      typeof data.archiveEnabled === "boolean"
        ? data.archiveEnabled
        : DEFAULT_AUDIT_RETENTION_SETTINGS.archiveEnabled,
    legalHoldEnabled:
      typeof data.legalHoldEnabled === "boolean"
        ? data.legalHoldEnabled
        : DEFAULT_AUDIT_RETENTION_SETTINGS.legalHoldEnabled,
    autoDeleteEnabled:
      typeof data.autoDeleteEnabled === "boolean"
        ? data.autoDeleteEnabled
        : DEFAULT_AUDIT_RETENTION_SETTINGS.autoDeleteEnabled,
    deleteOnlyIfNotOnLegalHold:
      typeof data.deleteOnlyIfNotOnLegalHold === "boolean"
        ? data.deleteOnlyIfNotOnLegalHold
        : DEFAULT_AUDIT_RETENTION_SETTINGS.deleteOnlyIfNotOnLegalHold,
  };
}

export function calculateRetentionUntil(
  createdAt: Date,
  settings: AuditRetentionSettings = DEFAULT_AUDIT_RETENTION_SETTINGS,
): string {
  const retention = new Date(createdAt);
  retention.setFullYear(retention.getFullYear() + settings.totalRetentionYears);
  return retention.toISOString().slice(0, 10);
}

export async function markAuditLogArchiveCandidates(): Promise<{ loginMarked: number; systemMarked: number }> {
  const settings = await getAuditRetentionSettings();
  if (!settings.archiveEnabled) return { loginMarked: 0, systemMarked: 0 };

  // Future-safe helper: mark archive candidates; no deletion performed.
  const loginMarked = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.login_audit_logs
      SET archived_at = NOW()
      WHERE archived_at IS NULL
        AND created_at < NOW() - (${settings.liveRetentionMonths}::text || ' months')::interval
    `,
  );
  const systemMarked = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.system_audit_logs
      SET archived_at = NOW()
      WHERE archived_at IS NULL
        AND created_at < NOW() - (${settings.liveRetentionMonths}::text || ' months')::interval
    `,
  );
  return { loginMarked: Number(loginMarked), systemMarked: Number(systemMarked) };
}

export function getAuditLogScopeFilter(scope: "active" | "archived" | "all") {
  // Schema changes are managed manually outside app runtime.
  // Keep defaults non-breaking even when archive columns are not present.
  if (scope === "archived") return Prisma.sql`archived_at IS NOT NULL`;
  if (scope === "all") return Prisma.sql`1 = 1`;
  return Prisma.sql`1 = 1`;
}
