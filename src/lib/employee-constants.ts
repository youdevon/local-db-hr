export const EMPLOYEE_ID_TYPES = [
  "National ID",
  "NIS",
  "BIR",
  "Driver Permit",
  "Passport",
  "Work Permit",
  "Other",
] as const;

export type EmployeeIdType = (typeof EMPLOYEE_ID_TYPES)[number];

export const GENDER_OPTIONS = ["Female", "Male", "Non-binary", "Prefer not to say", "Other"] as const;

export const MARITAL_STATUS_OPTIONS = ["Single", "Married", "Divorced", "Widowed", "Separated", "Other"] as const;

export const EMPLOYMENT_STATUS_OPTIONS = [
  "Active",
  "On Leave",
  "Inactive",
  "Terminated",
] as const;

export const EMPLOYEE_CATEGORY_OPTIONS = [
  "Permanent",
  "Contract",
  "Temporary",
  "Executive",
  "Support",
] as const;
