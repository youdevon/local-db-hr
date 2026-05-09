export type RetirementAgePolicy = {
  retirementAge: number;
  warningYearsBeforeRetirement: number;
  enforceRetirementCheck: boolean;
  allowOverride: boolean;
  requireOverrideReason: boolean;
  requireApprovalReference: boolean;
  defaultStopDayBeforeBirthday: boolean;
  updatedAt?: string;
  updatedBy?: string | null;
};

export const DEFAULT_RETIREMENT_AGE_POLICY: RetirementAgePolicy = {
  retirementAge: 60,
  warningYearsBeforeRetirement: 3,
  enforceRetirementCheck: true,
  allowOverride: true,
  requireOverrideReason: true,
  requireApprovalReference: true,
  defaultStopDayBeforeBirthday: true,
  updatedBy: null,
};

function toDateOnly(value: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function calculateRetirementDate(dateOfBirth: string, retirementAge: number): string | null {
  const dob = toDateOnly(dateOfBirth);
  if (!dob) return null;
  const retirementDate = new Date(dob);
  retirementDate.setFullYear(retirementDate.getFullYear() + retirementAge);
  return toIsoDate(retirementDate);
}

function toAsOfDate(value?: string | Date): Date {
  if (!value) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const parsed = toDateOnly(value);
  if (!parsed) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  return parsed;
}

function daysBetween(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

export function calculateDaysUntilRetirement(
  dateOfBirth: string,
  retirementAge: number,
  asOfDate?: string | Date,
): number | null {
  const retirementDateIso = calculateRetirementDate(dateOfBirth, retirementAge);
  if (!retirementDateIso) return null;
  const retirementDate = toDateOnly(retirementDateIso);
  if (!retirementDate) return null;
  const asOf = toAsOfDate(asOfDate);
  return daysBetween(asOf, retirementDate);
}

export function calculateDaysBeyondRetirement(
  dateOfBirth: string,
  retirementAge: number,
  asOfDate?: string | Date,
): number | null {
  const daysUntil = calculateDaysUntilRetirement(dateOfBirth, retirementAge, asOfDate);
  if (daysUntil == null) return null;
  return daysUntil < 0 ? Math.abs(daysUntil) : 0;
}

export function calculateAgeAtContractEnd(
  dateOfBirth: string,
  contractEndDate: string,
): number | null {
  const dob = toDateOnly(dateOfBirth);
  const contractEnd = toDateOnly(contractEndDate);
  if (!dob || !contractEnd) return null;
  let age = contractEnd.getFullYear() - dob.getFullYear();
  const birthdayPassed =
    contractEnd.getMonth() > dob.getMonth() ||
    (contractEnd.getMonth() === dob.getMonth() && contractEnd.getDate() >= dob.getDate());
  if (!birthdayPassed) age -= 1;
  return age;
}

export function willReachRetirementAgeDuringContract(
  dateOfBirth: string,
  contractStartDate: string,
  contractEndDate: string,
  retirementAge: number,
): boolean {
  const start = toDateOnly(contractStartDate);
  const end = toDateOnly(contractEndDate);
  const retirementDateIso = calculateRetirementDate(dateOfBirth, retirementAge);
  const retirementDate = retirementDateIso ? toDateOnly(retirementDateIso) : null;
  if (!start || !end || !retirementDate) return false;
  return retirementDate >= start && retirementDate <= end;
}

export function getRetirementStatus(
  dateOfBirth: string,
  retirementAge: number,
  asOfDate?: string | Date,
): "over-retirement" | "approaching-retirement" | "active" | "unknown" {
  const daysUntil = calculateDaysUntilRetirement(dateOfBirth, retirementAge, asOfDate);
  if (daysUntil == null) return "unknown";
  if (daysUntil < 0) return "over-retirement";
  if (daysUntil <= 365) return "approaching-retirement";
  return "active";
}

export function calculateRecommendedRetirementContractEndDate(
  dateOfBirth: string,
  retirementAge: number,
): string | null {
  const retirementDate = calculateRetirementDate(dateOfBirth, retirementAge);
  if (!retirementDate) return null;
  const parsedRetirement = toDateOnly(retirementDate);
  if (!parsedRetirement) return null;
  parsedRetirement.setDate(parsedRetirement.getDate() - 1);
  return toIsoDate(parsedRetirement);
}

export function doesContractExceedRetirementCutoff(
  contractEndDate: string,
  cutoffDate: string | null,
): boolean {
  if (!cutoffDate) return false;
  const end = toDateOnly(contractEndDate);
  const cutoff = toDateOnly(cutoffDate);
  if (!end || !cutoff) return false;
  return end > cutoff;
}

