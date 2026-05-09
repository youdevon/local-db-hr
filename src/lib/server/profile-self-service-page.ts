import "server-only";

import { Prisma } from "@prisma/client";

import { getEmployeeQualificationsBundle } from "@/lib/server/employee-qualifications-bundle";
import type { EmployeeQualificationsBundle } from "@/lib/server/employee-qualifications-bundle";
import { formatDateLabel } from "@/lib/leave";
import { contractMonthsBetween, calculateGratuity, defaultGratuitySettings } from "@/lib/gratuity-settings";
import { formatCurrencyTTD } from "@/lib/mock/contracts";
import { resolveLeaveTransactionsContractStatus } from "@/lib/leave-selected-contract-status";
import { prisma } from "@/lib/prisma";
import type { ProfilePersonalInfoFields } from "@/lib/types/profile-personal-info";

export type ProfileAccountBlock = {
  userId: string;
  email: string;
  role: string;
  fullName: string;
  department: string;
  employeeId: string | null;
};

export type ProfileContractForSelfService = {
  contractId: string;
  dropdownLabel: string;
  statusLabel: string;
  minuteNumber: string;
  contractNumber: string;
  startDate: string;
  endDate: string;
  contractDurationLabel: string;
  monthlySalaryText: string;
  annualSalaryText: string;
  contractPeriodGrossSalaryText: string;
  gratuityText: string;
  vacationEntitlementText: string;
  sickEntitlementText: string;
  rawStatus: string;
};

export type ProfileSelfServiceData = {
  account: ProfileAccountBlock;
  employee: null | {
    id: string;
    fullName: string;
    fileNumber: string;
    workEmail: string;
    userEmail: string;
    department: string;
    position: string;
    personal: ProfilePersonalInfoFields;
  };
  contracts: ProfileContractForSelfService[];
  defaultContractId: string | null;
  qualificationsBundle: EmployeeQualificationsBundle | null;
};

function normalizeStatus(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "—";
  return v.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function toIsoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function formatHumanDurationFromDecimalMonths(decimalMonths: number): string {
  const mWhole = Math.max(0, Math.round(decimalMonths));
  if (mWhole === 0) return "—";
  const years = Math.floor(mWhole / 12);
  const rem = mWhole % 12;
  const parts: string[] = [];
  if (years > 0) {
    parts.push(`${years} year${years === 1 ? "" : "s"}`);
  }
  if (rem > 0) {
    parts.push(`${rem} month${rem === 1 ? "" : "s"}`);
  }
  return parts.length > 0 ? parts.join(", ") : `${mWhole} months`;
}

function buildContractRow(
  contract: {
    id: string;
    minute_number: string | null;
    contract_number: string | null;
    start_date: Date;
    end_date: Date;
    salary: number;
    gratuity: number;
    vacation_leave_entitlement: number;
    sick_leave_entitlement: number;
    status: string | null;
  },
  gratuityRate: number,
  taxRate: number,
): ProfileContractForSelfService {
  const startIso = toIsoDate(contract.start_date);
  const endIso = toIsoDate(contract.end_date);
  const months = contractMonthsBetween(startIso, endIso);
  const resolved = resolveLeaveTransactionsContractStatus(
    normalizeStatus(contract.status),
    startIso,
    endIso,
  );

  const monthly = Number(contract.salary ?? 0);
  const calculated = calculateGratuity({
    monthlySalary: monthly,
    contractMonths: months,
    gratuityRate,
    governmentTaxRate: taxRate,
  });
  const effectiveGratuity =
    Number(contract.gratuity ?? 0) > 0 ? Number(contract.gratuity) : Number(calculated.netGratuity);

  const vacationEnt = Number(contract.vacation_leave_entitlement ?? 0);
  const sickEnt = Number(contract.sick_leave_entitlement ?? 0);

  return {
    contractId: contract.id,
    dropdownLabel: `${resolved.label}: ${formatDateLabel(startIso)} – ${formatDateLabel(endIso)}`,
    statusLabel: resolved.label,
    minuteNumber: contract.minute_number?.trim() || "—",
    contractNumber: contract.contract_number?.trim() || "—",
    startDate: formatDateLabel(startIso),
    endDate: formatDateLabel(endIso),
    contractDurationLabel: formatHumanDurationFromDecimalMonths(months),
    monthlySalaryText: formatCurrencyTTD(monthly),
    annualSalaryText: formatCurrencyTTD(monthly * 12),
    contractPeriodGrossSalaryText: formatCurrencyTTD(calculated.grossContractSalary),
    gratuityText: formatCurrencyTTD(effectiveGratuity),
    vacationEntitlementText: vacationEnt > 0 ? `${vacationEnt} days` : "—",
    sickEntitlementText: sickEnt > 0 ? `${sickEnt} days` : "—",
    rawStatus: normalizeStatus(contract.status),
  };
}

export async function getProfileSelfServiceData(
  sessionUserId: string,
  sessionEmail: string,
): Promise<ProfileSelfServiceData | null> {
  const userRows = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string | null;
      role: string | null;
      full_name: string | null;
      department: string | null;
      employee_id: string | null;
    }>
  >(Prisma.sql`
    SELECT
      u.id::text AS id,
      u.email,
      p.role,
      p.full_name,
      p.department,
      p.employee_id::text AS employee_id
    FROM public.users u
    LEFT JOIN public.user_profiles p
      ON p.user_id = u.id
    WHERE
      (${sessionUserId}::text <> '' AND u.id::text = ${sessionUserId})
      OR
      (${sessionEmail}::text <> '' AND lower(u.email) = lower(${sessionEmail}))
    LIMIT 1
  `);
  const user = userRows[0];
  if (!user) return null;

  const base: ProfileSelfServiceData = {
    account: {
      userId: user.id,
      email: user.email?.trim() || "—",
      role: user.role?.trim() || "—",
      fullName: user.full_name?.trim() || "—",
      department: user.department?.trim() || "—",
      employeeId: user.employee_id,
    },
    employee: null,
    contracts: [],
    defaultContractId: null,
    qualificationsBundle: null,
  };

  if (!user.employee_id) return base;

  const gratuitySettingsRows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
    SELECT setting_value
    FROM public.app_settings
    WHERE setting_key = 'gratuity_calculation'
    LIMIT 1
  `);
  const gratuitySettings = gratuitySettingsRows[0]?.setting_value as
    | { gratuityRate?: number; governmentTaxRate?: number }
    | undefined;
  const gratuityRate = Number(gratuitySettings?.gratuityRate ?? defaultGratuitySettings.gratuityRate);
  const taxRate = Number(gratuitySettings?.governmentTaxRate ?? defaultGratuitySettings.governmentTaxRate);

  const employeeRows = await prisma.$queryRaw<
    Array<{
      id: string;
      file_number: string;
      first_name: string;
      last_name: string;
      work_email: string | null;
      personal_email: string | null;
      mobile_number: string | null;
      home_number: string | null;
      department: string | null;
      position: string | null;
    }>
  >(Prisma.sql`
    SELECT
      id::text AS id,
      file_number,
      first_name,
      last_name,
      work_email,
      personal_email,
      mobile_number,
      home_number,
      department,
      position
    FROM public.employees
    WHERE id = ${user.employee_id}::uuid
    LIMIT 1
  `);
  const employee = employeeRows[0];
  if (!employee) return base;

  const contractRows = await prisma.$queryRaw<
    Array<{
      id: string;
      minute_number: string | null;
      contract_number: string | null;
      start_date: Date;
      end_date: Date;
      salary: number;
      gratuity: number;
      vacation_leave_entitlement: number;
      sick_leave_entitlement: number;
      status: string | null;
    }>
  >(Prisma.sql`
    SELECT
      id::text AS id,
      minute_number,
      contract_number,
      start_date,
      end_date,
      salary::numeric::float8 AS salary,
      gratuity::numeric::float8 AS gratuity,
      vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
      sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement,
      status
    FROM public.contracts
    WHERE employee_id = ${user.employee_id}::uuid
    ORDER BY
      CASE
        WHEN CURRENT_DATE BETWEEN start_date AND end_date
          AND COALESCE(lower(status), '') NOT IN ('cancelled', 'terminated', 'closed')
          THEN 0
        WHEN start_date > CURRENT_DATE THEN 1
        WHEN end_date < CURRENT_DATE THEN 2
        ELSE 3
      END,
      end_date DESC NULLS LAST,
      start_date DESC
  `);

  const residentialAddress = await prisma.employee_addresses.findFirst({
    where: { employee_id: user.employee_id, address_type: "residential" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });
  const primaryEmergency = await prisma.employee_emergency_contacts.findFirst({
    where: { employee_id: user.employee_id, contact_type: "primary_emergency" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });
  const nextOfKin = await prisma.employee_emergency_contacts.findFirst({
    where: { employee_id: user.employee_id, contact_type: "next_of_kin" },
    orderBy: [{ is_primary: "desc" }, { created_at: "asc" }],
  });

  const fullName = `${employee.first_name} ${employee.last_name}`.trim();
  const fallbackEmail = user.email?.trim() || "—";

  base.employee = {
    id: employee.id,
    fullName,
    fileNumber: employee.file_number || "—",
    workEmail: employee.work_email?.trim() || "—",
    userEmail: fallbackEmail,
    department: employee.department?.trim() || base.account.department || "—",
    position: employee.position?.trim() || "—",
    personal: {
      mobileNumber: employee.mobile_number?.trim() || "",
      homeNumber: employee.home_number?.trim() || "",
      personalEmail: employee.personal_email?.trim() || "",
      addressLine1: residentialAddress?.address_line_1?.trim() || "",
      addressLine2: residentialAddress?.address_line_2?.trim() || "",
      communityCity: residentialAddress?.community_city?.trim() || "",
      regionMunicipality: residentialAddress?.region_municipality?.trim() || "",
      country: residentialAddress?.country?.trim() || "Trinidad and Tobago",
      postalCode: residentialAddress?.postal_code?.trim() || "",
      emergencyContactName: primaryEmergency?.contact_name?.trim() || "",
      emergencyContactRelationship: primaryEmergency?.relationship?.trim() || "",
      emergencyContactMobileNumber: primaryEmergency?.mobile_number?.trim() || "",
      emergencyContactAlternativeNumber: primaryEmergency?.alternative_number?.trim() || "",
      emergencyContactEmail: primaryEmergency?.email?.trim() || "",
      emergencyContactAddress: primaryEmergency?.address?.trim() || "",
      nextOfKinFullName: nextOfKin?.contact_name?.trim() || "",
      nextOfKinRelationship: nextOfKin?.relationship?.trim() || "",
      nextOfKinMobileNumber: nextOfKin?.mobile_number?.trim() || "",
      nextOfKinAlternativeNumber: nextOfKin?.alternative_number?.trim() || "",
      nextOfKinEmail: nextOfKin?.email?.trim() || "",
      nextOfKinAddress: nextOfKin?.address?.trim() || "",
    },
  };

  base.contracts = contractRows.map((c) => buildContractRow(c, gratuityRate, taxRate));
  base.defaultContractId = base.contracts[0]?.contractId ?? null;

  if (user.employee_id) {
    base.qualificationsBundle = await getEmployeeQualificationsBundle(user.employee_id);
  } else {
    base.qualificationsBundle = null;
  }

  return base;
}
