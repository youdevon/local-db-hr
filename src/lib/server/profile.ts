import "server-only";

import { Prisma } from "@prisma/client";

import { calculateWorkingLeaveDays } from "@/lib/leave-days";
import { formatDateLabel, formatLeaveDays, getLeaveTypeLabel } from "@/lib/leave";
import { getPublicHolidaySetForRange } from "@/lib/server/public-holidays";
import { contractMonthsBetween, calculateGratuity, defaultGratuitySettings } from "@/lib/gratuity-settings";
import { formatCurrencyTTD } from "@/lib/mock/contracts";
import { prisma } from "@/lib/prisma";
import { getProfileLeaveSummaryForContract } from "@/lib/server/profile-leave-summary";

type ProfileData = {
  account: {
    userId: string;
    email: string;
    role: string;
    fullName: string;
    department: string;
    employeeId: string | null;
  };
  employee: null | {
    id: string;
    fullName: string;
    fileNumber: string;
    email: string;
    department: string;
    position: string;
    personal: {
      mobileNumber: string;
      homeNumber: string;
      personalEmail: string;
      addressLine1: string;
      addressLine2: string;
      communityCity: string;
      regionMunicipality: string;
      country: string;
      postalCode: string;
      emergencyContactName: string;
      emergencyContactRelationship: string;
      emergencyContactMobileNumber: string;
      emergencyContactAlternativeNumber: string;
      emergencyContactEmail: string;
      emergencyContactAddress: string;
      nextOfKinFullName: string;
      nextOfKinRelationship: string;
      nextOfKinMobileNumber: string;
      nextOfKinAlternativeNumber: string;
      nextOfKinEmail: string;
      nextOfKinAddress: string;
    };
  };
  contract: null | {
    minuteNumber: string;
    contractNumber: string;
    startDate: string;
    endDate: string;
    durationMonths: string;
    salaryText: string;
    gratuityText: string;
    status: string;
    contractId: string;
  };
  leaveSummary: null | {
    contractYearLabel: string;
    vacation: {
      entitlementText: string;
      rolloverInText: string;
      usedText: string;
      remainingText: string;
      status: "Healthy" | "Low" | "Exhausted" | "Overused";
    };
    sick: {
      entitlementText: string;
      rolloverInText: string;
      usedText: string;
      remainingText: string;
      status: "Healthy" | "Low" | "Exhausted" | "Overused";
    };
  };
  recentLeaveTransactions: Array<{
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    returnToWorkDate: string;
    daysUsed: string;
    status: string;
  }>;
  hasMoreLeaveTransactions: boolean;
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

export async function getProfileDataForUser(
  sessionUserId: string,
  sessionEmail: string,
): Promise<ProfileData | null> {
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

  const base: ProfileData = {
    account: {
      userId: user.id,
      email: user.email?.trim() || "—",
      role: user.role?.trim() || "—",
      fullName: user.full_name?.trim() || "—",
      department: user.department?.trim() || "—",
      employeeId: user.employee_id,
    },
    employee: null,
    contract: null,
    leaveSummary: null,
    recentLeaveTransactions: [],
    hasMoreLeaveTransactions: false,
  };

  if (!user.employee_id) return base;

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
         AND COALESCE(lower(status), '') NOT IN ('cancelled', 'terminated')
          THEN 0
        ELSE 1
      END,
      end_date DESC NULLS FIRST,
      start_date DESC
    LIMIT 1
  `);
  const contract = contractRows[0] ?? null;

  const fullName = `${employee.first_name} ${employee.last_name}`.trim();
  const fallbackEmail = user.email?.trim() || "—";
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
  base.employee = {
    id: employee.id,
    fullName,
    fileNumber: employee.file_number || "—",
    email: employee.work_email?.trim() || fallbackEmail,
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

  if (!contract) return base;

  const startIso = toIsoDate(contract.start_date);
  const endIso = toIsoDate(contract.end_date);
  const months = contractMonthsBetween(startIso, endIso);
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
  const calculated = calculateGratuity({
    monthlySalary: Number(contract.salary ?? 0),
    contractMonths: months,
    gratuityRate,
    governmentTaxRate: taxRate,
  });
  const effectiveGratuity =
    Number(contract.gratuity ?? 0) > 0 ? Number(contract.gratuity) : Number(calculated.netGratuity);

  base.contract = {
    contractId: contract.id,
    minuteNumber: contract.minute_number?.trim() || "—",
    contractNumber: contract.contract_number?.trim() || "No assigned number",
    startDate: formatDateLabel(startIso),
    endDate: formatDateLabel(endIso),
    durationMonths: `${Math.round(months)} months`,
    salaryText: formatCurrencyTTD(Number(contract.salary ?? 0)),
    gratuityText: formatCurrencyTTD(effectiveGratuity),
    status: normalizeStatus(contract.status),
  };

  base.leaveSummary = await getProfileLeaveSummaryForContract(user.employee_id, {
    id: contract.id,
    startDate: startIso,
    endDate: endIso,
    vacationEntitlement: Number(contract.vacation_leave_entitlement ?? 0),
    sickEntitlement: Number(contract.sick_leave_entitlement ?? 0),
  });

  const txRows = await prisma.$queryRaw<
    Array<{
      id: string;
      leave_type: string;
      start_date: Date;
      end_date: Date;
      return_to_work_date: Date;
      leave_days: number | null;
      status: string | null;
      created_at: Date;
    }>
  >(Prisma.sql`
    SELECT
      id::text AS id,
      leave_type,
      start_date,
      end_date,
      return_to_work_date,
      leave_days::numeric::float8 AS leave_days,
      status,
      created_at
    FROM public.leave_transactions
    WHERE employee_id = ${user.employee_id}::uuid
    ORDER BY created_at DESC NULLS LAST, start_date DESC
    LIMIT 3
  `);

  let holidaySetRecent = new Set<string>();
  if (txRows.length > 0) {
    let minIso = toIsoDate(txRows[0].start_date);
    let maxIso = toIsoDate(txRows[0].end_date);
    for (const tx of txRows) {
      const s = toIsoDate(tx.start_date);
      const e = toIsoDate(tx.end_date);
      if (s < minIso) minIso = s;
      if (e > maxIso) maxIso = e;
    }
    holidaySetRecent = await getPublicHolidaySetForRange(minIso, maxIso);
  }

  base.hasMoreLeaveTransactions = false;
  base.recentLeaveTransactions = txRows.map((tx) => {
    const stored = Math.round(Number(tx.leave_days ?? 0));
    const days =
      stored > 0 ? stored : calculateWorkingLeaveDays(tx.start_date, tx.end_date, holidaySetRecent);
    return {
      id: tx.id,
      leaveType: getLeaveTypeLabel(tx.leave_type),
      startDate: formatDateLabel(toIsoDate(tx.start_date)),
      endDate: formatDateLabel(toIsoDate(tx.end_date)),
      returnToWorkDate: formatDateLabel(toIsoDate(tx.return_to_work_date)),
      daysUsed: formatLeaveDays(days),
      status: normalizeStatus(tx.status),
    };
  });

  return base;
}
