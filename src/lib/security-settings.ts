import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const SECURITY_SETTINGS_KEYS = {
  session: "session_settings",
  loginProtection: "login_protection_settings",
  passwordPolicy: "password_policy_settings",
  auditExport: "audit_export_security_settings",
  loginNotice: "login_notice_settings",
  roleSafety: "role_safety_settings",
} as const;

export type SessionSettings = {
  idleTimeoutMinutes: number;
  absoluteSessionHours: number;
  showTimeoutWarning: boolean;
  warningBeforeMinutes: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LoginProtectionSettings = {
  enableLockout: boolean;
  maxFailedAttempts: number;
  lockoutMinutes: number;
  resetOnSuccessfulLogin: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type PasswordPolicySettings = {
  minimumLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSpecialCharacter: boolean;
  passwordExpiryEnabled: boolean;
  passwordExpiryDays: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type AuditExportSecuritySettings = {
  logSuccessfulLogins: boolean;
  logFailedLogins: boolean;
  logLogouts: boolean;
  logPasswordChanges: boolean;
  logRoleChanges: boolean;
  logEmployeeProfileChanges: boolean;
  logReportExports: boolean;
  requireExportReason: boolean;
  includeExportMetadata: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type LoginNoticeSettings = {
  enabled: boolean;
  noticeText: string;
  requireAcknowledgement: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export type RoleSafetySettings = {
  preventLastAdminRemoval: boolean;
  preventAdminSelfDemotion: boolean;
  requireRoleChangeConfirmation: boolean;
  requirePermissionChangeReason: boolean;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const DEFAULT_SESSION_SETTINGS: SessionSettings = {
  idleTimeoutMinutes: 30,
  absoluteSessionHours: 8,
  showTimeoutWarning: true,
  warningBeforeMinutes: 2,
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_LOGIN_PROTECTION_SETTINGS: LoginProtectionSettings = {
  enableLockout: true,
  maxFailedAttempts: 5,
  lockoutMinutes: 15,
  resetOnSuccessfulLogin: true,
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_PASSWORD_POLICY_SETTINGS: PasswordPolicySettings = {
  minimumLength: 10,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialCharacter: true,
  passwordExpiryEnabled: false,
  passwordExpiryDays: 90,
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS: AuditExportSecuritySettings = {
  logSuccessfulLogins: true,
  logFailedLogins: true,
  logLogouts: true,
  logPasswordChanges: true,
  logRoleChanges: true,
  logEmployeeProfileChanges: true,
  logReportExports: true,
  requireExportReason: false,
  includeExportMetadata: true,
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_LOGIN_NOTICE_SETTINGS: LoginNoticeSettings = {
  enabled: false,
  noticeText: "This system is for authorised users only. Activity may be monitored.",
  requireAcknowledgement: false,
  updatedAt: null,
  updatedBy: null,
};

export const DEFAULT_ROLE_SAFETY_SETTINGS: RoleSafetySettings = {
  preventLastAdminRemoval: true,
  preventAdminSelfDemotion: true,
  requireRoleChangeConfirmation: true,
  requirePermissionChangeReason: true,
  updatedAt: null,
  updatedBy: null,
};

function toInt(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  const rounded = Math.round(num);
  if (rounded < min || rounded > max) return fallback;
  return rounded;
}

function toBool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function toText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

async function readSettingsRow(key: string): Promise<Record<string, unknown> | null> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
    Prisma.sql`
      SELECT setting_value
      FROM public.app_settings
      WHERE setting_key = ${key}
      LIMIT 1
    `,
  );
  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

export async function getSessionSettings(): Promise<SessionSettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.session);
  if (!raw) return DEFAULT_SESSION_SETTINGS;
  return {
    idleTimeoutMinutes: toInt(raw.idleTimeoutMinutes, DEFAULT_SESSION_SETTINGS.idleTimeoutMinutes, 5, 240),
    absoluteSessionHours: toInt(raw.absoluteSessionHours, DEFAULT_SESSION_SETTINGS.absoluteSessionHours, 1, 24),
    showTimeoutWarning: toBool(raw.showTimeoutWarning, DEFAULT_SESSION_SETTINGS.showTimeoutWarning),
    warningBeforeMinutes: toInt(raw.warningBeforeMinutes, DEFAULT_SESSION_SETTINGS.warningBeforeMinutes, 1, 10),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export async function getLoginProtectionSettings(): Promise<LoginProtectionSettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.loginProtection);
  if (!raw) return DEFAULT_LOGIN_PROTECTION_SETTINGS;
  return {
    enableLockout: toBool(raw.enableLockout, DEFAULT_LOGIN_PROTECTION_SETTINGS.enableLockout),
    maxFailedAttempts: toInt(raw.maxFailedAttempts, DEFAULT_LOGIN_PROTECTION_SETTINGS.maxFailedAttempts, 3, 10),
    lockoutMinutes: toInt(raw.lockoutMinutes, DEFAULT_LOGIN_PROTECTION_SETTINGS.lockoutMinutes, 5, 60),
    resetOnSuccessfulLogin: toBool(
      raw.resetOnSuccessfulLogin,
      DEFAULT_LOGIN_PROTECTION_SETTINGS.resetOnSuccessfulLogin,
    ),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export async function getPasswordPolicySettings(): Promise<PasswordPolicySettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.passwordPolicy);
  if (!raw) return DEFAULT_PASSWORD_POLICY_SETTINGS;
  return {
    minimumLength: toInt(raw.minimumLength, DEFAULT_PASSWORD_POLICY_SETTINGS.minimumLength, 8, 32),
    requireUppercase: toBool(raw.requireUppercase, DEFAULT_PASSWORD_POLICY_SETTINGS.requireUppercase),
    requireLowercase: toBool(raw.requireLowercase, DEFAULT_PASSWORD_POLICY_SETTINGS.requireLowercase),
    requireNumber: toBool(raw.requireNumber, DEFAULT_PASSWORD_POLICY_SETTINGS.requireNumber),
    requireSpecialCharacter: toBool(
      raw.requireSpecialCharacter,
      DEFAULT_PASSWORD_POLICY_SETTINGS.requireSpecialCharacter,
    ),
    passwordExpiryEnabled: toBool(
      raw.passwordExpiryEnabled,
      DEFAULT_PASSWORD_POLICY_SETTINGS.passwordExpiryEnabled,
    ),
    passwordExpiryDays: toInt(raw.passwordExpiryDays, DEFAULT_PASSWORD_POLICY_SETTINGS.passwordExpiryDays, 30, 365),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export async function getAuditExportSecuritySettings(): Promise<AuditExportSecuritySettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.auditExport);
  if (!raw) return DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS;
  return {
    logSuccessfulLogins: toBool(raw.logSuccessfulLogins, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logSuccessfulLogins),
    logFailedLogins: toBool(raw.logFailedLogins, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logFailedLogins),
    logLogouts: toBool(raw.logLogouts, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logLogouts),
    logPasswordChanges: toBool(raw.logPasswordChanges, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logPasswordChanges),
    logRoleChanges: toBool(raw.logRoleChanges, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logRoleChanges),
    logEmployeeProfileChanges: toBool(
      raw.logEmployeeProfileChanges,
      DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logEmployeeProfileChanges,
    ),
    logReportExports: toBool(raw.logReportExports, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.logReportExports),
    requireExportReason: toBool(raw.requireExportReason, DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.requireExportReason),
    includeExportMetadata: toBool(
      raw.includeExportMetadata,
      DEFAULT_AUDIT_EXPORT_SECURITY_SETTINGS.includeExportMetadata,
    ),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export async function getLoginNoticeSettings(): Promise<LoginNoticeSettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.loginNotice);
  if (!raw) return DEFAULT_LOGIN_NOTICE_SETTINGS;
  return {
    enabled: toBool(raw.enabled, DEFAULT_LOGIN_NOTICE_SETTINGS.enabled),
    noticeText: toText(raw.noticeText, DEFAULT_LOGIN_NOTICE_SETTINGS.noticeText),
    requireAcknowledgement: toBool(
      raw.requireAcknowledgement,
      DEFAULT_LOGIN_NOTICE_SETTINGS.requireAcknowledgement,
    ),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export async function getRoleSafetySettings(): Promise<RoleSafetySettings> {
  const raw = await readSettingsRow(SECURITY_SETTINGS_KEYS.roleSafety);
  if (!raw) return DEFAULT_ROLE_SAFETY_SETTINGS;
  return {
    preventLastAdminRemoval: toBool(
      raw.preventLastAdminRemoval,
      DEFAULT_ROLE_SAFETY_SETTINGS.preventLastAdminRemoval,
    ),
    preventAdminSelfDemotion: toBool(
      raw.preventAdminSelfDemotion,
      DEFAULT_ROLE_SAFETY_SETTINGS.preventAdminSelfDemotion,
    ),
    requireRoleChangeConfirmation: toBool(
      raw.requireRoleChangeConfirmation,
      DEFAULT_ROLE_SAFETY_SETTINGS.requireRoleChangeConfirmation,
    ),
    requirePermissionChangeReason: toBool(
      raw.requirePermissionChangeReason,
      DEFAULT_ROLE_SAFETY_SETTINGS.requirePermissionChangeReason,
    ),
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export function validatePasswordAgainstPolicy(
  password: string,
  policy: PasswordPolicySettings,
): string | null {
  if (password.length < policy.minimumLength) {
    return `Password must be at least ${policy.minimumLength} characters.`;
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must include at least one uppercase letter.";
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    return "Password must include at least one lowercase letter.";
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }
  if (policy.requireSpecialCharacter && !/[^A-Za-z0-9]/.test(password)) {
    return "Password must include at least one special character.";
  }
  return null;
}
