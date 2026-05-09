import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export { calculateGratuity, contractMonthsBetween, resolveGratuityContractMonths } from "@/lib/gratuity-calculation";

export type GratuityCalculationSettings = {
  gratuityRate: number;
  governmentTaxRate: number;
  method: "gross_salary_contract_period_less_tax";
  effectiveFrom: string;
  active: boolean;
};

export const GRATUITY_SETTINGS_KEY = "gratuity_calculation" as const;

export const defaultGratuitySettings: GratuityCalculationSettings = {
  gratuityRate: 20,
  governmentTaxRate: 25,
  method: "gross_salary_contract_period_less_tax",
  effectiveFrom: "2026-01-01",
  active: true,
};

function clampPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed * 100) / 100;
  if (rounded < 0) return 0;
  if (rounded > 100) return 100;
  return rounded;
}

function normalizeIsoDate(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return fallback;
  return d.toISOString().slice(0, 10);
}

export function normalizeGratuitySettings(raw: Partial<GratuityCalculationSettings> | null | undefined): GratuityCalculationSettings {
  return {
    gratuityRate: clampPercent(raw?.gratuityRate, defaultGratuitySettings.gratuityRate),
    governmentTaxRate: clampPercent(raw?.governmentTaxRate, defaultGratuitySettings.governmentTaxRate),
    method: "gross_salary_contract_period_less_tax",
    effectiveFrom: normalizeIsoDate(raw?.effectiveFrom, defaultGratuitySettings.effectiveFrom),
    active: typeof raw?.active === "boolean" ? raw.active : true,
  };
}

export async function getGratuitySettings(): Promise<GratuityCalculationSettings> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
    SELECT setting_value
    FROM public.app_settings
    WHERE setting_key = ${GRATUITY_SETTINGS_KEY}
    LIMIT 1
  `);
  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return defaultGratuitySettings;
  return normalizeGratuitySettings(raw as Partial<GratuityCalculationSettings>);
}

export async function saveGratuitySettings(settings: GratuityCalculationSettings): Promise<GratuityCalculationSettings> {
  const normalized = normalizeGratuitySettings(settings);
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (setting_key, setting_value, description)
      VALUES (
        ${GRATUITY_SETTINGS_KEY},
        ${JSON.stringify(normalized)}::jsonb,
        'Global gratuity calculation defaults used for current and future contracts.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );
  return normalized;
}

