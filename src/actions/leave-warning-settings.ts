"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import {
  DEFAULT_LEAVE_WARNING_SETTINGS,
  type LeaveWarningSettings,
} from "@/lib/leave-warning-defaults";
import { prisma } from "@/lib/prisma";

const leaveWarningSettingsSchema = z.object({
  lowVacationLeaveThresholdDays: z.coerce.number().min(0),
  lowSickLeaveThresholdDays: z.coerce.number().min(0),
  lowGeneralLeaveThresholdDays: z.coerce.number().min(0),
  warnWhenRemainingAtOrBelowThreshold: z.boolean(),
  showLowLeaveBadge: z.boolean(),
});

type LeaveWarningSettingsResult = { success: boolean; message: string };

async function getActor() {
  const session = await getSession();
  const user = session.user;
  return {
    actorUserId: user?.userId ?? null,
    actorEmail: user?.email ?? null,
    actorName: user?.name ?? null,
  };
}

export async function saveLeaveWarningSettingsAction(input: unknown): Promise<LeaveWarningSettingsResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const parsed = leaveWarningSettingsSchema.safeParse(input);
  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!parsed.success) {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_leave_warning_settings",
      targetType: "settings",
      targetLabel: "Settings: Leave Warning Settings",
      success: false,
      failureReason: "Invalid leave warning settings.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Unable to update leave warning settings. Please try again." };
  }

  try {
    await prisma.$executeRaw(
      Prisma.sql`
        INSERT INTO public.app_settings (setting_key, setting_value, description)
        VALUES (
          'leave_warning_settings',
          ${JSON.stringify(parsed.data)}::jsonb,
          'Leave warning settings used across leave balances and dashboard warnings.'
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
      action: "updated_leave_warning_settings",
      targetType: "settings",
      targetLabel: "Settings: Leave Warning Settings",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    revalidatePath("/leave");
    revalidatePath("/settings");
    revalidatePath("/settings/leave-warning");
    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/reports");
    return { success: true, message: "Leave warning settings updated successfully." };
  } catch (error) {
    console.error("[leave-warning-settings] Failed to update leave warning settings", error);
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_leave_warning_settings",
      targetType: "settings",
      targetLabel: "Settings: Leave Warning Settings",
      success: false,
      failureReason: "Failed to update leave warning settings. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Unable to update leave warning settings. Please try again." };
  }
}

export async function resetLeaveWarningSettingsAction(): Promise<LeaveWarningSettingsResult> {
  return saveLeaveWarningSettingsAction(DEFAULT_LEAVE_WARNING_SETTINGS);
}
