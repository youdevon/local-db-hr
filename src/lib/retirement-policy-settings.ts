import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_RETIREMENT_AGE_POLICY,
  type RetirementAgePolicy,
} from "@/lib/retirement-policy";

export async function getRetirementAgePolicySettings(): Promise<RetirementAgePolicy> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
    Prisma.sql`
      SELECT setting_value
      FROM public.app_settings
      WHERE setting_key IN ('retirement_policy', 'retirement_age_policy')
      ORDER BY CASE WHEN setting_key = 'retirement_policy' THEN 0 ELSE 1 END
      LIMIT 1
    `,
  );

  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return DEFAULT_RETIREMENT_AGE_POLICY;
  const data = raw as Partial<RetirementAgePolicy>;

  return {
    retirementAge:
      Number.isFinite(Number(data.retirementAge)) && Number(data.retirementAge) >= 18 && Number(data.retirementAge) <= 100
        ? Number(data.retirementAge)
        : DEFAULT_RETIREMENT_AGE_POLICY.retirementAge,
    warningYearsBeforeRetirement:
      Number.isFinite(Number(data.warningYearsBeforeRetirement)) &&
      Number(data.warningYearsBeforeRetirement) >= 0 &&
      Number(data.warningYearsBeforeRetirement) <= 10
        ? Number(data.warningYearsBeforeRetirement)
        : DEFAULT_RETIREMENT_AGE_POLICY.warningYearsBeforeRetirement,
    enforceRetirementCheck:
      typeof data.enforceRetirementCheck === "boolean"
        ? data.enforceRetirementCheck
        : DEFAULT_RETIREMENT_AGE_POLICY.enforceRetirementCheck,
    allowOverride:
      typeof data.allowOverride === "boolean"
        ? data.allowOverride
        : DEFAULT_RETIREMENT_AGE_POLICY.allowOverride,
    requireOverrideReason:
      typeof data.requireOverrideReason === "boolean"
        ? data.requireOverrideReason
        : DEFAULT_RETIREMENT_AGE_POLICY.requireOverrideReason,
    requireApprovalReference:
      typeof data.requireApprovalReference === "boolean"
        ? data.requireApprovalReference
        : DEFAULT_RETIREMENT_AGE_POLICY.requireApprovalReference,
    defaultStopDayBeforeBirthday:
      typeof data.defaultStopDayBeforeBirthday === "boolean"
        ? data.defaultStopDayBeforeBirthday
        : DEFAULT_RETIREMENT_AGE_POLICY.defaultStopDayBeforeBirthday,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    updatedBy: typeof data.updatedBy === "string" || data.updatedBy == null ? data.updatedBy ?? null : null,
  };
}

export async function getRetirementPolicy(): Promise<RetirementAgePolicy> {
  return getRetirementAgePolicySettings();
}

export async function getRetirementAge(): Promise<number> {
  const policy = await getRetirementAgePolicySettings();
  return policy.retirementAge;
}

