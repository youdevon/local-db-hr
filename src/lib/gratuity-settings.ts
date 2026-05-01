export type GratuityCalculationSettings = {
  gratuityRate: number;
  governmentTaxRate: number;
  method: "gross_salary_contract_period_less_tax";
  effectiveFrom: string;
  active: boolean;
};

const STORAGE_KEY = "gratuity_calculation";

export const defaultGratuitySettings: GratuityCalculationSettings = {
  gratuityRate: 20,
  governmentTaxRate: 25,
  method: "gross_salary_contract_period_less_tax",
  effectiveFrom: "2026-01-01",
  active: true,
};

export function loadGratuitySettings(): GratuityCalculationSettings {
  if (typeof window === "undefined") return defaultGratuitySettings;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultGratuitySettings;
    const parsed = JSON.parse(raw) as Partial<GratuityCalculationSettings>;
    return {
      gratuityRate: Number(parsed.gratuityRate ?? defaultGratuitySettings.gratuityRate),
      governmentTaxRate: Number(parsed.governmentTaxRate ?? defaultGratuitySettings.governmentTaxRate),
      method: "gross_salary_contract_period_less_tax",
      effectiveFrom: parsed.effectiveFrom ?? defaultGratuitySettings.effectiveFrom,
      active: parsed.active ?? true,
    };
  } catch {
    return defaultGratuitySettings;
  }
}

export function saveGratuitySettings(settings: GratuityCalculationSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function contractMonthsBetween(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(`${startDate}T12:00:00`);
  const end = new Date(`${endDate}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const msDiff = end.getTime() - start.getTime();
  const days = msDiff / (1000 * 60 * 60 * 24) + 1;
  const months = days / 30.4375;
  return Math.round(months * 100) / 100;
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
