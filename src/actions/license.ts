"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { sendHrNotification } from "@/lib/email/hr-notifications";
import { buildSimpleHrTemplate } from "@/lib/email/templates";
import {
  getLicensePublicKeyPemFromEnv,
  verifyD3hrLicenseKey,
  VerifyLicenseKeyError,
  type SignedLicenseClaims,
} from "@/lib/license-key-verification";
import { getSession } from "@/lib/get-session";
import {
  getDefaultLicenseSettings,
  getLicenseSettings,
  maskLicenseKey,
  saveLicenseSettings,
  type LicenseType,
} from "@/lib/license";
import { normalizeUserRole } from "@/lib/roles";

const LICENSE_PERMISSION_MESSAGE = "You do not have permission to change licence settings.";
const PROVIDER_CONTROLS_DISABLED_MESSAGE =
  "Manual provider licence controls are disabled for this deployment.";
const providerControlsEnabled = process.env.ENABLE_PROVIDER_LICENSE_CONTROLS === "true";

const formSchema = z.object({
  organizationName: z.string().trim().min(1).max(180),
  licenseType: z.enum(["trial", "active", "permanent", "expired", "suspended"]),
  issuedAt: z.string().trim().optional(),
  expiresAt: z.string().trim().optional(),
  gracePeriodDays: z.coerce.number().int().min(0).max(365),
  maxUsers: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional(),
  maxEmployees: z.union([z.literal(""), z.coerce.number().int().min(0).max(10000000)]).optional(),
  issuedBy: z.string().trim().max(180).optional(),
});

type LicenseActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

async function requireAdmin() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!session.user?.userId || role !== "administrator") return null;
  return session.user;
}

function toIsoOrNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeLicenseType(type: LicenseType, expiresAt: string | null) {
  if (type === "trial") return "trial_active" as const;
  if (type === "active") return "active" as const;
  if (type === "permanent") return "permanent" as const;
  if (type === "suspended") return "suspended" as const;
  if (type === "expired") return "expired" as const;
  if (expiresAt) return "active" as const;
  return "active" as const;
}

function statusFromSignedClaims(claims: SignedLicenseClaims) {
  return normalizeLicenseType(claims.licenseType, claims.expiresAt);
}

export async function initializeDefaultLicenseSettingsAction(): Promise<LicenseActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { success: false, message: LICENSE_PERMISSION_MESSAGE };
  if (!providerControlsEnabled) return { success: false, message: PROVIDER_CONTROLS_DISABLED_MESSAGE };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const existing = await getLicenseSettings();
  if (existing) return { success: true, message: "Licence settings are already configured." };

  const defaults = await getDefaultLicenseSettings();
  await saveLicenseSettings({
    organizationName: defaults.organizationName,
    licenseType: defaults.licenseType,
    licenseStatus: defaults.licenseStatus,
    issuedAt: defaults.issuedAt,
    expiresAt: defaults.expiresAt,
    gracePeriodDays: defaults.gracePeriodDays,
    activatedAt: defaults.activatedAt,
    licenceId: defaults.licenceId,
    notes: defaults.notes,
    licenseKey: defaults.licenseKey,
    maxUsers: defaults.maxUsers,
    maxEmployees: defaults.maxEmployees,
    issuedBy: defaults.issuedBy,
    lastValidCheckAt: defaults.lastValidCheckAt,
    lastCheckedAt: defaults.lastCheckedAt,
    clockTamperDetectedAt: defaults.clockTamperDetectedAt,
  });

  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "License",
    action: "created_license_settings",
    targetType: "settings",
    targetLabel: "Settings: License",
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  await sendHrNotification({
    notificationType: "licence_updated",
    settingKey: "sendSecurityAdminAlerts",
    recipientMode: "hr_only",
    subject: "Licence Settings Created",
    text: buildSimpleHrTemplate({
      lines: [`Licence settings were initialized for ${defaults.organizationName}.`],
    }),
    metadata: { organizationName: defaults.organizationName },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/license");
  revalidatePath("/license-expired");
  return { success: true, message: "Licence settings created successfully." };
}

export async function applySignedLicenseKeyAction(licenceKey: string): Promise<LicenseActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { success: false, message: LICENSE_PERMISSION_MESSAGE };

  const pem = getLicensePublicKeyPemFromEnv();
  if (!pem) {
    return {
      success: false,
      message:
        "Licence signature verification is not configured. Set LICENSE_PUBLIC_KEY_PEM on the server with the Ed25519 public key PEM.",
    };
  }

  if (typeof licenceKey !== "string" || !licenceKey.trim()) {
    return { success: false, message: 'Paste a licence key that starts with "D3HR."' };
  }

  let claims: SignedLicenseClaims;
  try {
    claims = await verifyD3hrLicenseKey(licenceKey, pem);
  } catch (e) {
    if (e instanceof VerifyLicenseKeyError) {
      return { success: false, message: e.message };
    }
    throw e;
  }

  const existing = await getLicenseSettings();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const nowIso = new Date().toISOString();

  const nextStatus = statusFromSignedClaims(claims);
  const expiresAt = claims.expiresAt;
  const activatedAt =
    claims.licenseType === "active" || claims.licenseType === "permanent"
      ? existing?.activatedAt ?? nowIso
      : existing?.activatedAt ?? null;

  const keyTrimmed = licenceKey.trim();

  await saveLicenseSettings({
    organizationName: claims.organizationName,
    licenseType: claims.licenseType,
    licenseStatus: nextStatus,
    issuedAt: claims.issuedAt,
    expiresAt,
    gracePeriodDays: claims.gracePeriodDays,
    activatedAt,
    licenceId: claims.licenceId,
    notes: claims.notes?.trim() || null,
    licenseKey: keyTrimmed,
    maxUsers: claims.maxUsers ?? null,
    maxEmployees: claims.maxEmployees ?? null,
    issuedBy: claims.issuedBy?.trim() || null,
    lastValidCheckAt: existing?.lastValidCheckAt ?? null,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    clockTamperDetectedAt: existing?.clockTamperDetectedAt ?? null,
  });

  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "License",
    action: "applied_signed_license_key",
    targetType: "settings",
    targetLabel: "Settings: License",
    success: true,
    metadata: {
      licenceId: claims.licenceId,
      organizationName: claims.organizationName,
      licenseType: claims.licenseType,
      expiresAt: claims.expiresAt,
      gracePeriodDays: claims.gracePeriodDays,
      maxUsers: claims.maxUsers ?? null,
      maxEmployees: claims.maxEmployees ?? null,
      maskedLicenseKey: maskLicenseKey(keyTrimmed),
    },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  await sendHrNotification({
    notificationType: "licence_updated",
    settingKey: "sendSecurityAdminAlerts",
    recipientMode: "hr_only",
    subject: "Licence Key Updated",
    text: buildSimpleHrTemplate({
      lines: [
        `A signed licence key was applied.`,
        `Organization: ${claims.organizationName}`,
        `Licence type: ${claims.licenseType}`,
      ],
    }),
    metadata: { licenceId: claims.licenceId, licenseType: claims.licenseType },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/license");
  revalidatePath("/license-expired");
  revalidatePath("/");
  return { success: true, message: "Signed licence key applied successfully." };
}

export async function saveLicenseSettingsAction(input: unknown): Promise<LicenseActionResult> {
  const actor = await requireAdmin();
  if (!actor) return { success: false, message: LICENSE_PERMISSION_MESSAGE };
  if (!providerControlsEnabled) return { success: false, message: PROVIDER_CONTROLS_DISABLED_MESSAGE };
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid licence settings." };
  }

  const data = parsed.data;
  const existing = await getLicenseSettings();
  const issuedAt = toIsoOrNull(data.issuedAt) ?? existing?.issuedAt ?? new Date().toISOString();
  const expiresAt = toIsoOrNull(data.expiresAt);
  const nowIso = new Date().toISOString();
  const licenseType = data.licenseType;
  const nextStatus = normalizeLicenseType(licenseType, expiresAt);
  const activatedAt =
    licenseType === "active" || licenseType === "permanent"
      ? existing?.activatedAt ?? nowIso
      : existing?.activatedAt ?? null;

  await saveLicenseSettings({
    organizationName: data.organizationName,
    licenseType,
    licenseStatus: nextStatus,
    issuedAt,
    expiresAt,
    gracePeriodDays: data.gracePeriodDays,
    activatedAt,
    licenceId: existing?.licenceId ?? null,
    notes: existing?.notes ?? null,
    licenseKey: existing?.licenseKey ?? null,
    maxUsers: data.maxUsers === "" || data.maxUsers == null ? null : Number(data.maxUsers),
    maxEmployees: data.maxEmployees === "" || data.maxEmployees == null ? null : Number(data.maxEmployees),
    issuedBy: data.issuedBy?.trim() || null,
    lastValidCheckAt: existing?.lastValidCheckAt ?? null,
    lastCheckedAt: existing?.lastCheckedAt ?? null,
    clockTamperDetectedAt: existing?.clockTamperDetectedAt ?? null,
  });

  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "License",
    action: existing ? "updated_license_settings" : "created_license_settings",
    targetType: "settings",
    targetLabel: "Settings: License",
    success: true,
    metadata: {
      previousLicenseType: existing?.licenseType ?? null,
      nextLicenseType: licenseType,
      previousExpiresAt: existing?.expiresAt ?? null,
      nextExpiresAt: expiresAt,
      previousGracePeriodDays: existing?.gracePeriodDays ?? null,
      nextGracePeriodDays: data.gracePeriodDays,
      previousStatus: existing?.licenseStatus ?? null,
      nextStatus,
      previousLicenseKeyMasked: maskLicenseKey(existing?.licenseKey ?? null),
      nextLicenseKeyMasked: maskLicenseKey(existing?.licenseKey ?? null),
    },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  await sendHrNotification({
    notificationType: "licence_updated",
    settingKey: "sendSecurityAdminAlerts",
    recipientMode: "hr_only",
    subject: "Licence Settings Updated",
    text: buildSimpleHrTemplate({
      lines: [`Licence settings were updated for ${data.organizationName}.`, `Licence type: ${licenseType}`],
    }),
    metadata: { nextLicenseType: licenseType, nextStatus },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/license");
  revalidatePath("/license-expired");
  revalidatePath("/");
  return { success: true, message: "Licence settings updated successfully." };
}
