import "server-only";

import { Prisma } from "@prisma/client";

import { decryptEmailSecret, encryptEmailSecret } from "@/lib/email/email-encryption";
import { prisma } from "@/lib/prisma";

export const EMAIL_NOTIFICATION_SETTINGS_KEY = "email_notification_settings" as const;

export type EmailNotificationSettings = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPasswordEncrypted: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  sendLowLeaveAlerts: boolean;
  sendEmployeeProfileCreatedAlerts: boolean;
  sendEmployeeProfileUpdatedAlerts: boolean;
  sendNewContractAlerts: boolean;
  sendContractUpdatedAlerts: boolean;
  sendContractExpiryAlerts: boolean;
  sendContractExpiredAlerts: boolean;
  sendLeaveTransactionUpdatedAlerts: boolean;
  sendLeaveTransactionDeletedAlerts: boolean;
  sendLicenceAlerts: boolean;
  sendSecurityAdminAlerts: boolean;
  sendEmployeeSpecificAlertsToEmployeeEmail: boolean;
  sendCopyToHr: boolean;
  hrCopyEmails: string[];
  adminAlertEmails: string[];
  contractExpiryWarningDays: number[];
  repeatLowLeaveAlertsEveryDays: number;
  /** When true (default), email employee after leave is recorded; only applies if `enabled` is true. */
  sendLeaveTakenRecordedAlerts: boolean;
  updatedAt: string;
  updatedBy: string | null;
};

export type PublicEmailNotificationSettings = Omit<EmailNotificationSettings, "smtpPasswordEncrypted"> & {
  hasSmtpPassword: boolean;
};

export type DecryptedEmailNotificationSettings = Omit<EmailNotificationSettings, "smtpPasswordEncrypted"> & {
  smtpPassword: string;
};

export type EmailLogStatus = "sent" | "failed" | "skipped";

export type EmailNotificationLogRow = {
  id: string;
  notificationType: string;
  recipientEmail: string | null;
  subject: string;
  status: EmailLogStatus;
  errorMessage: string | null;
  sentAt: string | null;
  createdAt: string;
};

const DEFAULT_EMAIL_NOTIFICATION_SETTINGS: EmailNotificationSettings = {
  enabled: false,
  smtpHost: "",
  smtpPort: 587,
  smtpSecure: false,
  smtpUsername: "",
  smtpPasswordEncrypted: "",
  fromEmail: "",
  fromName: "Local DB HR",
  replyToEmail: "",
  sendLowLeaveAlerts: true,
  sendEmployeeProfileCreatedAlerts: false,
  sendEmployeeProfileUpdatedAlerts: false,
  sendNewContractAlerts: true,
  sendContractUpdatedAlerts: false,
  sendContractExpiryAlerts: true,
  sendContractExpiredAlerts: true,
  sendLeaveTransactionUpdatedAlerts: true,
  sendLeaveTransactionDeletedAlerts: true,
  sendLicenceAlerts: true,
  sendSecurityAdminAlerts: true,
  sendEmployeeSpecificAlertsToEmployeeEmail: true,
  sendCopyToHr: false,
  hrCopyEmails: [],
  adminAlertEmails: [],
  contractExpiryWarningDays: [90, 60, 30, 14, 7],
  repeatLowLeaveAlertsEveryDays: 7,
  sendLeaveTakenRecordedAlerts: true,
  updatedAt: new Date(0).toISOString(),
  updatedBy: null,
};

function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function toNumberList(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const parsed = value
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.round(item));
  return parsed.length > 0 ? Array.from(new Set(parsed)).sort((a, b) => b - a) : fallback;
}

function normalizeSettings(raw: unknown): EmailNotificationSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_EMAIL_NOTIFICATION_SETTINGS;
  const data = raw as Record<string, unknown>;
  const nowIso = new Date().toISOString();
  return {
    enabled: Boolean(data.enabled),
    smtpHost: typeof data.smtpHost === "string" ? data.smtpHost.trim() : "",
    smtpPort: toInt(data.smtpPort, 587, 1, 65535),
    smtpSecure: Boolean(data.smtpSecure),
    smtpUsername: typeof data.smtpUsername === "string" ? data.smtpUsername.trim() : "",
    smtpPasswordEncrypted:
      typeof data.smtpPasswordEncrypted === "string" ? data.smtpPasswordEncrypted.trim() : "",
    fromEmail: typeof data.fromEmail === "string" ? data.fromEmail.trim() : "",
    fromName:
      typeof data.fromName === "string" && data.fromName.trim().length > 0
        ? data.fromName.trim()
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.fromName,
    replyToEmail: typeof data.replyToEmail === "string" ? data.replyToEmail.trim() : "",
    sendLowLeaveAlerts:
      typeof data.sendLowLeaveAlerts === "boolean"
        ? data.sendLowLeaveAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendLowLeaveAlerts,
    sendEmployeeProfileCreatedAlerts:
      typeof data.sendEmployeeProfileCreatedAlerts === "boolean"
        ? data.sendEmployeeProfileCreatedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendEmployeeProfileCreatedAlerts,
    sendEmployeeProfileUpdatedAlerts:
      typeof data.sendEmployeeProfileUpdatedAlerts === "boolean"
        ? data.sendEmployeeProfileUpdatedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendEmployeeProfileUpdatedAlerts,
    sendNewContractAlerts:
      typeof data.sendNewContractAlerts === "boolean"
        ? data.sendNewContractAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendNewContractAlerts,
    sendContractUpdatedAlerts:
      typeof data.sendContractUpdatedAlerts === "boolean"
        ? data.sendContractUpdatedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendContractUpdatedAlerts,
    sendContractExpiryAlerts:
      typeof data.sendContractExpiryAlerts === "boolean"
        ? data.sendContractExpiryAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendContractExpiryAlerts,
    sendContractExpiredAlerts:
      typeof data.sendContractExpiredAlerts === "boolean"
        ? data.sendContractExpiredAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendContractExpiredAlerts,
    sendLeaveTransactionUpdatedAlerts:
      typeof data.sendLeaveTransactionUpdatedAlerts === "boolean"
        ? data.sendLeaveTransactionUpdatedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendLeaveTransactionUpdatedAlerts,
    sendLeaveTransactionDeletedAlerts:
      typeof data.sendLeaveTransactionDeletedAlerts === "boolean"
        ? data.sendLeaveTransactionDeletedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendLeaveTransactionDeletedAlerts,
    sendLicenceAlerts:
      typeof data.sendLicenceAlerts === "boolean"
        ? data.sendLicenceAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendLicenceAlerts,
    sendSecurityAdminAlerts:
      typeof data.sendSecurityAdminAlerts === "boolean"
        ? data.sendSecurityAdminAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendSecurityAdminAlerts,
    sendEmployeeSpecificAlertsToEmployeeEmail:
      typeof data.sendEmployeeSpecificAlertsToEmployeeEmail === "boolean"
        ? data.sendEmployeeSpecificAlertsToEmployeeEmail
        : typeof data.sendToEmployee === "boolean"
          ? data.sendToEmployee
          : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendEmployeeSpecificAlertsToEmployeeEmail,
    sendCopyToHr:
      typeof data.sendCopyToHr === "boolean"
        ? data.sendCopyToHr
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendCopyToHr,
    hrCopyEmails: toStringList(data.hrCopyEmails),
    adminAlertEmails: toStringList(data.adminAlertEmails),
    contractExpiryWarningDays: toNumberList(
      data.contractExpiryWarningDays,
      DEFAULT_EMAIL_NOTIFICATION_SETTINGS.contractExpiryWarningDays,
    ),
    repeatLowLeaveAlertsEveryDays: toInt(data.repeatLowLeaveAlertsEveryDays, 7, 1, 365),
    sendLeaveTakenRecordedAlerts:
      typeof data.sendLeaveTakenRecordedAlerts === "boolean"
        ? data.sendLeaveTakenRecordedAlerts
        : DEFAULT_EMAIL_NOTIFICATION_SETTINGS.sendLeaveTakenRecordedAlerts,
    updatedAt:
      typeof data.updatedAt === "string" && data.updatedAt.trim().length > 0 ? data.updatedAt : nowIso,
    updatedBy: typeof data.updatedBy === "string" ? data.updatedBy : null,
  };
}

export async function getEmailNotificationSettings(): Promise<EmailNotificationSettings> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
    SELECT setting_value
    FROM public.app_settings
    WHERE setting_key = ${EMAIL_NOTIFICATION_SETTINGS_KEY}
    LIMIT 1
  `);
  return normalizeSettings(rows[0]?.setting_value);
}

export async function getPublicEmailNotificationSettings(): Promise<PublicEmailNotificationSettings> {
  const settings = await getEmailNotificationSettings();
  return {
    enabled: settings.enabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUsername: settings.smtpUsername,
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    replyToEmail: settings.replyToEmail,
    sendLowLeaveAlerts: settings.sendLowLeaveAlerts,
    sendEmployeeProfileCreatedAlerts: settings.sendEmployeeProfileCreatedAlerts,
    sendEmployeeProfileUpdatedAlerts: settings.sendEmployeeProfileUpdatedAlerts,
    sendNewContractAlerts: settings.sendNewContractAlerts,
    sendContractUpdatedAlerts: settings.sendContractUpdatedAlerts,
    sendContractExpiryAlerts: settings.sendContractExpiryAlerts,
    sendContractExpiredAlerts: settings.sendContractExpiredAlerts,
    sendLeaveTransactionUpdatedAlerts: settings.sendLeaveTransactionUpdatedAlerts,
    sendLeaveTransactionDeletedAlerts: settings.sendLeaveTransactionDeletedAlerts,
    sendLicenceAlerts: settings.sendLicenceAlerts,
    sendSecurityAdminAlerts: settings.sendSecurityAdminAlerts,
    sendEmployeeSpecificAlertsToEmployeeEmail: settings.sendEmployeeSpecificAlertsToEmployeeEmail,
    sendCopyToHr: settings.sendCopyToHr,
    hrCopyEmails: settings.hrCopyEmails,
    adminAlertEmails: settings.adminAlertEmails,
    contractExpiryWarningDays: settings.contractExpiryWarningDays,
    repeatLowLeaveAlertsEveryDays: settings.repeatLowLeaveAlertsEveryDays,
    sendLeaveTakenRecordedAlerts: settings.sendLeaveTakenRecordedAlerts,
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
    hasSmtpPassword: settings.smtpPasswordEncrypted.trim().length > 0,
  };
}

export async function getEmailNotificationSettingsWithPassword(): Promise<DecryptedEmailNotificationSettings> {
  const settings = await getEmailNotificationSettings();
  const smtpPassword =
    settings.smtpPasswordEncrypted.trim().length > 0
      ? decryptEmailSecret(settings.smtpPasswordEncrypted)
      : "";
  return {
    ...settings,
    smtpPassword,
  };
}

export async function saveEmailNotificationSettings(
  input: Omit<EmailNotificationSettings, "smtpPasswordEncrypted"> & {
    smtpPassword?: string | null;
    keepExistingPassword?: boolean;
  },
): Promise<EmailNotificationSettings> {
  const existing = await getEmailNotificationSettings();

  const nextPasswordEncrypted =
    typeof input.smtpPassword === "string" && input.smtpPassword.length > 0
      ? encryptEmailSecret(input.smtpPassword)
      : input.keepExistingPassword
        ? existing.smtpPasswordEncrypted
        : existing.smtpPasswordEncrypted;

  const next: EmailNotificationSettings = {
    ...input,
    smtpPasswordEncrypted: nextPasswordEncrypted,
  };

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (setting_key, setting_value, description)
      VALUES (
        ${EMAIL_NOTIFICATION_SETTINGS_KEY},
        ${JSON.stringify(next)}::jsonb,
        'Email notification settings used for SMTP delivery, testing, and alert notifications.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );

  return next;
}

export async function createEmailNotificationLog(input: {
  notificationType: string;
  employeeId?: string | null;
  contractId?: string | null;
  leaveBalanceId?: string | null;
  recipientEmail?: string | null;
  ccEmail?: string | null;
  subject: string;
  status: EmailLogStatus;
  errorMessage?: string | null;
  sentAt?: Date | null;
  metadata?: unknown;
}) {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.email_notification_logs (
        notification_type,
        employee_id,
        contract_id,
        leave_balance_id,
        recipient_email,
        cc_email,
        subject,
        status,
        error_message,
        sent_at,
        metadata
      )
      VALUES (
        ${input.notificationType},
        ${input.employeeId ?? null}::uuid,
        ${input.contractId ?? null}::uuid,
        ${input.leaveBalanceId ?? null}::uuid,
        ${input.recipientEmail ?? null},
        ${input.ccEmail ?? null},
        ${input.subject},
        ${input.status},
        ${input.errorMessage ?? null},
        ${input.sentAt ?? null}::timestamptz,
        ${JSON.stringify(input.metadata ?? null)}::jsonb
      )
    `,
  );
}

export async function getRecentEmailNotificationLogs(limit = 30): Promise<EmailNotificationLogRow[]> {
  const safeLimit = toInt(limit, 30, 1, 200);
  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      notification_type: string;
      recipient_email: string | null;
      subject: string;
      status: EmailLogStatus;
      error_message: string | null;
      sent_at: Date | null;
      created_at: Date;
    }>
  >(Prisma.sql`
    SELECT
      id::text AS id,
      notification_type,
      recipient_email,
      subject,
      status,
      error_message,
      sent_at,
      created_at
    FROM public.email_notification_logs
    ORDER BY created_at DESC
    LIMIT ${safeLimit}
  `);

  return rows.map((row) => ({
    id: row.id,
    notificationType: row.notification_type,
    recipientEmail: row.recipient_email,
    subject: row.subject,
    status: row.status,
    errorMessage: row.error_message,
    sentAt: row.sent_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
  }));
}

export async function wasNotificationSentRecently(input: {
  notificationType: string;
  employeeId?: string | null;
  contractId?: string | null;
  leaveBalanceId?: string | null;
  recipientEmail?: string | null;
  sinceDays: number;
  metadataContains?: Record<string, unknown>;
}): Promise<boolean> {
  const sinceDays = toInt(input.sinceDays, 7, 1, 365);
  const sinceDaysInt = Math.trunc(sinceDays);
  const metadataJson = input.metadataContains
    ? Prisma.sql`AND metadata @> ${JSON.stringify(input.metadataContains)}::jsonb`
    : Prisma.empty;
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.email_notification_logs
    WHERE notification_type = ${input.notificationType}
      AND status = 'sent'
      AND created_at >= NOW() - make_interval(days => CAST(${sinceDaysInt} AS INTEGER))
      AND (${input.employeeId ?? null}::uuid IS NULL OR employee_id = ${input.employeeId ?? null}::uuid)
      AND (${input.contractId ?? null}::uuid IS NULL OR contract_id = ${input.contractId ?? null}::uuid)
      AND (${input.leaveBalanceId ?? null}::uuid IS NULL OR leave_balance_id = ${input.leaveBalanceId ?? null}::uuid)
      AND (${input.recipientEmail ?? null} IS NULL OR recipient_email = ${input.recipientEmail ?? null})
      ${metadataJson}
  `);
  return (rows[0]?.count ?? 0) > 0;
}
