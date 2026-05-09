"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { runEmailAlertCheckNow } from "@/lib/email/email-alert-generator";
import { sendHrNotification } from "@/lib/email/hr-notifications";
import { buildSimpleHrTemplate } from "@/lib/email/templates";
import {
  createEmailNotificationLog,
  getEmailNotificationSettings,
  getPublicEmailNotificationSettings,
  saveEmailNotificationSettings,
  type PublicEmailNotificationSettings,
} from "@/lib/email/email-settings";
import {
  getEmailEncryptionErrorMessage,
  isEmailEncryptionConfigured,
} from "@/lib/email/email-encryption";
import { sendEmail } from "@/lib/email/send-email";
import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";

const EMAIL_PERMISSION_MESSAGE = "You do not have permission to change email notification settings.";

const formSchema = z.object({
  enabled: z.boolean(),
  smtpHost: z.string(),
  smtpPort: z.union([z.number(), z.string()]).optional(),
  smtpSecure: z.boolean(),
  smtpUsername: z.string(),
  smtpPassword: z.string().optional(),
  fromEmail: z.string(),
  fromName: z.string(),
  replyToEmail: z.string(),
  sendLowLeaveAlerts: z.boolean(),
  sendEmployeeProfileCreatedAlerts: z.boolean(),
  sendEmployeeProfileUpdatedAlerts: z.boolean(),
  sendNewContractAlerts: z.boolean(),
  sendContractUpdatedAlerts: z.boolean(),
  sendContractExpiryAlerts: z.boolean(),
  sendContractExpiredAlerts: z.boolean(),
  sendLeaveTransactionUpdatedAlerts: z.boolean(),
  sendLeaveTransactionDeletedAlerts: z.boolean(),
  sendLicenceAlerts: z.boolean(),
  sendSecurityAdminAlerts: z.boolean(),
  sendEmployeeSpecificAlertsToEmployeeEmail: z.boolean(),
  sendCopyToHr: z.boolean(),
  hrCopyEmails: z.string(),
  adminAlertEmails: z.string(),
  contractExpiryWarningDays: z.string(),
  repeatLowLeaveAlertsEveryDays: z.coerce.number().int().min(1).max(365).catch(7),
  sendLeaveTakenRecordedAlerts: z.boolean(),
});

type ActionResult = { success: true; message: string } | { success: false; message: string };

type TestEmailActionResult =
  | { success: true; message: string }
  | { success: false; message: string; disabled?: boolean };

type AlertCheckActionResult =
  | { success: true; message: string; summary: { sent: number; skipped: number; failed: number } }
  | { success: false; message: string };

async function requireAdministrator() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!session.user?.userId || role !== "administrator") return null;
  return session.user;
}

function parseCsvEmails(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

function parseWarningDays(value: string): number[] {
  const parsed = value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.round(item));
  if (parsed.length === 0) return [90, 60, 30, 14, 7];
  return Array.from(new Set(parsed)).sort((a, b) => b - a);
}

export async function getEmailNotificationSettingsForPage(): Promise<{
  settings: PublicEmailNotificationSettings;
  encryptionError: string | null;
}> {
  const settings = await getPublicEmailNotificationSettings();
  return {
    settings,
    encryptionError: getEmailEncryptionErrorMessage(),
  };
}

function normalizeSmtpPort(raw: unknown): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n) || n < 1) return 587;
  return Math.min(65535, n);
}

export async function saveEmailNotificationSettingsAction(input: unknown): Promise<ActionResult> {
  const actor = await requireAdministrator();
  if (!actor) return { success: false, message: EMAIL_PERMISSION_MESSAGE };

  const parsed = formSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Unable to update email notification settings. Please try again." };
  }

  const previous = await getEmailNotificationSettings();
  const data = parsed.data;
  const smtpPort = normalizeSmtpPort(data.smtpPort);

  const newPassword = data.enabled ? (data.smtpPassword?.trim() ?? "") : "";
  const keepExistingWhenDisabled = !data.enabled;
  const keepExistingPassword = keepExistingWhenDisabled || !newPassword;

  if (newPassword && !isEmailEncryptionConfigured()) {
    return { success: false, message: "Email encryption key is not configured." };
  }

  if (data.enabled) {
    if (!data.smtpHost.trim()) {
      return { success: false, message: "SMTP host is required when email notifications are enabled." };
    }
    if (!data.fromEmail.trim()) {
      return { success: false, message: "From email is required when email notifications are enabled." };
    }
    const fromNameTrimmed = data.fromName.trim();
    if (!fromNameTrimmed) {
      return { success: false, message: "From display name is required when email notifications are enabled." };
    }
    if (
      data.smtpUsername.trim() &&
      !newPassword &&
      !previous.smtpPasswordEncrypted.trim()
    ) {
      return {
        success: false,
        message: "SMTP password is required when SMTP username is set.",
      };
    }
  }

  const fromNameResolved = data.enabled
    ? data.fromName.trim()
    : data.fromName.trim() || previous.fromName.trim() || "Local DB HR";

  const next = await saveEmailNotificationSettings({
    enabled: data.enabled,
    smtpHost: data.smtpHost.trim(),
    smtpPort,
    smtpSecure: data.smtpSecure,
    smtpUsername: data.smtpUsername.trim(),
    smtpPassword: newPassword,
    keepExistingPassword,
    fromEmail: data.fromEmail.trim(),
    fromName: fromNameResolved,
    replyToEmail: data.replyToEmail.trim(),
    sendLowLeaveAlerts: data.sendLowLeaveAlerts,
    sendEmployeeProfileCreatedAlerts: data.sendEmployeeProfileCreatedAlerts,
    sendEmployeeProfileUpdatedAlerts: data.sendEmployeeProfileUpdatedAlerts,
    sendNewContractAlerts: data.sendNewContractAlerts,
    sendContractUpdatedAlerts: data.sendContractUpdatedAlerts,
    sendContractExpiryAlerts: data.sendContractExpiryAlerts,
    sendContractExpiredAlerts: data.sendContractExpiredAlerts,
    sendLeaveTransactionUpdatedAlerts: data.sendLeaveTransactionUpdatedAlerts,
    sendLeaveTransactionDeletedAlerts: data.sendLeaveTransactionDeletedAlerts,
    sendLicenceAlerts: data.sendLicenceAlerts,
    sendSecurityAdminAlerts: data.sendSecurityAdminAlerts,
    sendEmployeeSpecificAlertsToEmployeeEmail: data.sendEmployeeSpecificAlertsToEmployeeEmail,
    sendCopyToHr: data.sendCopyToHr,
    hrCopyEmails: parseCsvEmails(data.hrCopyEmails),
    adminAlertEmails: parseCsvEmails(data.adminAlertEmails),
    contractExpiryWarningDays: parseWarningDays(data.contractExpiryWarningDays),
    repeatLowLeaveAlertsEveryDays: data.repeatLowLeaveAlertsEveryDays,
    sendLeaveTakenRecordedAlerts: data.sendLeaveTakenRecordedAlerts,
    updatedAt: new Date().toISOString(),
    updatedBy: actor.userId,
  });

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "Settings",
    action: "updated_email_notification_settings",
    targetType: "settings",
    targetLabel: "Settings: Email Notifications",
    success: true,
    metadata: {
      settingKey: "email_notification_settings",
      previous: { ...previous, smtpPasswordEncrypted: previous.smtpPasswordEncrypted ? "***" : "" },
      next: { ...next, smtpPasswordEncrypted: next.smtpPasswordEncrypted ? "***" : "" },
    },
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  await sendHrNotification({
    notificationType: "email_settings_changed",
    settingKey: "sendSecurityAdminAlerts",
    recipientMode: "hr_only",
    subject: "Email Notification Settings Updated",
    text: buildSimpleHrTemplate({
      lines: ["Email notification settings were updated by an administrator."],
    }),
    metadata: { settingKey: "email_notification_settings" },
  });

  revalidatePath("/settings");
  revalidatePath("/settings/email-notifications");
  revalidatePath("/dashboard");
  revalidatePath("/leave");
  revalidatePath("/reports");
  return { success: true, message: "Email notification settings updated successfully." };
}

export async function sendTestEmailAction(recipientEmail: string): Promise<TestEmailActionResult> {
  const actor = await requireAdministrator();
  if (!actor) return { success: false, message: EMAIL_PERMISSION_MESSAGE };

  const settings = await getEmailNotificationSettings();
  if (!settings.enabled) {
    const subject = "SMTP Test Email - Local DB HR";
    await createEmailNotificationLog({
      notificationType: "test_email",
      recipientEmail: recipientEmail.trim() || null,
      subject,
      status: "skipped",
      errorMessage: "Email notifications are disabled.",
    });
    return { success: false, message: "Email notifications are disabled.", disabled: true };
  }

  const hasStoredPassword = settings.smtpPasswordEncrypted.trim().length > 0;
  if (hasStoredPassword && !isEmailEncryptionConfigured()) {
    return { success: false, message: "Email encryption key is not configured." };
  }

  const to = recipientEmail.trim();
  if (!to) return { success: false, message: "Unable to send test email. Check SMTP settings." };

  const subject = "SMTP Test Email - Local DB HR";
  const text = [
    "This is a test email from Local DB HR.",
    "",
    "If you received this message, SMTP delivery is configured correctly.",
  ].join("\n");

  const result = await sendEmail({ to, subject, text });

  await createEmailNotificationLog({
    notificationType: "test_email",
    recipientEmail: to,
    subject,
    status: result.success ? "sent" : "failed",
    errorMessage: result.success ? null : result.reason,
    sentAt: result.success ? new Date() : null,
  });

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "Settings",
    action: result.success ? "sent_test_email_notification" : "failed_test_email_notification",
    targetType: "settings",
    targetLabel: "Settings: Email Notifications",
    success: result.success,
    failureReason: result.success ? undefined : result.reason,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });

  if (!result.success) {
    return { success: false, message: "Unable to send test email. Check SMTP settings." };
  }
  return { success: true, message: "Test email sent successfully." };
}

export async function runManualEmailAlertCheckAction(): Promise<AlertCheckActionResult> {
  const actor = await requireAdministrator();
  if (!actor) return { success: false, message: EMAIL_PERMISSION_MESSAGE };

  const summary = await runEmailAlertCheckNow();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorName: actor.name,
    module: "Settings",
    action: "ran_manual_email_alert_check",
    targetType: "settings",
    targetLabel: "Settings: Email Notifications",
    success: true,
    metadata: summary,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });

  revalidatePath("/settings/email-notifications");
  revalidatePath("/dashboard");
  revalidatePath("/leave");
  revalidatePath("/reports");

  return {
    success: true,
    message: "Manual alert check completed.",
    summary,
  };
}
