import "server-only";

import { Prisma } from "@prisma/client";

import {
  DEFAULT_LEAVE_WARNING_SETTINGS,
  type LeaveWarningSettings,
} from "@/lib/leave-warning-defaults";
import { prisma } from "@/lib/prisma";

function safeNumber(value: unknown, fallback: number): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return fallback;
  return num;
}

export async function getLeaveWarningSettings(): Promise<LeaveWarningSettings> {
  try {
    const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
      Prisma.sql`
        SELECT setting_value
        FROM public.app_settings
        WHERE setting_key = 'leave_warning_settings'
        LIMIT 1
      `,
    );

    const raw = rows[0]?.setting_value;
    if (!raw || typeof raw !== "object") return DEFAULT_LEAVE_WARNING_SETTINGS;
    const data = raw as Partial<LeaveWarningSettings>;

    return {
      lowVacationLeaveThresholdDays: safeNumber(
        data.lowVacationLeaveThresholdDays,
        DEFAULT_LEAVE_WARNING_SETTINGS.lowVacationLeaveThresholdDays,
      ),
      lowSickLeaveThresholdDays: safeNumber(
        data.lowSickLeaveThresholdDays,
        DEFAULT_LEAVE_WARNING_SETTINGS.lowSickLeaveThresholdDays,
      ),
      lowGeneralLeaveThresholdDays: safeNumber(
        data.lowGeneralLeaveThresholdDays,
        DEFAULT_LEAVE_WARNING_SETTINGS.lowGeneralLeaveThresholdDays,
      ),
      warnWhenRemainingAtOrBelowThreshold:
        typeof data.warnWhenRemainingAtOrBelowThreshold === "boolean"
          ? data.warnWhenRemainingAtOrBelowThreshold
          : DEFAULT_LEAVE_WARNING_SETTINGS.warnWhenRemainingAtOrBelowThreshold,
      showLowLeaveBadge:
        typeof data.showLowLeaveBadge === "boolean"
          ? data.showLowLeaveBadge
          : DEFAULT_LEAVE_WARNING_SETTINGS.showLowLeaveBadge,
    };
  } catch {
    return DEFAULT_LEAVE_WARNING_SETTINGS;
  }
}

export function getLeaveLowThresholdDays(settings: LeaveWarningSettings, leaveType: string): number {
  if (leaveType === "vacation") return settings.lowVacationLeaveThresholdDays;
  if (leaveType === "sick") return settings.lowSickLeaveThresholdDays;
  return settings.lowGeneralLeaveThresholdDays;
}
