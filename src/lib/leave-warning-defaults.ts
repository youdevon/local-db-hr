export type LeaveWarningSettings = {
  lowVacationLeaveThresholdDays: number;
  lowSickLeaveThresholdDays: number;
  lowGeneralLeaveThresholdDays: number;
  warnWhenRemainingAtOrBelowThreshold: boolean;
  showLowLeaveBadge: boolean;
};

export const DEFAULT_LEAVE_WARNING_SETTINGS: LeaveWarningSettings = {
  lowVacationLeaveThresholdDays: 5,
  lowSickLeaveThresholdDays: 3,
  lowGeneralLeaveThresholdDays: 3,
  warnWhenRemainingAtOrBelowThreshold: true,
  showLowLeaveBadge: true,
};
