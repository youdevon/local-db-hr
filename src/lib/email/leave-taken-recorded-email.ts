import "server-only";

import { Prisma } from "@prisma/client";

import { createEmailNotificationLog, getEmailNotificationSettings } from "@/lib/email/email-settings";
import { sendEmail } from "@/lib/email/send-email";
import {
  formatContractPeriod,
  formatDateLabel,
  getLeaveTypeLabel,
  type LeaveTransactionSummary,
} from "@/lib/leave";
import { prisma } from "@/lib/prisma";

export const LEAVE_TAKEN_RECORDED_NOTIFICATION_TYPE = "leave_taken_recorded" as const;

export const ADMIN_LEAVE_EMAIL_FAIL_MESSAGE =
  "Leave was recorded, but the email notification could not be sent.";

export function buildLeaveTakenRecordedSubject(leaveType: string): string {
  return `${getLeaveTypeLabel(leaveType)} Recorded`;
}

function leaveTypeLowerForBody(leaveType: string): string {
  return getLeaveTypeLabel(leaveType).replace(/ Leave$/, " leave").toLowerCase();
}

function remainingPoolLabel(leaveType: string): string {
  if (leaveType === "sick") return "sick leave";
  if (leaveType === "vacation" || leaveType === "casual") return "vacation leave";
  return getLeaveTypeLabel(leaveType).replace(/ Leave$/, " leave");
}

function remainingLineForBody(
  leaveType: string,
  remainingDays: number | null,
  periodLabel: string,
): string {
  const pool = remainingPoolLabel(leaveType);
  if (remainingDays === null) {
    return `Remaining ${pool}: not tracked for this leave type.`;
  }
  if (remainingDays === 0) {
    return `No ${pool} remains for ${periodLabel}.`;
  }
  if (remainingDays < 0) {
    const w = remainingDays === -1 ? "day" : "days";
    return `Remaining ${pool}: balance is now ${remainingDays} ${w} for ${periodLabel}.`;
  }
  if (remainingDays === 1) {
    return `Remaining ${pool}: 1 day remains for ${periodLabel}.`;
  }
  return `Remaining ${pool}: ${remainingDays} days remain for ${periodLabel}.`;
}

function daysTakenBodyLine(daysTaken: number): string {
  return daysTaken === 1 ? "Days taken: 1 day was taken." : `Days taken: ${daysTaken} days were taken.`;
}

export function buildLeavePeriodDisplayForEmail(
  contractYear: { startDate: string; endDate: string } | null,
  contractStartDate: string,
  contractEndDate: string,
): string {
  if (contractYear) {
    return `${formatDateLabel(contractYear.startDate)} – ${formatDateLabel(contractYear.endDate)}`;
  }
  return formatContractPeriod(contractStartDate, contractEndDate);
}

export function buildLeaveTakenRecordedEmailBody(params: {
  employeeName: string;
  leaveType: string;
  periodDisplay: string;
  startDate: string;
  endDate: string;
  daysTaken: number;
  leaveSummary: LeaveTransactionSummary;
}): string {
  const lt = leaveTypeLowerForBody(params.leaveType);
  return [
    `Good day ${params.employeeName},`,
    "",
    "This is an automated notification from Local DB HR.",
    "",
    `Your ${lt} has been recorded.`,
    "",
    `Leave period: ${params.periodDisplay}`,
    `Leave dates: ${formatDateLabel(params.startDate)} to ${formatDateLabel(params.endDate)}`,
    daysTakenBodyLine(params.daysTaken),
    remainingLineForBody(params.leaveType, params.leaveSummary.remainingDays, params.leaveSummary.periodLabel),
    "",
    "Please contact HR if you require clarification.",
    "",
    "Regards,",
    "HR Administration",
  ].join("\n");
}

function pickEmployeeEmail(work: string | null, personal: string | null): string | null {
  const w = work?.trim();
  if (w) return w;
  const p = personal?.trim();
  if (p) return p;
  return null;
}

function buildLogMetadata(
  leaveType: string,
  daysTaken: number,
  summary: LeaveTransactionSummary,
  startDate: string,
  endDate: string,
) {
  return {
    leaveType,
    daysTaken,
    remainingDays: summary.remainingDays,
    periodLabel: summary.periodLabel,
    leaveStartDate: startDate,
    leaveEndDate: endDate,
    leaveBalanceId: summary.leaveBalanceId ?? null,
  };
}

/**
 * Fire-and-forget friendly: does not throw.
 * Writes `email_notification_logs` only when this notification is eligible (email on + sendLeaveTakenRecordedAlerts):
 * skipped (no employee email), sent, or failed. No log row when notifications are disabled or this toggle is off.
 * Returns `adminWarning` when delivery failed so the UI can notify administrators only.
 */
export async function trySendLeaveTakenRecordedEmail(params: {
  employeeId: string;
  contractId: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  daysTaken: number;
  leaveSummary: LeaveTransactionSummary;
  contractYear: { startDate: string; endDate: string; yearNumber: number } | null;
  contractStartDate: string;
  contractEndDate: string;
}): Promise<{ adminWarning?: string }> {
  const subject = buildLeaveTakenRecordedSubject(params.leaveType);
  const periodDisplay = buildLeavePeriodDisplayForEmail(
    params.contractYear,
    params.contractStartDate,
    params.contractEndDate,
  );

  try {
    const settings = await getEmailNotificationSettings();

    if (!settings.enabled) {
      console.info("[email] leave_taken_recorded: not logging (email notifications disabled)");
      return {};
    }

    if (!settings.sendLeaveTakenRecordedAlerts) {
      console.info("[email] leave_taken_recorded: not logging (sendLeaveTakenRecordedAlerts is false)");
      return {};
    }

    const empRows = await prisma.$queryRaw<
      Array<{ work_email: string | null; personal_email: string | null }>
    >(Prisma.sql`
      SELECT work_email, personal_email
      FROM public.employees
      WHERE id::text = ${params.employeeId}
      LIMIT 1
    `);
    const recipient = pickEmployeeEmail(empRows[0]?.work_email ?? null, empRows[0]?.personal_email ?? null);

    if (!recipient) {
      console.info("[email] leave_taken_recorded skipped: no employee email address");
      await createEmailNotificationLog({
        notificationType: LEAVE_TAKEN_RECORDED_NOTIFICATION_TYPE,
        employeeId: params.employeeId,
        contractId: params.contractId,
        leaveBalanceId: params.leaveSummary.leaveBalanceId ?? null,
        recipientEmail: null,
        subject,
        status: "skipped",
        errorMessage: "No employee email address found.",
        metadata: buildLogMetadata(
          params.leaveType,
          params.daysTaken,
          params.leaveSummary,
          params.startDate,
          params.endDate,
        ),
      });
      return {};
    }

    const text = buildLeaveTakenRecordedEmailBody({
      employeeName: params.employeeName,
      leaveType: params.leaveType,
      periodDisplay,
      startDate: params.startDate,
      endDate: params.endDate,
      daysTaken: params.daysTaken,
      leaveSummary: params.leaveSummary,
    });

    const sendResult = await sendEmail({ to: recipient, subject, text });

    if (sendResult.success) {
      await createEmailNotificationLog({
        notificationType: LEAVE_TAKEN_RECORDED_NOTIFICATION_TYPE,
        employeeId: params.employeeId,
        contractId: params.contractId,
        leaveBalanceId: params.leaveSummary.leaveBalanceId ?? null,
        recipientEmail: recipient,
        subject,
        status: "sent",
        sentAt: new Date(),
        metadata: {
          ...buildLogMetadata(
            params.leaveType,
            params.daysTaken,
            params.leaveSummary,
            params.startDate,
            params.endDate,
          ),
          messageId: sendResult.messageId,
        },
      });
      return {};
    }

    console.error("[email] leave_taken_recorded send failed", sendResult.reason);
    await createEmailNotificationLog({
      notificationType: LEAVE_TAKEN_RECORDED_NOTIFICATION_TYPE,
      employeeId: params.employeeId,
      contractId: params.contractId,
      leaveBalanceId: params.leaveSummary.leaveBalanceId ?? null,
      recipientEmail: recipient,
      subject,
      status: "failed",
      errorMessage: sendResult.reason || "Email delivery failed.",
      metadata: buildLogMetadata(
        params.leaveType,
        params.daysTaken,
        params.leaveSummary,
        params.startDate,
        params.endDate,
      ),
    });
    return { adminWarning: ADMIN_LEAVE_EMAIL_FAIL_MESSAGE };
  } catch (error) {
    console.error("[email] leave_taken_recorded unexpected error", error);
    try {
      await createEmailNotificationLog({
        notificationType: LEAVE_TAKEN_RECORDED_NOTIFICATION_TYPE,
        employeeId: params.employeeId,
        contractId: params.contractId,
        leaveBalanceId: params.leaveSummary.leaveBalanceId ?? null,
        recipientEmail: null,
        subject,
        status: "failed",
        errorMessage: "Unexpected error while sending leave recorded email.",
        metadata: buildLogMetadata(
          params.leaveType,
          params.daysTaken,
          params.leaveSummary,
          params.startDate,
          params.endDate,
        ),
      });
    } catch (logErr) {
      console.error("[email] leave_taken_recorded log insert failed", logErr);
    }
    return { adminWarning: ADMIN_LEAVE_EMAIL_FAIL_MESSAGE };
  }
}
