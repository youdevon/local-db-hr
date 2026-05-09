"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import { saveUpdateCheckSettings } from "@/lib/update-check-settings";

const manifestUrlSchema = z
  .string()
  .trim()
  .min(1, "Manifest URL is required.")
  .superRefine((val, ctx) => {
    try {
      const u = new URL(val);
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        ctx.addIssue({ code: "custom", message: "Only http and https URLs are allowed." });
      }
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter a valid URL." });
    }
  });

const schema = z.object({
  manifestUrl: manifestUrlSchema,
});

export type SaveUpdateCheckSettingsResult =
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

export async function saveUpdateManifestUrlAction(input: unknown): Promise<SaveUpdateCheckSettingsResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const parsed = schema.safeParse(input);
  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Invalid manifest URL.";
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "update_check_settings_invalid",
      targetType: "settings",
      targetLabel: "Settings: Licence & Updates",
      success: false,
      failureReason: msg,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: msg };
  }

  try {
    await saveUpdateCheckSettings({ manifestUrl: parsed.data.manifestUrl });

    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "update_check_settings_saved",
      targetType: "settings",
      targetLabel: "Settings: Licence & Updates",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: { manifestUrl: parsed.data.manifestUrl },
    });

    revalidatePath("/settings");
    revalidatePath("/settings/license");
    return { success: true, message: "Update manifest URL saved." };
  } catch {
    await createSystemAuditLog({
      ...actor,
      module: "Global Settings",
      action: "update_check_settings_save_failed",
      targetType: "settings",
      targetLabel: "Settings: Licence & Updates",
      success: false,
      failureReason: "Database error while saving update check settings.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Could not save settings. Please try again." };
  }
}
