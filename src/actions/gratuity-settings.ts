"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import {
  getGratuitySettings,
  normalizeGratuitySettings,
  saveGratuitySettings,
  type GratuityCalculationSettings,
} from "@/lib/gratuity-settings";
import { normalizeUserRole } from "@/lib/roles";

const GRATUITY_PERMISSION_MESSAGE = "You do not have permission to change gratuity settings.";

const gratuitySchema = z.object({
  gratuityRate: z.coerce.number().min(0).max(100),
  governmentTaxRate: z.coerce.number().min(0).max(100),
  effectiveFrom: z.string().trim().min(1),
  active: z.coerce.boolean(),
});

type GratuitySettingsActionResult =
  | { success: true; message: string; settings: GratuityCalculationSettings }
  | { success: false; message: string };

async function requireAdministrator() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!session.user?.userId || role !== "administrator") return null;
  return session.user;
}

export async function saveGratuitySettingsAction(input: unknown): Promise<GratuitySettingsActionResult> {
  const actor = await requireAdministrator();
  if (!actor) return { success: false, message: GRATUITY_PERMISSION_MESSAGE };

  const parsed = gratuitySchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid gratuity settings.",
    };
  }

  const previous = await getGratuitySettings();
  const nextInput = normalizeGratuitySettings(parsed.data);
  const saved = await saveGratuitySettings(nextInput);
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "Settings",
    action: "updated_gratuity_settings",
    targetType: "settings",
    targetLabel: "Settings: Gratuity",
    success: true,
    metadata: {
      previousSettings: previous,
      newSettings: saved,
      expiredContractsNotRecalculated: true,
      note: "Changes apply to new/current contracts; expired contracts retain historical gratuity values.",
    },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });

  revalidatePath("/settings/gratuity");
  revalidatePath("/contracts");
  revalidatePath("/");

  return {
    success: true,
    message:
      "Gratuity settings updated. Changes apply to new/current contracts. Expired contracts retain their historical gratuity values.",
    settings: saved,
  };
}
