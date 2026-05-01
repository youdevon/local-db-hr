import {
  DEFAULT_LEAVE_WARNING_SETTINGS,
  type LeaveWarningSettings,
} from "@/lib/leave-warning-defaults";

export type LeaveStatus = "Healthy" | "Low" | "Exhausted" | "Overused";

export function getLeaveEntitlementForContract(
  contract: {
    vacation_leave_entitlement?: number | null;
    sick_leave_entitlement?: number | null;
  },
  leaveType: string,
): number | null {
  if (leaveType === "vacation") return Number(contract.vacation_leave_entitlement ?? 0);
  if (leaveType === "sick") return Number(contract.sick_leave_entitlement ?? 0);
  return 0;
}

export function calculateLeaveRemaining(entitlement: number, used: number): number {
  return Number((entitlement - used).toFixed(2));
}

export function getUsedLeaveForContract(
  usedByContractType: Map<string, number>,
  employeeId: string,
  contractId: string | null,
  leaveType: string,
): number {
  const key = `${employeeId}:${contractId ?? "none"}:${leaveType}`;
  return Number((usedByContractType.get(key) ?? 0).toFixed(2));
}

export function getLeaveStatus(
  remaining: number,
  leaveType: string,
  settings: LeaveWarningSettings = DEFAULT_LEAVE_WARNING_SETTINGS,
): LeaveStatus {
  if (remaining < 0) return "Overused";
  if (remaining === 0) return "Exhausted";
  if (!settings.showLowLeaveBadge || !settings.warnWhenRemainingAtOrBelowThreshold) return "Healthy";
  const threshold =
    leaveType === "vacation"
      ? settings.lowVacationLeaveThresholdDays
      : leaveType === "sick"
        ? settings.lowSickLeaveThresholdDays
        : settings.lowGeneralLeaveThresholdDays;
  if (remaining <= threshold) return "Low";
  return "Healthy";
}

export function getLeaveStatusTone(status: LeaveStatus): "success" | "warning" | "danger" | "muted" {
  if (status === "Healthy") return "success";
  if (status === "Low") return "warning";
  if (status === "Exhausted") return "muted";
  return "danger";
}
