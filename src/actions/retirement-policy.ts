"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_RETIREMENT_AGE_POLICY,
  type RetirementAgePolicy,
} from "@/lib/retirement-policy";

const retirementPolicySchema = z.object({
  retirementAge: z.number().int().min(18).max(100),
  enforceRetirementCheck: z.boolean(),
  allowOverride: z.boolean(),
  requireOverrideReason: z.boolean(),
  requireApprovalReference: z.boolean(),
  defaultStopDayBeforeBirthday: z.boolean(),
});

export type RetirementPolicyFormInput = z.infer<typeof retirementPolicySchema>;
export type RetirementPolicyResult =
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

export async function saveRetirementPolicySettingsAction(
  input: unknown,
): Promise<RetirementPolicyResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const parsed = retirementPolicySchema.safeParse(input);
  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!parsed.success) {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_retirement_age_policy",
      targetType: "settings",
      targetLabel: "Settings: Retirement Age Policy",
      success: false,
      failureReason: "Invalid retirement age policy settings.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to update retirement age policy. Please try again." };
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
          'retirement_age_policy',
          ${JSON.stringify(parsed.data)}::jsonb,
          'Retirement age policy used to validate contract periods.'
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
      action: "updated_retirement_age_policy",
      targetType: "settings",
      targetLabel: "Settings: Retirement Age Policy",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidatePath("/settings");
    revalidatePath("/settings/retirement-policy");
    revalidatePath("/");
    return { success: true, message: "Retirement age policy updated successfully." };
  } catch {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "updated_retirement_age_policy",
      targetType: "settings",
      targetLabel: "Settings: Retirement Age Policy",
      success: false,
      failureReason: "Failed to update retirement age policy. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to update retirement age policy. Please try again." };
  }
}

export async function resetRetirementPolicySettingsAction(): Promise<RetirementPolicyResult> {
  return saveRetirementPolicySettingsAction(DEFAULT_RETIREMENT_AGE_POLICY);
}

export type { RetirementAgePolicy };

