import { calculateContractEndDate } from "@/lib/contract-dates";

/**
 * Whole contract months from start/end dates using the same month-boundary rule as
 * {@link calculateContractEndDate}: the last day of month `n` is the day before the
 * `n`-month anniversary of the start date (e.g. 15 Jan → 14 Feb is one month).
 */
export function contractMonthsBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let n = 0;
  for (;;) {
    const boundaryIso = calculateContractEndDate(startDate, n + 1);
    if (!boundaryIso) break;
    const boundary = new Date(`${boundaryIso}T12:00:00`);
    if (boundary > end) break;
    n++;
  }
  return n;
}

/**
 * Prefers an explicit duration in months when it matches the contract end date (same rule as
 * {@link calculateContractEndDate}). Otherwise derives whole months from dates.
 * There is no `duration_months` column on contracts; "stored" duration comes from the form.
 */
export function resolveGratuityContractMonths(input: {
  startDate: string;
  endDate: string;
  explicitDurationMonths?: number | null;
  /** Typically {@link contractEndDateMatchesPeriod}(start, end, explicit). */
  endDateMatchesExplicitDuration: boolean;
}): number {
  const { startDate, endDate, explicitDurationMonths, endDateMatchesExplicitDuration } = input;
  if (
    explicitDurationMonths != null &&
    Number.isFinite(explicitDurationMonths) &&
    explicitDurationMonths > 0 &&
    endDateMatchesExplicitDuration
  ) {
    return Math.round(explicitDurationMonths);
  }
  return contractMonthsBetween(startDate, endDate);
}

export function calculateGratuity({
  monthlySalary,
  contractMonths,
  gratuityRate,
  governmentTaxRate,
}: {
  monthlySalary: number;
  contractMonths: number;
  gratuityRate: number;
  governmentTaxRate: number;
}) {
  const grossContractSalary = monthlySalary * contractMonths;
  const grossGratuity = grossContractSalary * (gratuityRate / 100);
  const taxDeduction = grossGratuity * (governmentTaxRate / 100);
  const netGratuity = grossGratuity - taxDeduction;
  return { grossContractSalary, grossGratuity, taxDeduction, netGratuity };
}
