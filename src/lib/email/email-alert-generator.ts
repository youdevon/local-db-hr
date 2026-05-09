import "server-only";

import { Prisma } from "@prisma/client";

import {
  createEmailNotificationLog,
  getEmailNotificationSettings,
  wasNotificationSentRecently,
} from "@/lib/email/email-settings";
import { sendEmail } from "@/lib/email/send-email";
import {
  buildContractExpiredTemplate,
  buildContractExpiryTemplate,
  buildLowLeaveTemplate,
} from "@/lib/email/templates";
import { getLeaveLowThresholdDays, getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";
import { getLeaveSearchRowsFromDatabase } from "@/lib/server/leave-search";

export type EmailAlertRunSummary = {
  sent: number;
  failed: number;
  skipped: number;
};

type EmployeeContactRow = {
  id: string;
  first_name: string;
  last_name: string;
  work_email: string | null;
  personal_email: string | null;
};

function formatDateLabel(value: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function getPreferredEmployeeEmail(row: EmployeeContactRow): string | null {
  const options = [row.work_email, row.personal_email];
  for (const option of options) {
    const value = option?.trim();
    if (value) return value;
  }
  return null;
}

function parseRemainingDays(remainingText: string): number {
  const parsed = Number(remainingText.replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed);
}

function lowLeaveNotificationType(leaveType: string): "low_sick_leave" | "low_vacation_leave" | "low_general_leave" {
  const normalized = leaveType.trim().toLowerCase();
  if (normalized === "sick") return "low_sick_leave";
  if (normalized === "vacation" || normalized === "casual") return "low_vacation_leave";
  return "low_general_leave";
}

export async function runEmailAlertCheckNow(): Promise<EmailAlertRunSummary> {
  const summary: EmailAlertRunSummary = { sent: 0, failed: 0, skipped: 0 };
  const emailSettings = await getEmailNotificationSettings();

  if (!emailSettings.enabled) {
    await createEmailNotificationLog({
      notificationType: "manual_alert_check",
      recipientEmail: null,
      subject: "Manual alert check",
      status: "skipped",
      errorMessage: "Email notifications are disabled.",
      metadata: { reason: "notifications_disabled" },
    });
    summary.skipped = 1;
    return summary;
  }

  const leaveWarningSettings = await getLeaveWarningSettings();

  const [employeeRows, leaveRows, expiringContracts, expiredContractsNoNew] = await Promise.all([
    prisma.$queryRaw<EmployeeContactRow[]>(Prisma.sql`
      SELECT id::text AS id, first_name, last_name, work_email, personal_email
      FROM public.employees
    `),
    getLeaveSearchRowsFromDatabase(),
    prisma.$queryRaw<
      Array<{
        contract_id: string;
        employee_id: string;
        first_name: string;
        last_name: string;
        end_date: Date;
        days_remaining: number;
      }>
    >(Prisma.sql`
      SELECT
        c.id::text AS contract_id,
        e.id::text AS employee_id,
        e.first_name,
        e.last_name,
        c.end_date,
        (c.end_date - CURRENT_DATE)::int AS days_remaining
      FROM public.contracts c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.end_date >= CURRENT_DATE
        AND COALESCE(c.status, '') NOT IN ('cancelled', 'terminated')
    `),
    prisma.$queryRaw<
      Array<{
        contract_id: string;
        employee_id: string;
        first_name: string;
        last_name: string;
        end_date: Date;
      }>
    >(Prisma.sql`
      WITH latest_contract AS (
        SELECT DISTINCT ON (c.employee_id)
          c.id,
          c.employee_id,
          c.end_date
        FROM public.contracts c
        ORDER BY c.employee_id, c.end_date DESC, c.created_at DESC
      )
      SELECT
        lc.id::text AS contract_id,
        lc.employee_id::text AS employee_id,
        e.first_name,
        e.last_name,
        lc.end_date
      FROM latest_contract lc
      JOIN public.employees e ON e.id = lc.employee_id
      WHERE lc.end_date < CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1
          FROM public.contracts c2
          WHERE c2.employee_id = lc.employee_id
            AND c2.end_date >= CURRENT_DATE
            AND COALESCE(c2.status, '') NOT IN ('cancelled', 'terminated')
        )
    `),
  ]);

  const employeeById = new Map(employeeRows.map((row) => [row.id, row]));
  const hrCcEmails = emailSettings.sendCopyToHr ? emailSettings.hrCopyEmails : [];

  if (emailSettings.sendLowLeaveAlerts && leaveWarningSettings.showLowLeaveBadge) {
    for (const row of leaveRows) {
      if (
        row.status !== "Overused" &&
        row.status !== "Exhausted" &&
        !(leaveWarningSettings.warnWhenRemainingAtOrBelowThreshold && row.status === "Low")
      ) {
        continue;
      }

      const employee = employeeById.get(row.employeeId);
      if (!employee) continue;
      const recipient = emailSettings.sendEmployeeSpecificAlertsToEmployeeEmail ? getPreferredEmployeeEmail(employee) : null;
      if (!recipient) {
        await createEmailNotificationLog({
          notificationType: lowLeaveNotificationType(row.leaveType),
          employeeId: row.employeeId,
          contractId: row.contractId,
          recipientEmail: null,
          ccEmail: hrCcEmails.join(", ") || null,
          subject: `Low ${row.leaveType} Balance Alert`,
          status: "skipped",
          errorMessage: "No employee email address found.",
          metadata: { leaveType: row.leaveType, reason: "missing_employee_email" },
        });
        summary.skipped += 1;
        continue;
      }

      const duplicate = await wasNotificationSentRecently({
        notificationType: lowLeaveNotificationType(row.leaveType),
        employeeId: row.employeeId,
        contractId: row.contractId,
        recipientEmail: recipient,
        sinceDays: emailSettings.repeatLowLeaveAlertsEveryDays,
        metadataContains: { leaveType: row.leaveType },
      });
      if (duplicate) {
        summary.skipped += 1;
        continue;
      }

      const leaveTypeLabel = `${row.leaveType.charAt(0).toUpperCase()}${row.leaveType.slice(1)}`;
      const threshold = getLeaveLowThresholdDays(leaveWarningSettings, row.leaveType);
      const { subject, text } = buildLowLeaveTemplate({
        employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
        leaveTypeLabel,
        remainingDays: parseRemainingDays(row.remainingText),
        thresholdDays: threshold,
      });

      const sendResult = await sendEmail({
        to: recipient,
        cc: hrCcEmails,
        subject,
        text,
      });

      if (sendResult.success) {
        await createEmailNotificationLog({
          notificationType: lowLeaveNotificationType(row.leaveType),
          employeeId: row.employeeId,
          contractId: row.contractId,
          recipientEmail: recipient,
          ccEmail: hrCcEmails.join(", ") || null,
          subject,
          status: "sent",
          sentAt: new Date(),
          metadata: { leaveType: row.leaveType, messageId: sendResult.messageId },
        });
        summary.sent += 1;
      } else {
        await createEmailNotificationLog({
          notificationType: lowLeaveNotificationType(row.leaveType),
          employeeId: row.employeeId,
          contractId: row.contractId,
          recipientEmail: recipient,
          ccEmail: hrCcEmails.join(", ") || null,
          subject,
          status: "failed",
          errorMessage: sendResult.reason,
          metadata: { leaveType: row.leaveType },
        });
        summary.failed += 1;
      }
    }
  }

  if (emailSettings.sendContractExpiryAlerts) {
    for (const contract of expiringContracts) {
      if (!emailSettings.contractExpiryWarningDays.includes(contract.days_remaining)) continue;
      const employee = employeeById.get(contract.employee_id);
      if (!employee) continue;
      const recipient = emailSettings.sendEmployeeSpecificAlertsToEmployeeEmail ? getPreferredEmployeeEmail(employee) : null;
      if (!recipient) {
        await createEmailNotificationLog({
          notificationType: "contract_expiring",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: null,
          ccEmail: hrCcEmails.join(", ") || null,
          subject: "Contract Expiry Notice",
          status: "skipped",
          errorMessage: "No employee email address found.",
          metadata: { reason: "missing_employee_email", warningIntervalDays: contract.days_remaining },
        });
        summary.skipped += 1;
        continue;
      }

      const duplicate = await wasNotificationSentRecently({
        notificationType: "contract_expiring",
        employeeId: contract.employee_id,
        contractId: contract.contract_id,
        recipientEmail: recipient,
        sinceDays: 365,
        metadataContains: { warningIntervalDays: contract.days_remaining },
      });
      if (duplicate) {
        summary.skipped += 1;
        continue;
      }

      const { subject, text } = buildContractExpiryTemplate({
        employeeName: `${contract.first_name} ${contract.last_name}`.trim(),
        contractEndDateLabel: formatDateLabel(contract.end_date),
        daysRemaining: contract.days_remaining,
      });

      const sendResult = await sendEmail({
        to: recipient,
        cc: hrCcEmails,
        subject,
        text,
      });
      if (sendResult.success) {
        await createEmailNotificationLog({
          notificationType: "contract_expiring",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: recipient,
          ccEmail: hrCcEmails.join(", ") || null,
          subject,
          status: "sent",
          sentAt: new Date(),
          metadata: { warningIntervalDays: contract.days_remaining, messageId: sendResult.messageId },
        });
        summary.sent += 1;
      } else {
        await createEmailNotificationLog({
          notificationType: "contract_expiring",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: recipient,
          ccEmail: hrCcEmails.join(", ") || null,
          subject,
          status: "failed",
          errorMessage: sendResult.reason,
          metadata: { warningIntervalDays: contract.days_remaining },
        });
        summary.failed += 1;
      }
    }
  }

  if (emailSettings.sendContractExpiredAlerts) {
    for (const contract of expiredContractsNoNew) {
      const employee = employeeById.get(contract.employee_id);
      if (!employee) continue;
      const toRecipients: string[] = [];
      if (emailSettings.sendEmployeeSpecificAlertsToEmployeeEmail) {
        const employeeEmail = getPreferredEmployeeEmail(employee);
        if (employeeEmail) toRecipients.push(employeeEmail);
      }
      const uniqueTo = Array.from(new Set([...toRecipients, ...hrCcEmails]));
      if (uniqueTo.length === 0) {
        await createEmailNotificationLog({
          notificationType: "contract_expired_no_new",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: null,
          subject: "Contract Expired Notice",
          status: "skipped",
          errorMessage: "No employee email address found.",
          metadata: { reason: "missing_employee_email_and_no_hr_cc" },
        });
        summary.skipped += 1;
        continue;
      }

      const duplicate = await wasNotificationSentRecently({
        notificationType: "contract_expired_no_new",
        employeeId: contract.employee_id,
        contractId: contract.contract_id,
        recipientEmail: uniqueTo.join(","),
        sinceDays: 365,
      });
      if (duplicate) {
        summary.skipped += 1;
        continue;
      }

      const { subject, text } = buildContractExpiredTemplate({
        employeeName: `${contract.first_name} ${contract.last_name}`.trim(),
        contractEndDateLabel: formatDateLabel(contract.end_date),
      });

      const sendResult = await sendEmail({
        to: uniqueTo[0],
        cc: uniqueTo.slice(1),
        subject,
        text,
      });
      if (sendResult.success) {
        await createEmailNotificationLog({
          notificationType: "contract_expired_no_new",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: uniqueTo[0],
          ccEmail: uniqueTo.slice(1).join(", ") || null,
          subject,
          status: "sent",
          sentAt: new Date(),
          metadata: { messageId: sendResult.messageId },
        });
        summary.sent += 1;
      } else {
        await createEmailNotificationLog({
          notificationType: "contract_expired_no_new",
          employeeId: contract.employee_id,
          contractId: contract.contract_id,
          recipientEmail: uniqueTo[0],
          ccEmail: uniqueTo.slice(1).join(", ") || null,
          subject,
          status: "failed",
          errorMessage: sendResult.reason,
        });
        summary.failed += 1;
      }
    }
  }

  return summary;
}
