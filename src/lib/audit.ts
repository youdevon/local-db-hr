import "server-only";

import { Prisma } from "@prisma/client";

import {
  calculateRetentionUntil,
  getAuditRetentionSettings,
} from "@/lib/audit-retention";
import { getRequestMeta } from "@/lib/request-meta";
import { prisma } from "@/lib/prisma";

export type CreateSystemAuditLogInput = {
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorName?: string | null;
  module: string;
  action: string;
  targetType?: string | null;
  targetId?: string | null;
  targetLabel?: string | null;
  success: boolean;
  failureReason?: string | null;
  ipAddress?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  metadata?: unknown;
};

export type CreateLoginAuditLogInput = {
  userId?: string | null;
  emailAttempted: string;
  action: "login" | "failed_login" | "logout" | "password_change";
  success: boolean;
  ipAddress?: string | null;
  deviceName?: string | null;
  userAgent?: string | null;
  failureReason?: string | null;
};

export async function getAuditRequestContext() {
  return getRequestMeta();
}

export async function createLoginAuditLog(input: CreateLoginAuditLogInput): Promise<void> {
  try {
    const settings = await getAuditRetentionSettings();
    const retentionUntil = calculateRetentionUntil(new Date(), settings);
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO public.login_audit_logs (
          user_id,
          email_attempted,
          action,
          success,
          ip_address,
          device_name,
          user_agent,
          failure_reason,
          retention_until,
          legal_hold
        )
        VALUES (
          ${input.userId ?? null}::uuid,
          ${input.emailAttempted.trim()},
          ${input.action},
          ${input.success},
          ${input.ipAddress || null}::inet,
          ${input.deviceName?.trim() || null},
          ${input.userAgent || null},
          ${input.failureReason?.trim() || null},
          ${retentionUntil}::date,
          false
        )
      `,
    );
  } catch {
    // Never block user flows if audit write fails.
  }
}

export async function createSystemAuditLog(input: CreateSystemAuditLogInput): Promise<void> {
  try {
    const settings = await getAuditRetentionSettings();
    let actorEmail = input.actorEmail?.trim() || null;
    let actorName = input.actorName?.trim() || null;

    if (input.actorUserId && (!actorEmail || !actorName)) {
      const actor = await prisma.user.findUnique({
        where: { id: input.actorUserId },
        select: {
          email: true,
          profile: { select: { full_name: true } },
        },
      });
      actorEmail = actorEmail || actor?.email || null;
      actorName = actorName || actor?.profile?.full_name || null;
    }

    const metadataJson = input.metadata === undefined ? null : JSON.stringify(input.metadata);
    const retentionUntil = calculateRetentionUntil(new Date(), settings);

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
          failure_reason,
          ip_address,
          device_name,
          user_agent,
          metadata,
          retention_until,
          legal_hold
        )
        VALUES (
          ${input.actorUserId ?? null}::uuid,
          ${actorEmail},
          ${actorName},
          ${input.module.trim()},
          ${input.action.trim()},
          ${input.targetType?.trim() || null},
          ${input.targetId ?? null}::uuid,
          ${input.targetLabel?.trim() || null},
          ${input.success},
          ${input.failureReason?.trim() || null},
          ${input.ipAddress || null}::inet,
          ${input.deviceName?.trim() || null},
          ${input.userAgent || null},
          ${metadataJson}::jsonb,
          ${retentionUntil}::date,
          false
        )
      `,
    );
  } catch {
    // Never block user flows if audit write fails.
  }
}
