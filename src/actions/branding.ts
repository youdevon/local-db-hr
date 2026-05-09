"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import {
  BRANDING_SETTINGS_KEY,
  DEFAULT_COMPANY_NAME,
  type BrandingSettings,
} from "@/lib/branding";
import { prisma } from "@/lib/prisma";
import { normalizeUserRole } from "@/lib/roles";

const BRANDING_PERMISSION_MESSAGE = "You do not have permission to change branding settings.";

type BrandingActionResult =
  | { success: true; message: string; settings: BrandingSettings }
  | { success: false; message: string };

async function actorContext() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  return {
    actorUserId: session.user?.userId ?? null,
    actorEmail: session.user?.email ?? null,
    actorName: session.user?.name ?? null,
    role,
  };
}

function trimCompanyName(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function writeBrandingSettings(data: {
  companyName: string | null;
  updatedBy: string | null;
}): Promise<BrandingSettings> {
  const payload = {
    companyName: data.companyName,
    logoUrl: null,
    logoDarkUrl: null,
    updatedAt: new Date().toISOString(),
    updatedBy: data.updatedBy,
  };

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (setting_key, setting_value, description)
      VALUES (
        ${BRANDING_SETTINGS_KEY},
        ${JSON.stringify(payload)}::jsonb,
        'Global branding configuration including company name and logo.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );

  return {
    companyName: payload.companyName,
    logoUrl: null,
    updatedAt: payload.updatedAt,
    updatedBy: payload.updatedBy,
  };
}

function revalidateBrandingSurfaces() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/login");
  revalidatePath("/settings");
  revalidatePath("/settings/branding");
}

export async function saveBrandingSettingsAction(formData: FormData): Promise<BrandingActionResult> {
  const actor = await actorContext();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!actor.actorUserId || actor.role !== "administrator") {
    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "updated_branding_settings",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: false,
      failureReason: BRANDING_PERMISSION_MESSAGE,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: BRANDING_PERMISSION_MESSAGE };
  }

  const companyName = trimCompanyName(formData.get("companyName"));
  const normalizedCompanyName = companyName ?? DEFAULT_COMPANY_NAME;

  try {
    const settings = await writeBrandingSettings({
      companyName: normalizedCompanyName,
      updatedBy: actor.actorUserId,
    });

    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "updated_branding_settings",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidateBrandingSurfaces();
    return {
      success: true,
      message: "Branding settings updated successfully.",
      settings,
    };
  } catch {
    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "updated_branding_settings",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: false,
      failureReason: "Failed to update branding settings. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to update branding settings. Please try again." };
  }
}

export async function resetBrandingLogoAction(): Promise<BrandingActionResult> {
  const actor = await actorContext();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  if (!actor.actorUserId || actor.role !== "administrator") {
    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "reset_branding_logo",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: false,
      failureReason: BRANDING_PERMISSION_MESSAGE,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: BRANDING_PERMISSION_MESSAGE };
  }

  try {
    const settings = await writeBrandingSettings({
      companyName: DEFAULT_COMPANY_NAME,
      updatedBy: actor.actorUserId,
    });

    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "reset_branding_logo",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidateBrandingSurfaces();
    return { success: true, message: "Branding reset to default successfully.", settings };
  } catch {
    await createSystemAuditLog({
      actorUserId: actor.actorUserId,
      actorEmail: actor.actorEmail,
      actorName: actor.actorName,
      module: "Global Settings",
      action: "reset_branding_logo",
      targetType: "settings",
      targetLabel: "Settings: Branding",
      success: false,
      failureReason: "Failed to reset logo. Please try again.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to reset logo. Please try again." };
  }
}
