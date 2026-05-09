"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { sendHrNotification } from "@/lib/email/hr-notifications";
import { buildSimpleHrTemplate } from "@/lib/email/templates";
import { getSession } from "@/lib/get-session";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS,
  DEFAULT_LOGIN_NOTICE_SETTINGS,
  DEFAULT_LOGIN_PROTECTION_SETTINGS,
  DEFAULT_PASSWORD_POLICY_SETTINGS,
  DEFAULT_ROLE_SAFETY_SETTINGS,
  DEFAULT_SESSION_SETTINGS,
  SECURITY_SETTINGS_KEYS,
  type AuditExportSecuritySettings,
  type LoginNoticeSettings,
  type LoginProtectionSettings,
  type PasswordPolicySettings,
  type RoleSafetySettings,
  type SessionSettings,
} from "@/lib/security-settings";
import { normalizeUserRole } from "@/lib/roles";

type SecuritySettingsActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

const SECURITY_SETTINGS_PERMISSION_MESSAGE =
  "You do not have permission to change security settings.";

const sessionSettingsSchema = z
  .object({
    idleTimeoutMinutes: z.number().int().min(5).max(240),
    absoluteSessionHours: z.number().int().min(1).max(24),
    showTimeoutWarning: z.boolean(),
    warningBeforeMinutes: z.number().int().min(1).max(10),
  })
  .refine((v) => v.warningBeforeMinutes < v.idleTimeoutMinutes, {
    message: "Warning before timeout must be less than idle timeout.",
    path: ["warningBeforeMinutes"],
  });

const loginProtectionSettingsSchema = z.object({
  enableLockout: z.boolean(),
  maxFailedAttempts: z.number().int().min(3).max(10),
  lockoutMinutes: z.number().int().min(5).max(60),
  resetOnSuccessfulLogin: z.boolean(),
});

const passwordPolicySettingsSchema = z
  .object({
    minimumLength: z.number().int().min(8).max(32),
    requireUppercase: z.boolean(),
    requireLowercase: z.boolean(),
    requireNumber: z.boolean(),
    requireSpecialCharacter: z.boolean(),
    passwordExpiryEnabled: z.boolean(),
    passwordExpiryDays: z.number().int().min(30).max(365),
  })
  .superRefine((v, ctx) => {
    if (v.passwordExpiryEnabled && (v.passwordExpiryDays < 30 || v.passwordExpiryDays > 365)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["passwordExpiryDays"],
        message: "Password expiry days must be between 30 and 365.",
      });
    }
  });

const auditExportSecuritySettingsSchema = z.object({
  logSuccessfulLogins: z.boolean(),
  logFailedLogins: z.boolean(),
  logLogouts: z.boolean(),
  logPasswordChanges: z.boolean(),
  logRoleChanges: z.boolean(),
  logEmployeeProfileChanges: z.boolean(),
  logReportExports: z.boolean(),
  requireExportReason: z.boolean(),
  includeExportMetadata: z.boolean(),
});

const loginNoticeSettingsSchema = z.object({
  enabled: z.boolean(),
  noticeText: z.string().trim().min(10).max(1200),
  requireAcknowledgement: z.boolean(),
});

const roleSafetySettingsSchema = z.object({
  preventLastAdminRemoval: z.boolean(),
  preventAdminSelfDemotion: z.boolean(),
  requireRoleChangeConfirmation: z.boolean(),
  requirePermissionChangeReason: z.boolean(),
});

async function requireAdministratorActor() {
  const session = await getSession();
  const user = session.user;
  const role = normalizeUserRole(user?.role);
  if (!user?.userId || role !== "administrator") return null;
  return {
    actorUserId: user.userId,
    actorEmail: user.email,
    actorName: user.name,
  };
}

async function writeSettings({
  key,
  description,
  payload,
}: {
  key: string;
  description: string;
  payload: Record<string, unknown>;
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (
        setting_key,
        setting_value,
        description
      )
      VALUES (
        ${key},
        ${JSON.stringify(payload)}::jsonb,
        ${description}
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );
}

function revalidateSecuritySettingsSurfaces() {
  revalidatePath("/settings");
  revalidatePath("/settings/security");
  revalidatePath("/settings/users");
  revalidatePath("/login");
  revalidatePath("/profile");
  revalidatePath("/reports");
}

async function logSecuritySettingsUpdate(params: {
  actor: { actorUserId: string; actorEmail: string; actorName: string };
  action: string;
  targetLabel: string;
  success: boolean;
  failureReason?: string;
}) {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: params.actor.actorUserId,
    actorEmail: params.actor.actorEmail,
    actorName: params.actor.actorName,
    module: "Global Settings",
    action: params.action,
    targetType: "settings",
    targetLabel: params.targetLabel,
    success: params.success,
    failureReason: params.failureReason ?? null,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  if (params.success) {
    await sendHrNotification({
      notificationType: "security_settings_changed",
      settingKey: "sendSecurityAdminAlerts",
      recipientMode: "hr_only",
      subject: "Security Settings Updated",
      text: buildSimpleHrTemplate({
        lines: [`${params.targetLabel} was updated.`, `Action: ${params.action}`],
      }),
      metadata: { action: params.action, targetLabel: params.targetLabel },
    });
  }
}

export async function saveSessionSettingsAction(input: unknown): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = sessionSettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_session_security_settings",
      targetLabel: "Settings: Session Management",
      success: false,
      failureReason: "Invalid session settings.",
    });
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid session settings." };
  }

  const payload: SessionSettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.session,
    description: "Security settings for session timeout and inactivity controls.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_session_security_settings",
    targetLabel: "Settings: Session Management",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function saveLoginProtectionSettingsAction(input: unknown): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = loginProtectionSettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_login_protection_settings",
      targetLabel: "Settings: Login Protection",
      success: false,
      failureReason: "Invalid login protection settings.",
    });
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid login protection settings." };
  }

  const payload: LoginProtectionSettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.loginProtection,
    description: "Security settings for failed login lockout protection.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_login_protection_settings",
    targetLabel: "Settings: Login Protection",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function savePasswordPolicySettingsAction(input: unknown): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = passwordPolicySettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_password_policy_settings",
      targetLabel: "Settings: Password Policy",
      success: false,
      failureReason: "Invalid password policy settings.",
    });
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid password policy settings." };
  }

  const payload: PasswordPolicySettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.passwordPolicy,
    description: "Security settings for password policy and expiry controls.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_password_policy_settings",
    targetLabel: "Settings: Password Policy",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function saveAuditExportSecuritySettingsAction(
  input: unknown,
): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = auditExportSecuritySettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_audit_export_security_settings",
      targetLabel: "Settings: Audit & Export Security",
      success: false,
      failureReason: "Invalid audit and export security settings.",
    });
    return {
      success: false,
      message: parsed.error.issues[0]?.message ?? "Invalid audit and export security settings.",
    };
  }

  const payload: AuditExportSecuritySettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.auditExport,
    description: "Security settings for audit logging and report export controls.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_audit_export_security_settings",
    targetLabel: "Settings: Audit & Export Security",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function saveLoginNoticeSettingsAction(input: unknown): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = loginNoticeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_login_notice_settings",
      targetLabel: "Settings: Login Security Notice",
      success: false,
      failureReason: "Invalid login notice settings.",
    });
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid login notice settings." };
  }

  const payload: LoginNoticeSettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.loginNotice,
    description: "Security settings for login page notice and acknowledgement requirement.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_login_notice_settings",
    targetLabel: "Settings: Login Security Notice",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function saveRoleSafetySettingsAction(input: unknown): Promise<SecuritySettingsActionResult> {
  const actor = await requireAdministratorActor();
  if (!actor) return { success: false, message: SECURITY_SETTINGS_PERMISSION_MESSAGE };
  const parsed = roleSafetySettingsSchema.safeParse(input);
  if (!parsed.success) {
    await logSecuritySettingsUpdate({
      actor,
      action: "updated_role_safety_settings",
      targetLabel: "Settings: Role Safety",
      success: false,
      failureReason: "Invalid role safety settings.",
    });
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid role safety settings." };
  }

  const payload: RoleSafetySettings = {
    ...parsed.data,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.actorUserId,
  };

  await writeSettings({
    key: SECURITY_SETTINGS_KEYS.roleSafety,
    description: "Security settings for administrator lockout and role change safety guards.",
    payload,
  });
  revalidateSecuritySettingsSurfaces();
  await logSecuritySettingsUpdate({
    actor,
    action: "updated_role_safety_settings",
    targetLabel: "Settings: Role Safety",
    success: true,
  });
  return { success: true, message: "Security settings saved successfully." };
}

export async function resetSessionSettingsAction() {
  return saveSessionSettingsAction(DEFAULT_SESSION_SETTINGS);
}

export async function resetLoginProtectionSettingsAction() {
  return saveLoginProtectionSettingsAction(DEFAULT_LOGIN_PROTECTION_SETTINGS);
}

export async function resetPasswordPolicySettingsAction() {
  return savePasswordPolicySettingsAction(DEFAULT_PASSWORD_POLICY_SETTINGS);
}

export async function resetAuditExportSecuritySettingsAction() {
  return saveAuditExportSecuritySettingsAction(DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS);
}

export async function resetLoginNoticeSettingsAction() {
  return saveLoginNoticeSettingsAction(DEFAULT_LOGIN_NOTICE_SETTINGS);
}

export async function resetRoleSafetySettingsAction() {
  return saveRoleSafetySettingsAction(DEFAULT_ROLE_SAFETY_SETTINGS);
}
