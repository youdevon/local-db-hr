import "server-only";

import { Prisma } from "@prisma/client";

import { getLeaveTypeLabel } from "@/lib/leave";
import { prisma } from "@/lib/prisma";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";

type PersonListItem = {
  id: string;
  fullName: string;
};

export type BirthdayListItem = PersonListItem & {
  birthdayLabel: string;
};

export type LeaveTodayListItem = PersonListItem & {
  leaveTypeLabel: string;
  returnDateLabel: string;
};

export type ExpiringContractListItem = PersonListItem & {
  contractId: string;
  contractNumber: string | null;
  endDateLabel: string;
  daysLeft: number;
};

export type DashboardMetrics = {
  contractsExpiringIn90Days: number;
  employeesOverRetirementAge: number;
  employeesReachingRetirementWithinOneYear: number;
  contractsBeyondRetirementCutoff: number;
  people: {
    totalEmployees: number;
    birthdaysThisMonth: number;
    birthdayList: BirthdayListItem[];
  };
  leave: {
    onLeaveToday: number;
    onLeaveTodayList: LeaveTodayListItem[];
    mostUsedLeaveTypeLabel: string;
    mostUsedLeaveTypeDays: number | null;
    lowLeaveBalances: number;
  };
  contracts: {
    expiringIn90Days: number;
    expiringContractList: ExpiringContractListItem[];
    employeesWithNoContract: number;
  };
  retirement: {
    overRetirementAge: number;
    reachingRetirementWithinOneYear: number;
    contractsBeyondRetirementCutoff: number;
  };
};

function formatDate(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function toDateOnly(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}

function addYears(date: Date, years: number): Date {
  const result = new Date(date);
  result.setFullYear(result.getFullYear() + years);
  return result;
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function subtractDays(date: Date, days: number): Date {
  return addDays(date, -days);
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

async function getConfiguredRetirementAge(): Promise<number> {
  try {
    const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
      SELECT setting_value
      FROM public.app_settings
      WHERE setting_key = 'retirement_age_policy'
      LIMIT 1
    `);
    const value = rows[0]?.setting_value;
    if (!value || typeof value !== "object") return 60;
    const obj = value as Record<string, unknown>;
    const rawAge = obj.retirementAge ?? obj.retirement_age;
    const age = Number(rawAge);
    if (!Number.isFinite(age) || age < 18 || age > 100) return 60;
    return Math.round(age);
  } catch {
    return 60;
  }
}

export async function getTotalEmployees(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.employees
  `);
  return rows[0]?.count ?? 0;
}

export async function getBirthdaysThisMonth(): Promise<{
  count: number;
  list: BirthdayListItem[];
}> {
  const [countRows, listRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM public.employees
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
    `),
    prisma.$queryRaw<
      Array<{ id: string; first_name: string; last_name: string; date_of_birth: Date | null }>
    >(Prisma.sql`
      SELECT
        id::text AS id,
        first_name,
        last_name,
        date_of_birth
      FROM public.employees
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY EXTRACT(DAY FROM date_of_birth), last_name, first_name
      LIMIT 5
    `),
  ]);

  return {
    count: countRows[0]?.count ?? 0,
    list: listRows.map((row) => ({
      id: row.id,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      birthdayLabel: formatDate(row.date_of_birth),
    })),
  };
}

export async function getCurrentlyOnLeaveToday(): Promise<{
  count: number;
  list: LeaveTodayListItem[];
}> {
  const [countRows, listRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(DISTINCT employee_id)::int AS count
      FROM public.leave_transactions
      WHERE CURRENT_DATE BETWEEN start_date AND end_date
        AND status IN ('recorded', 'approved', 'adjusted')
    `),
    prisma.$queryRaw<
      Array<{
        employee_id: string;
        first_name: string;
        last_name: string;
        leave_type: string;
        return_to_work_date: Date | null;
      }>
    >(Prisma.sql`
      SELECT DISTINCT ON (lt.employee_id)
        lt.employee_id::text AS employee_id,
        e.first_name,
        e.last_name,
        lt.leave_type,
        lt.return_to_work_date
      FROM public.leave_transactions lt
      JOIN public.employees e ON e.id = lt.employee_id
      WHERE CURRENT_DATE BETWEEN lt.start_date AND lt.end_date
        AND lt.status IN ('recorded', 'approved', 'adjusted')
      ORDER BY lt.employee_id, lt.end_date ASC, lt.start_date ASC
      LIMIT 5
    `),
  ]);

  return {
    count: countRows[0]?.count ?? 0,
    list: listRows.map((row) => ({
      id: row.employee_id,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      leaveTypeLabel: getLeaveTypeLabel(row.leave_type),
      returnDateLabel: formatDate(row.return_to_work_date),
    })),
  };
}

export async function getMostUsedLeaveType(): Promise<{
  leaveTypeLabel: string;
  totalDays: number | null;
}> {
  const rows = await prisma.$queryRaw<Array<{ leave_type: string; total_days: number }>>(Prisma.sql`
    SELECT
      leave_type,
      COALESCE(SUM(leave_days::numeric), 0)::float8 AS total_days
    FROM public.leave_transactions
    WHERE status IN ('recorded', 'approved', 'adjusted')
    GROUP BY leave_type
    ORDER BY total_days DESC, leave_type ASC
    LIMIT 1
  `);

  const top = rows[0];
  if (!top) {
    return { leaveTypeLabel: "—", totalDays: null };
  }

  return {
    leaveTypeLabel: getLeaveTypeLabel(top.leave_type),
    totalDays: Math.round(Number(top.total_days ?? 0)),
  };
}

export async function getLowLeaveBalanceCount(): Promise<number> {
  const settings = await getLeaveWarningSettings();
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(DISTINCT lyb.employee_id)::int AS count
    FROM public.leave_year_balances lyb
    WHERE
      lyb.remaining < 0
      OR lyb.remaining = 0
      OR (
        lyb.remaining > 0 AND lyb.remaining <= CASE
          WHEN lyb.leave_type = 'vacation' THEN ${settings.lowVacationLeaveThresholdDays}
          WHEN lyb.leave_type = 'sick' THEN ${settings.lowSickLeaveThresholdDays}
          ELSE ${settings.lowGeneralLeaveThresholdDays}
        END
      )
  `);
  return rows[0]?.count ?? 0;
}

export async function getContractsExpiringIn90Days(): Promise<{
  count: number;
  list: ExpiringContractListItem[];
}> {
  const [countRows, listRows] = await Promise.all([
    prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
      SELECT COUNT(*)::int AS count
      FROM public.contracts
      WHERE end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        AND COALESCE(status, '') NOT IN ('cancelled', 'terminated')
    `),
    prisma.$queryRaw<
      Array<{
        contract_id: string;
        contract_number: string | null;
        end_date: Date;
        employee_id: string;
        first_name: string;
        last_name: string;
        days_left: number;
      }>
    >(Prisma.sql`
      SELECT
        c.id::text AS contract_id,
        c.contract_number,
        c.end_date,
        e.id::text AS employee_id,
        e.first_name,
        e.last_name,
        GREATEST(0, (c.end_date - CURRENT_DATE))::int AS days_left
      FROM public.contracts c
      JOIN public.employees e ON e.id = c.employee_id
      WHERE c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
        AND COALESCE(c.status, '') NOT IN ('cancelled', 'terminated')
      ORDER BY c.end_date ASC, e.last_name ASC, e.first_name ASC
      LIMIT 5
    `),
  ]);

  return {
    count: countRows[0]?.count ?? 0,
    list: listRows.map((row) => ({
      id: row.employee_id,
      fullName: `${row.first_name} ${row.last_name}`.trim(),
      contractId: row.contract_id,
      contractNumber: row.contract_number,
      endDateLabel: formatDate(row.end_date),
      daysLeft: row.days_left,
    })),
  };
}

export async function getEmployeesWithNoContract(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.employees e
    LEFT JOIN public.contracts c ON c.employee_id = e.id
    WHERE c.id IS NULL
  `);
  return rows[0]?.count ?? 0;
}

export async function getRetirementMetrics(): Promise<{
  retirementAge: number;
  employeesWithDob: number;
  overRetirementAge: number;
  reachingWithinOneYear: number;
}> {
  const retirementAge = await getConfiguredRetirementAge();
  const employees = await prisma.$queryRaw<Array<{ date_of_birth: Date }>>(Prisma.sql`
    -- Reference:
    -- SELECT
    --   first_name,
    --   last_name,
    --   date_of_birth,
    --   DATE_PART('year', AGE(CURRENT_DATE, date_of_birth)) AS current_age
    -- FROM public.employees
    -- WHERE date_of_birth IS NOT NULL
    -- ORDER BY current_age DESC;
    SELECT date_of_birth
    FROM public.employees
    WHERE date_of_birth IS NOT NULL
  `);

  const today = startOfToday();
  const oneYearFromToday = addYears(today, 1);
  let overRetirementAge = 0;
  let reachingWithinOneYear = 0;

  for (const employee of employees) {
    const dob = toDateOnly(employee.date_of_birth);
    const retirementDate = toDateOnly(addYears(dob, retirementAge));
    if (retirementDate <= today) {
      overRetirementAge += 1;
      continue;
    }
    if (retirementDate > today && retirementDate <= oneYearFromToday) {
      reachingWithinOneYear += 1;
    }
  }

  return {
    retirementAge,
    employeesWithDob: employees.length,
    overRetirementAge,
    reachingWithinOneYear,
  };
}

export async function getEmployeesOverRetirementAge(retirementAge: number): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.employees
    WHERE date_of_birth IS NOT NULL
      AND DATE_PART('year', AGE(CURRENT_DATE, date_of_birth)) >= ${retirementAge}
  `);
  return rows[0]?.count ?? 0;
}

export async function getContractsBeyondRetirementCutoff(): Promise<number> {
  const retirementAge = await getConfiguredRetirementAge();
  const rows = await prisma.$queryRaw<Array<{ date_of_birth: Date; end_date: Date }>>(Prisma.sql`
    SELECT
      e.date_of_birth,
      c.end_date
    FROM public.contracts c
    JOIN public.employees e ON e.id = c.employee_id
    WHERE e.date_of_birth IS NOT NULL
      AND c.end_date IS NOT NULL
  `);

  const count = rows.reduce((total, row) => {
    const retirementDate = toDateOnly(addYears(toDateOnly(row.date_of_birth), retirementAge));
    const retirementCutoffDate = toDateOnly(subtractDays(retirementDate, 1));
    const contractEndDate = toDateOnly(row.end_date);
    return contractEndDate > retirementCutoffDate ? total + 1 : total;
  }, 0);

  return count;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const startMs = Date.now();
  const fallback: DashboardMetrics = {
    contractsExpiringIn90Days: 0,
    employeesOverRetirementAge: 0,
    employeesReachingRetirementWithinOneYear: 0,
    contractsBeyondRetirementCutoff: 0,
    people: {
      totalEmployees: 0,
      birthdaysThisMonth: 0,
      birthdayList: [],
    },
    leave: {
      onLeaveToday: 0,
      onLeaveTodayList: [],
      mostUsedLeaveTypeLabel: "—",
      mostUsedLeaveTypeDays: null,
      lowLeaveBalances: 0,
    },
    contracts: {
      expiringIn90Days: 0,
      expiringContractList: [],
      employeesWithNoContract: 0,
    },
    retirement: {
      overRetirementAge: 0,
      reachingRetirementWithinOneYear: 0,
      contractsBeyondRetirementCutoff: 0,
    },
  };

  const employeeCountResult = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.employees
  `);

  const contractCountResult = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.contracts
  `);

  const contractsExpiringResult = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.contracts
    WHERE end_date IS NOT NULL
      AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
  `);

  const noContractResult = await prisma.$queryRaw<Array<{ count: number }>>(Prisma.sql`
    SELECT COUNT(*)::int AS count
    FROM public.employees e
    WHERE NOT EXISTS (
      SELECT 1
      FROM public.contracts c
      WHERE c.employee_id = e.id
    )
  `);

  const totalEmployees = employeeCountResult[0]?.count ?? 0;
  const totalContracts = contractCountResult[0]?.count ?? 0;
  const contractsExpiringIn90Days = contractsExpiringResult[0]?.count ?? 0;
  const employeesWithNoContract = noContractResult[0]?.count ?? 0;

  if (process.env.NODE_ENV !== "production") {
    console.log("[dashboard metrics]", {
      totalEmployees,
      totalContracts,
      contractsExpiringIn90Days,
      employeesWithNoContract,
    });
    console.log("[dashboard metrics] contractsExpiringIn90Days", contractsExpiringIn90Days);
  }

  async function safe<T>(label: string, loader: () => Promise<T>, fallbackValue: T): Promise<T> {
    try {
      return await loader();
    } catch (error) {
      console.error("[dashboard metrics] query failed", { label, error });
      return fallbackValue;
    }
  }

  const [birthdays, leaveToday, mostUsedLeaveType, lowLeaveBalances, expiringContracts, retirement, contractsBeyondRetirementCutoff] =
    await Promise.all([
      safe("birthdays_this_month", getBirthdaysThisMonth, { count: 0, list: [] as BirthdayListItem[] }),
      safe("currently_on_leave_today", getCurrentlyOnLeaveToday, { count: 0, list: [] as LeaveTodayListItem[] }),
      safe("most_used_leave_type", getMostUsedLeaveType, { leaveTypeLabel: "—", totalDays: null as number | null }),
      safe("low_leave_balance_count", getLowLeaveBalanceCount, 0),
      safe("contracts_expiring_list", getContractsExpiringIn90Days, { count: contractsExpiringIn90Days, list: [] as ExpiringContractListItem[] }),
      safe("retirement_metrics", getRetirementMetrics, {
        retirementAge: 60,
        employeesWithDob: 0,
        overRetirementAge: 0,
        reachingWithinOneYear: 0,
      }),
      safe("contracts_beyond_retirement_cutoff", getContractsBeyondRetirementCutoff, 0),
    ]);

  const employeesOverRetirementAge = await safe(
    "employees_over_retirement_age",
    () => getEmployeesOverRetirementAge(retirement.retirementAge),
    retirement.overRetirementAge,
  );

  if (process.env.NODE_ENV !== "production") {
    console.log("[dashboard metrics] retirementAge", retirement.retirementAge);
    console.log("[dashboard metrics] employeesOverRetirementAge", employeesOverRetirementAge);
    console.log("[dashboard metrics] retirement", {
      retirementAge: retirement.retirementAge,
      employeesWithDob: retirement.employeesWithDob,
      employeesOverRetirementAge,
      employeesReachingRetirementWithinOneYear: retirement.reachingWithinOneYear,
      contractsBeyondRetirementCutoff,
    });
  }

  const metrics: DashboardMetrics = {
    ...fallback,
    contractsExpiringIn90Days: contractsExpiringIn90Days,
    employeesOverRetirementAge,
    employeesReachingRetirementWithinOneYear: retirement.reachingWithinOneYear,
    contractsBeyondRetirementCutoff,
    people: {
      totalEmployees,
      birthdaysThisMonth: birthdays.count,
      birthdayList: birthdays.list,
    },
    leave: {
      onLeaveToday: leaveToday.count,
      onLeaveTodayList: leaveToday.list,
      mostUsedLeaveTypeLabel: mostUsedLeaveType.leaveTypeLabel,
      mostUsedLeaveTypeDays: mostUsedLeaveType.totalDays,
      lowLeaveBalances,
    },
    contracts: {
      expiringIn90Days: contractsExpiringIn90Days,
      expiringContractList: expiringContracts.list,
      employeesWithNoContract,
    },
    retirement: {
      overRetirementAge: employeesOverRetirementAge,
      reachingRetirementWithinOneYear: retirement.reachingWithinOneYear,
      contractsBeyondRetirementCutoff,
    },
  };

  if (process.env.NODE_ENV !== "production") {
    console.log("[dashboard metrics] result", metrics);
  }

  const durationMs = Date.now() - startMs;
  if (durationMs > 1000) {
    console.warn("[dashboard metrics] slow query", { durationMs });
  }

  return metrics;
}
