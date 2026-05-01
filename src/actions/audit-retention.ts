"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import {
  DEFAULT_AUDIT_RETENTION_SETTINGS,
} from "@/lib/audit-retention";
import { prisma } from "@/lib/prisma";

const auditRetentionSchema = z.object({
  liveRetentionMonths: z.number().int().min(1).max(240),
  totalRetentionYears: z.number().int().min(1).max(30),
  archiveEnabled: z.boolean(),
  legalHoldEnabled: z.boolean(),
  autoDeleteEnabled: z.boolean(),
  deleteOnlyIfNotOnLegalHold: z.boolean(),
});

export type AuditRetentionFormInput = z.infer<typeof auditRetentionSchema>;
export type AuditRetentionResult =
  | { success: true; message: string }
  | { success: false; message: string };

async function getActor() {
  const session = await getSession();
  const user = session.user;
  return {
    actorUserId: user?.userId ?? null,
    actorEmail: user?.email ?? null,
    actorName: user?.name ?? null,
  };
}

export async function saveAuditRetentionSettingsAction(input: unknown): Promise<AuditRetentionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const parsed = auditRetentionSchema.safeParse(input);
  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!parsed.success) {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_audit_retention_settings",
      targetType: "settings",
      targetLabel: "Settings: Audit Retention",
      success: false,
      failureReason: "Invalid audit retention settings.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to update audit retention settings. Please try again." };
  }

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO public.app_settings (
          setting_key,
          setting_value,
          description
        )
        VALUES (
          'audit_retention',
          ${JSON.stringify(parsed.data)}::jsonb,
          'Default audit retention settings for login and system activity audit logs.'
        )
        ON CONFLICT (setting_key)
        DO UPDATE SET
          setting_value = EXCLUDED.setting_value,
          description = EXCLUDED.description,
          updated_at = NOW()
      `,
    );

    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_audit_retention_settings",
      targetType: "settings",
      targetLabel: "Settings: Audit Retention",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidatePath("/settings");
    revalidatePath("/settings/audit-retention");
    revalidatePath("/audit");
    return { success: true, message: "Audit retention settings updated successfully." };
  } catch {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_audit_retention_settings",
      targetType: "settings",
      targetLabel: "Settings: Audit Retention",
      success: false,
      failureReason: "Failed to update audit retention settings. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to update audit retention settings. Please try again." };
  }
}

export async function resetAuditRetentionSettingsAction(): Promise<AuditRetentionResult> {
  return saveAuditRetentionSettingsAction(DEFAULT_AUDIT_RETENTION_SETTINGS);
}
