import "server-only";

import { Prisma } from "@prisma/client";

import {
  createEmailNotificationLog,
  getEmailNotificationSettings,
  wasNotificationSentRecently,
  type EmailNotificationSettings,
} from "@/lib/email/email-settings";
import { sendEmail } from "@/lib/email/send-email";
import { prisma } from "@/lib/prisma";

type RecipientMode = "employee_and_hr" | "hr_only";

export async function sendHrNotification(input: {
  notificationType: string;
  subject: string;
  text: string;
  employeeId?: string | null;
  contractId?: string | null;
  leaveBalanceId?: string | null;
  settingKey?: keyof EmailNotificationSettings;
  recipientMode?: RecipientMode;
  metadata?: Record<string, unknown>;
  dedupe?: {
    sinceDays: number;
    metadataContains?: Record<string, unknown>;
  };
  logWhenDisabled?: boolean;
  logWhenSettingOff?: boolean;
}): Promise<void> {
  try {
    const settings = await getEmailNotificationSettings();
    const mode = input.recipientMode ?? "employee_and_hr";

    if (!settings.enabled) {
      if (input.logWhenDisabled) {
        await createEmailNotificationLog({
          notificationType: input.notificationType,
          employeeId: input.employeeId ?? null,
          contractId: input.contractId ?? null,
          leaveBalanceId: input.leaveBalanceId ?? null,
          recipientEmail: null,
          subject: input.subject,
          status: "skipped",
          errorMessage: "Email notifications are disabled.",
          metadata: input.metadata ?? null,
        });
      }
      return;
    }

    if (input.settingKey && settings[input.settingKey] === false) {
      if (input.logWhenSettingOff) {
        await createEmailNotificationLog({
          notificationType: input.notificationType,
          employeeId: input.employeeId ?? null,
          contractId: input.contractId ?? null,
          leaveBalanceId: input.leaveBalanceId ?? null,
          recipientEmail: null,
          subject: input.subject,
          status: "skipped",
          errorMessage: `Notification disabled by setting: ${String(input.settingKey)}.`,
          metadata: input.metadata ?? null,
        });
      }
      return;
    }

    const recipients = new Set<string>();
    if (mode === "employee_and_hr" && settings.sendEmployeeSpecificAlertsToEmployeeEmail && input.employeeId) {
      const employeeRows = await prisma.$queryRaw<Array<{ work_email: string | null; personal_email: string | null }>>(
        Prisma.sql`
          SELECT work_email, personal_email
          FROM public.employees
          WHERE id = ${input.employeeId}::uuid
          LIMIT 1
        `,
      );
      const employeeEmail = employeeRows[0]?.work_email?.trim() || employeeRows[0]?.personal_email?.trim() || null;
      if (employeeEmail) {
        recipients.add(employeeEmail);
      } else {
        await createEmailNotificationLog({
          notificationType: input.notificationType,
          employeeId: input.employeeId ?? null,
          contractId: input.contractId ?? null,
          leaveBalanceId: input.leaveBalanceId ?? null,
          recipientEmail: null,
          subject: input.subject,
          status: "skipped",
          errorMessage: "No employee email address found.",
          metadata: input.metadata ?? null,
        });
      }
    }

    if (settings.sendCopyToHr) {
      for (const email of settings.hrCopyEmails) {
        if (email.trim()) recipients.add(email.trim());
      }
    }
    for (const email of settings.adminAlertEmails) {
      if (email.trim()) recipients.add(email.trim());
    }

    const list = Array.from(recipients);
    if (list.length < 1) {
      await createEmailNotificationLog({
        notificationType: input.notificationType,
        employeeId: input.employeeId ?? null,
        contractId: input.contractId ?? null,
        leaveBalanceId: input.leaveBalanceId ?? null,
        recipientEmail: null,
        subject: input.subject,
        status: "skipped",
        errorMessage: "No recipients configured for this alert.",
        metadata: input.metadata ?? null,
      });
      return;
    }

    if (input.dedupe) {
      const duplicate = await wasNotificationSentRecently({
        notificationType: input.notificationType,
        employeeId: input.employeeId ?? null,
        contractId: input.contractId ?? null,
        leaveBalanceId: input.leaveBalanceId ?? null,
        recipientEmail: list[0],
        sinceDays: input.dedupe.sinceDays,
        metadataContains: input.dedupe.metadataContains,
      });
      if (duplicate) {
        await createEmailNotificationLog({
          notificationType: input.notificationType,
          employeeId: input.employeeId ?? null,
          contractId: input.contractId ?? null,
          leaveBalanceId: input.leaveBalanceId ?? null,
          recipientEmail: list[0],
          ccEmail: list.slice(1).join(", ") || null,
          subject: input.subject,
          status: "skipped",
          errorMessage: "Duplicate alert prevented by repeat window.",
          metadata: input.metadata ?? null,
        });
        return;
      }
    }

    const result = await sendEmail({
      to: list[0],
      cc: list.slice(1),
      subject: input.subject,
      text: input.text,
    });

    await createEmailNotificationLog({
      notificationType: input.notificationType,
      employeeId: input.employeeId ?? null,
      contractId: input.contractId ?? null,
      leaveBalanceId: input.leaveBalanceId ?? null,
      recipientEmail: list[0],
      ccEmail: list.slice(1).join(", ") || null,
      subject: input.subject,
      status: result.success ? "sent" : "failed",
      errorMessage: result.success ? null : result.reason,
      sentAt: result.success ? new Date() : null,
      metadata: {
        ...(input.metadata ?? {}),
        messageId: result.success ? result.messageId : null,
      },
    });
  } catch (error) {
    console.error(`[email] ${input.notificationType} failed`, error);
    try {
      await createEmailNotificationLog({
        notificationType: input.notificationType,
        employeeId: input.employeeId ?? null,
        contractId: input.contractId ?? null,
        leaveBalanceId: input.leaveBalanceId ?? null,
        recipientEmail: null,
        subject: input.subject,
        status: "failed",
        errorMessage: "Unexpected error while sending notification email.",
        metadata: input.metadata ?? null,
      });
    } catch (logError) {
      console.error(`[email] ${input.notificationType} failed to write log`, logError);
    }
  }
}
