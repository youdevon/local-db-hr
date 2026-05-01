export type RetirementAgePolicy = {
  retirementAge: number;
  enforceRetirementCheck: boolean;
  allowOverride: boolean;
  requireOverrideReason: boolean;
  requireApprovalReference: boolean;
  defaultStopDayBeforeBirthday: boolean;
};

export const DEFAULT_RETIREMENT_AGE_POLICY: RetirementAgePolicy = {
  retirementAge: 60,
  enforceRetirementCheck: true,
  allowOverride: true,
  requireOverrideReason: true,
  requireApprovalReference: true,
  defaultStopDayBeforeBirthday: true,
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

