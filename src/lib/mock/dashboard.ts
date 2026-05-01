export const dashboardMetrics = {
  totalEmployees: 0,
  activeEmployees: 0,
  activeContracts: 0,
  contractsExpiring30: 0,
  contractsExpiring60: 0,
  contractsExpiring90: 0,
  expiredContracts: 0,
  employeesOnLeave: 0,
  lowSickLeave: 0,
  lowVacationLeave: 0,
  pendingLeaveRequests: 0,
};

/** Count of contracts expiring within the combined 30- and 60-day windows (sample). */
export const contractsExpiringSoonCount =
  dashboardMetrics.contractsExpiring30 + dashboardMetrics.contractsExpiring60;

export const expiringContractsPreview = [] as const;

export const leaveBalanceAlertsPreview = [] as const;

export const recentAuditActivity = [] as const;
