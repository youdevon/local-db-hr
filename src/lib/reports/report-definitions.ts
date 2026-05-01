export type ReportCategory =
  | "employee"
  | "contract"
  | "leave"
  | "retirement"
  | "audit"
  | "user";

export type ReportFilterType = "employee" | "select" | "text" | "number" | "date";
export type ReportColumnType = "text" | "number" | "date" | "currency" | "days" | "status";

export type ReportFilterOption = { label: string; value: string };
export type EmployeeFilterOption = {
  label: string;
  value: string;
  fullName: string;
  fileNumber: string;
  searchText: string;
};

export type ReportResult = {
  title: string;
  generatedAt: string;
  filtersApplied: Record<string, string>;
  columns: Array<{ key: string; label: string; type: string; sortable?: boolean }>;
  rows: Array<Record<string, string | number>>;
  totalMatchingRows: number;
  previewLimit: number;
};

export type ReportFilterDefinition = {
  key: string;
  label: string;
  type: ReportFilterType;
  required?: boolean;
  options?: ReportFilterOption[];
  defaultValue?: string;
  helperText?: string;
};

export type ReportColumnDefinition = {
  key: string;
  label: string;
  type: ReportColumnType;
  sortable?: boolean;
};

export type ReportDefinition = {
  id: string;
  category: ReportCategory;
  label: string;
  requiredFilters: string[];
  filters: ReportFilterDefinition[];
  columns: ReportColumnDefinition[];
  guidance: string[];
};

export const REPORT_CATEGORIES: Array<{ id: ReportCategory; label: string }> = [
  { id: "employee", label: "Employee Reports" },
  { id: "contract", label: "Contract Reports" },
  { id: "leave", label: "Leave Reports" },
  { id: "retirement", label: "Retirement & Age Reports" },
  { id: "audit", label: "Audit Reports" },
  { id: "user", label: "User Account Reports" },
];

const EMPLOYEE_COLUMNS: ReportColumnDefinition[] = [
  { key: "fileNumber", label: "File #", type: "text", sortable: true },
  { key: "firstName", label: "First Name", type: "text", sortable: true },
  { key: "lastName", label: "Last Name", type: "text", sortable: true },
  { key: "department", label: "Department", type: "text", sortable: true },
  { key: "position", label: "Position", type: "text", sortable: true },
  { key: "gender", label: "Gender", type: "text", sortable: true },
  { key: "dateOfBirth", label: "Date of Birth", type: "date", sortable: true },
  { key: "age", label: "Age", type: "number", sortable: true },
  { key: "nationality", label: "Nationality", type: "text", sortable: true },
  { key: "workEmail", label: "Work Email", type: "text", sortable: true },
  { key: "mobileNumber", label: "Mobile Number", type: "text", sortable: true },
];

const CONTRACT_COLUMNS: ReportColumnDefinition[] = [
  { key: "minuteNumber", label: "Minute #", type: "text", sortable: true },
  { key: "contractNumber", label: "Contract #", type: "text", sortable: true },
  { key: "fileNumber", label: "File #", type: "text", sortable: true },
  { key: "employee", label: "Employee", type: "text", sortable: true },
  { key: "department", label: "Department", type: "text", sortable: true },
  { key: "position", label: "Position", type: "text", sortable: true },
  { key: "startDate", label: "Start Date", type: "date", sortable: true },
  { key: "endDate", label: "End Date", type: "date", sortable: true },
  { key: "salary", label: "Salary", type: "currency", sortable: true },
  { key: "gratuity", label: "Gratuity", type: "currency", sortable: true },
  { key: "status", label: "Status", type: "status", sortable: true },
];

const SHARED_FILTERS = {
  employee: { key: "employeeId", label: "Employee", type: "employee" as const },
  department: { key: "department", label: "Department", type: "select" as const },
  position: { key: "position", label: "Position", type: "select" as const },
  nationality: { key: "nationality", label: "Nationality", type: "select" as const },
  gender: { key: "gender", label: "Gender", type: "select" as const },
  contractStatus: { key: "contractStatus", label: "Contract Status", type: "select" as const },
  leaveType: { key: "leaveType", label: "Leave Type", type: "select" as const },
  leaveStatus: { key: "leaveStatus", label: "Leave Status", type: "select" as const },
  role: { key: "role", label: "Role", type: "select" as const },
  linkedEmployeeStatus: { key: "linkedEmployeeStatus", label: "Linked Employee Status", type: "select" as const },
  success: { key: "success", label: "Success", type: "select" as const },
  startDateFrom: { key: "startDateFrom", label: "Start Date From", type: "date" as const },
  startDateTo: { key: "startDateTo", label: "Start Date To", type: "date" as const },
  endDateFrom: { key: "endDateFrom", label: "End Date From", type: "date" as const },
  endDateTo: { key: "endDateTo", label: "End Date To", type: "date" as const },
  dateFrom: { key: "dateFrom", label: "Date From", type: "date" as const },
  dateTo: { key: "dateTo", label: "Date To", type: "date" as const },
};

export const AGE_CONDITION_OPTIONS: ReportFilterOption[] = [
  { label: "All", value: "all" },
  { label: "Equals", value: "equals" },
  { label: "Greater Than", value: "gt" },
  { label: "Greater Than or Equal To", value: "gte" },
  { label: "Less Than", value: "lt" },
  { label: "Less Than or Equal To", value: "lte" },
  { label: "Between", value: "between" },
];

export const REPORT_DEFINITIONS: ReportDefinition[] = [
  {
    id: "employee-directory",
    category: "employee",
    label: "Employee Directory",
    requiredFilters: [],
    guidance: ["No required filters. You may run this report as-is."],
    filters: [
      SHARED_FILTERS.employee,
      SHARED_FILTERS.department,
      SHARED_FILTERS.position,
      SHARED_FILTERS.nationality,
      SHARED_FILTERS.gender,
      { key: "ageCondition", label: "Age Condition", type: "select", options: AGE_CONDITION_OPTIONS, defaultValue: "all" },
      { key: "ageValue", label: "Age Value", type: "number" },
      { key: "ageFrom", label: "Age From", type: "number" },
      { key: "ageTo", label: "Age To", type: "number" },
    ],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-with-no-contract",
    category: "employee",
    label: "Employees With No Contract",
    requiredFilters: [],
    guidance: ["No required filters. You may run this report as-is."],
    filters: [],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "workEmail", label: "Work Email", type: "text", sortable: true },
      { key: "mobileNumber", label: "Mobile Number", type: "text", sortable: true },
    ],
  },
  {
    id: "employees-by-age",
    category: "employee",
    label: "Employees by Age",
    requiredFilters: ["ageCondition"],
    guidance: [
      "Required fields: Age Condition and Age Value.",
      "If Age Condition is Between, Age From and Age To are required.",
    ],
    filters: [
      { key: "ageCondition", label: "Age Condition", type: "select", options: AGE_CONDITION_OPTIONS, required: true, defaultValue: "all" },
      { key: "ageValue", label: "Age Value", type: "number" },
      { key: "ageFrom", label: "Age From", type: "number" },
      { key: "ageTo", label: "Age To", type: "number" },
    ],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-by-department",
    category: "employee",
    label: "Employees by Department",
    requiredFilters: ["department"],
    guidance: ["Required field: Department."],
    filters: [{ ...SHARED_FILTERS.department, required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-by-position",
    category: "employee",
    label: "Employees by Position",
    requiredFilters: ["position"],
    guidance: ["Required field: Position."],
    filters: [{ ...SHARED_FILTERS.position, required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-by-nationality",
    category: "employee",
    label: "Employees by Nationality",
    requiredFilters: ["nationality"],
    guidance: ["Required field: Nationality."],
    filters: [{ ...SHARED_FILTERS.nationality, required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-by-gender",
    category: "employee",
    label: "Employees by Gender",
    requiredFilters: ["gender"],
    guidance: ["Required field: Gender."],
    filters: [{ ...SHARED_FILTERS.gender, required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "all-contracts",
    category: "contract",
    label: "All Contracts",
    requiredFilters: [],
    guidance: ["No required filters. You may run this report as-is."],
    filters: [
      SHARED_FILTERS.employee,
      SHARED_FILTERS.department,
      SHARED_FILTERS.position,
      SHARED_FILTERS.contractStatus,
      SHARED_FILTERS.startDateFrom,
      SHARED_FILTERS.startDateTo,
      SHARED_FILTERS.endDateFrom,
      SHARED_FILTERS.endDateTo,
    ],
    columns: CONTRACT_COLUMNS,
  },
  {
    id: "contract-history-by-employee",
    category: "contract",
    label: "Contract History by Employee",
    requiredFilters: ["employeeId"],
    guidance: ["Required field: Employee."],
    filters: [{ ...SHARED_FILTERS.employee, required: true }],
    columns: CONTRACT_COLUMNS,
  },
  {
    id: "contracts-expiring-within-days",
    category: "contract",
    label: "Contracts Expiring Within Days",
    requiredFilters: ["expiringWithinDays"],
    guidance: ["Required field: Expiring Within Days.", "Default value: 90."],
    filters: [{ key: "expiringWithinDays", label: "Expiring Within Days", type: "number", required: true, defaultValue: "90" }],
    columns: [
      { key: "minuteNumber", label: "Minute #", type: "text", sortable: true },
      { key: "contractNumber", label: "Contract #", type: "text", sortable: true },
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "endDate", label: "End Date", type: "date", sortable: true },
      { key: "daysToExpiry", label: "Days to Expiry", type: "days", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
  },
  {
    id: "contracts-beyond-retirement-cutoff",
    category: "contract",
    label: "Contracts Beyond Retirement Cutoff",
    requiredFilters: [],
    guidance: ["No required filters. This report uses the Retirement Age Policy setting."],
    filters: [],
    columns: [
      { key: "minuteNumber", label: "Minute #", type: "text", sortable: true },
      { key: "contractNumber", label: "Contract #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "dateOfBirth", label: "Date of Birth", type: "date", sortable: true },
      { key: "retirementCutoffDate", label: "Retirement Cutoff Date", type: "date", sortable: true },
      { key: "contractEndDate", label: "Contract End Date", type: "date", sortable: true },
      { key: "daysBeyondCutoff", label: "Days Beyond Cutoff", type: "days", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
  },
  {
    id: "leave-transactions",
    category: "leave",
    label: "Leave Transactions",
    requiredFilters: [],
    guidance: [
      "No required filters. You may filter by Employee, Department, Position, Leave Type, Leave Status, or date range.",
    ],
    filters: [
      SHARED_FILTERS.employee,
      SHARED_FILTERS.department,
      SHARED_FILTERS.position,
      SHARED_FILTERS.leaveType,
      SHARED_FILTERS.leaveStatus,
      SHARED_FILTERS.startDateFrom,
      SHARED_FILTERS.startDateTo,
      SHARED_FILTERS.endDateFrom,
      SHARED_FILTERS.endDateTo,
    ],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "leaveType", label: "Leave Type", type: "text", sortable: true },
      { key: "startDate", label: "Start Date", type: "date", sortable: true },
      { key: "endDate", label: "End Date", type: "date", sortable: true },
      { key: "returnToWorkDate", label: "Return to Work Date", type: "date", sortable: true },
      { key: "daysUsed", label: "Days Used", type: "days", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
  },
  {
    id: "current-leave-balances",
    category: "leave",
    label: "Current Leave Balances",
    requiredFilters: [],
    guidance: ["No required filters. You may filter by Employee, Department, or Position."],
    filters: [SHARED_FILTERS.employee, SHARED_FILTERS.department, SHARED_FILTERS.position],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "contractPeriod", label: "Contract Period", type: "text", sortable: true },
      { key: "leaveType", label: "Leave Type", type: "text", sortable: true },
      { key: "entitlement", label: "Entitlement", type: "number", sortable: true },
      { key: "used", label: "Used", type: "number", sortable: true },
      { key: "remaining", label: "Remaining", type: "number", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
  },
  {
    id: "low-leave-balances",
    category: "leave",
    label: "Low Leave Balances",
    requiredFilters: [],
    guidance: ["No required filters. This report uses the Leave Warning Settings."],
    filters: [],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "contractPeriod", label: "Contract Period", type: "text", sortable: true },
      { key: "leaveType", label: "Leave Type", type: "text", sortable: true },
      { key: "entitlement", label: "Entitlement", type: "number", sortable: true },
      { key: "used", label: "Used", type: "number", sortable: true },
      { key: "remaining", label: "Remaining", type: "number", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
    ],
  },
  {
    id: "employees-currently-on-leave",
    category: "leave",
    label: "Employees Currently on Leave",
    requiredFilters: [],
    guidance: ["No required filters. You may run this report as-is."],
    filters: [],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "leaveType", label: "Leave Type", type: "text", sortable: true },
      { key: "startDate", label: "Start Date", type: "date", sortable: true },
      { key: "endDate", label: "End Date", type: "date", sortable: true },
      { key: "returnToWorkDate", label: "Return to Work Date", type: "date", sortable: true },
      { key: "daysUsed", label: "Days Used", type: "days", sortable: true },
    ],
  },
  {
    id: "employees-over-retirement-age",
    category: "retirement",
    label: "Employees Over Retirement Age",
    requiredFilters: [],
    guidance: ["No required filters. This report uses the Retirement Age Policy setting."],
    filters: [],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "dateOfBirth", label: "Date of Birth", type: "date", sortable: true },
      { key: "age", label: "Age", type: "number", sortable: true },
      { key: "retirementAge", label: "Retirement Age", type: "number", sortable: true },
      { key: "retirementDate", label: "Retirement Date", type: "date", sortable: true },
    ],
  },
  {
    id: "employees-reaching-retirement-within-1-year",
    category: "retirement",
    label: "Employees Reaching Retirement Within 1 Year",
    requiredFilters: [],
    guidance: ["No required filters. This report uses the Retirement Age Policy setting."],
    filters: [],
    columns: [
      { key: "fileNumber", label: "File #", type: "text", sortable: true },
      { key: "employee", label: "Employee", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "position", label: "Position", type: "text", sortable: true },
      { key: "dateOfBirth", label: "Date of Birth", type: "date", sortable: true },
      { key: "retirementDate", label: "Retirement Date", type: "date", sortable: true },
      { key: "daysUntilRetirement", label: "Days Until Retirement", type: "days", sortable: true },
    ],
  },
  {
    id: "employees-over-selected-age",
    category: "retirement",
    label: "Employees Over Selected Age",
    requiredFilters: ["ageValue"],
    guidance: ["Required field: Age Value."],
    filters: [{ key: "ageValue", label: "Age Value", type: "number", required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "employees-at-selected-age",
    category: "retirement",
    label: "Employees At Selected Age",
    requiredFilters: ["ageValue"],
    guidance: ["Required field: Age Value."],
    filters: [{ key: "ageValue", label: "Age Value", type: "number", required: true }],
    columns: EMPLOYEE_COLUMNS,
  },
  {
    id: "full-audit-trail",
    category: "audit",
    label: "Full Audit Trail",
    requiredFilters: [],
    guidance: ["No required filters. You may filter by date, action, module, success, or user."],
    filters: [
      { key: "auditType", label: "Audit Type", type: "select" },
      { key: "actorUser", label: "Actor/User", type: "text" },
      { key: "module", label: "Module", type: "select" },
      { key: "action", label: "Action", type: "text" },
      SHARED_FILTERS.success,
      SHARED_FILTERS.dateFrom,
      SHARED_FILTERS.dateTo,
    ],
    columns: [
      { key: "dateTime", label: "Date / Time", type: "date", sortable: true },
      { key: "auditType", label: "Audit Type", type: "text", sortable: true },
      { key: "whoAttemptedIt", label: "Who Attempted It", type: "text", sortable: true },
      { key: "action", label: "Action", type: "text", sortable: true },
      { key: "target", label: "Target", type: "text", sortable: true },
      { key: "module", label: "Module", type: "text", sortable: true },
      { key: "success", label: "Success", type: "status", sortable: true },
      { key: "failureReason", label: "Failure Reason", type: "text", sortable: true },
      { key: "ipAddress", label: "IP Address", type: "text", sortable: true },
      { key: "deviceName", label: "Device Name", type: "text", sortable: true },
    ],
  },
  {
    id: "user-accounts",
    category: "user",
    label: "User Accounts",
    requiredFilters: [],
    guidance: ["No required filters. Administrator only."],
    filters: [SHARED_FILTERS.role, SHARED_FILTERS.linkedEmployeeStatus],
    columns: [
      { key: "name", label: "Name", type: "text", sortable: true },
      { key: "email", label: "Email", type: "text", sortable: true },
      { key: "role", label: "Role", type: "text", sortable: true },
      { key: "department", label: "Department", type: "text", sortable: true },
      { key: "linkedEmployee", label: "Linked Employee", type: "text", sortable: true },
      { key: "status", label: "Status", type: "status", sortable: true },
      { key: "createdAt", label: "Created At", type: "date", sortable: true },
      { key: "lastLoginIp", label: "Last Login IP", type: "text", sortable: true },
      { key: "lastLoginDevice", label: "Last Login Device", type: "text", sortable: true },
    ],
  },
];

export function getReportDefinition(reportType: string): ReportDefinition | undefined {
  return REPORT_DEFINITIONS.find((item) => item.id === reportType);
}
