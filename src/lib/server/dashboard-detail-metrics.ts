import "server-only";

import { Prisma } from "@prisma/client";

import { formatDateLabel, formatLeaveDays, getLeaveTypeLabel } from "@/lib/leave";
import { prisma } from "@/lib/prisma";
import { getLeaveSearchRowsFromDatabase } from "@/lib/server/leave-search";
import { parseDaysLabel } from "@/lib/sort-compare";
import type { StatusTone } from "@/components/status-badge";

function parseLeaveDaysForSort(text: string): number {
  const v = parseDaysLabel(text);
  return Number.isNaN(v) ? Number.NEGATIVE_INFINITY : v;
}

export type DashboardDetailMetricSlug =
  | "total-employees"
  | "birthdays-this-month"
  | "contracts-expiring-90-days"
  | "employees-with-no-contract"
  | "employees-over-retirement-age"
  | "retirement-within-one-year"
  | "contracts-beyond-retirement-cutoff"
  | "on-leave-today"
  | "most-used-leave-type"
  | "low-leave-balances";

export type DashboardDetailColumn = {
  key: string;
  label: string;
  /** Row field to use for sorting when different from display `key` (e.g. ISO date). */
  sortKey?: string;
};

export type DashboardDetailCell =
  | string
  | number
  | {
      type: "status";
      label: string;
      tone: StatusTone;
    };

export type DashboardDetailRow = Record<string, DashboardDetailCell> & {
  href?: string;
};

export type DashboardMetricDetails = {
  title: string;
  description: string;
  icon:
    | "users"
    | "cake"
    | "file-clock"
    | "file-warning"
    | "user-check"
    | "calendar-clock"
    | "shield-alert"
    | "calendar-days"
    | "chart"
    | "alert";
  columns: DashboardDetailColumn[];
  rows: DashboardDetailRow[];
  emptyMessage: string;
};

const METRIC_SLUGS: DashboardDetailMetricSlug[] = [
  "total-employees",
  "birthdays-this-month",
  "contracts-expiring-90-days",
  "employees-with-no-contract",
  "employees-over-retirement-age",
  "retirement-within-one-year",
  "contracts-beyond-retirement-cutoff",
  "on-leave-today",
  "most-used-leave-type",
  "low-leave-balances",
];

function isMetricSlug(value: string): value is DashboardDetailMetricSlug {
  return METRIC_SLUGS.includes(value as DashboardDetailMetricSlug);
}

function formatDays(value: number): string {
  return formatLeaveDays(value);
}

function toStatusCell(label: string): DashboardDetailCell {
  const normalized = label.trim().toLowerCase();
  if (normalized === "active" || normalized === "approved" || normalized === "recorded") {
    return { type: "status", label, tone: "success" };
  }
  if (normalized === "draft" || normalized === "future" || normalized === "renewed" || normalized === "low") {
    return { type: "status", label, tone: "warning" };
  }
  if (
    normalized === "cancelled" ||
    normalized === "terminated" ||
    normalized === "rejected" ||
    normalized === "overused" ||
    normalized === "exhausted"
  ) {
    return { type: "status", label, tone: "danger" };
  }
  return { type: "status", label, tone: "muted" };
}

async function getConfiguredRetirementAge(): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
    SELECT setting_value
    FROM public.app_settings
    WHERE setting_key = 'retirement_age_policy'
    LIMIT 1
  `);
  const value = rows[0]?.setting_value;
  if (!value || typeof value !== "object") return 60;
  const objectValue = value as Record<string, unknown>;
  const age = Number(objectValue.retirementAge ?? objectValue.retirement_age ?? 60);
  if (!Number.isFinite(age) || age < 18 || age > 100) return 60;
  return Math.round(age);
}

export async function getDashboardMetricDetails(metric: string): Promise<DashboardMetricDetails | null> {
  if (!isMetricSlug(metric)) return null;

  if (metric === "total-employees") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        work_email: string | null;
        mobile_number: string | null;
      }>
    >(Prisma.sql`
      SELECT
        id::text AS id,
        file_number,
        first_name,
        last_name,
        department,
        position,
        work_email,
        mobile_number
      FROM public.employees
      ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, last_name, first_name
    `);
    return {
      title: "Total Employees",
      description: "All employee records currently stored in the system.",
      icon: "users",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "workEmail", label: "Work Email" },
        { key: "mobileNumber", label: "Mobile Number" },
      ],
      rows: rows.map((row) => ({
        fileNumber: row.file_number || "—",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        department: row.department?.trim() || "—",
        position: row.position?.trim() || "—",
        workEmail: row.work_email?.trim() || "—",
        mobileNumber: row.mobile_number?.trim() || "—",
        href: `/employees/${row.id}`,
      })),
      emptyMessage: "No employee records found.",
    };
  }

  if (metric === "birthdays-this-month") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
        date_of_birth: Date;
        age: number;
        birth_day: number;
      }>
    >(Prisma.sql`
      SELECT
        id::text AS id,
        file_number,
        first_name,
        last_name,
        department,
        date_of_birth,
        DATE_PART('year', AGE(CURRENT_DATE, date_of_birth))::int AS age,
        EXTRACT(DAY FROM date_of_birth)::int AS birth_day
      FROM public.employees
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY
        CASE
          WHEN EXTRACT(DAY FROM date_of_birth) >= EXTRACT(DAY FROM CURRENT_DATE) THEN 0
          ELSE 1
        END,
        EXTRACT(DAY FROM date_of_birth)
    `);
    return {
      title: "Birthdays This Month",
      description: "Employees with birthdays in the current month.",
      icon: "cake",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "department", label: "Department" },
        { key: "birthday", label: "Birthday", sortKey: "birthdaySort" },
        { key: "age", label: "Age", sortKey: "age" },
      ],
      rows: rows.map((row) => {
        const dob = row.date_of_birth;
        const birthdaySort = dob.getMonth() * 100 + dob.getDate();
        return {
          fileNumber: row.file_number || "—",
          fullName: `${row.first_name} ${row.last_name}`.trim(),
          department: row.department?.trim() || "—",
          birthday: formatDateLabel(row.date_of_birth.toISOString().slice(0, 10)),
          birthdaySort,
          age: row.age,
          href: `/employees/${row.id}`,
        };
      }),
      emptyMessage: "No birthdays found for this month.",
    };
  }

  if (metric === "contracts-expiring-90-days") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        minute_number: string | null;
        contract_number: string | null;
        first_name: string;
        last_name: string;
        position: string | null;
        start_date: Date;
        end_date: Date;
        status: string | null;
        days_to_expiry: number;
      }>
    >(Prisma.sql`
      SELECT
        c.id::text AS id,
        c.minute_number,
        c.contract_number,
        e.first_name,
        e.last_name,
        e.position,
        c.start_date,
        c.end_date,
        c.status,
        (c.end_date - CURRENT_DATE)::int AS days_to_expiry
      FROM public.contracts c
      JOIN public.employees e
        ON e.id = c.employee_id
      WHERE c.end_date IS NOT NULL
        AND c.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '90 days'
      ORDER BY c.end_date ASC
    `);
    return {
      title: "Contracts Expiring in 90 Days",
      description: "Contracts ending within the next 90 days.",
      icon: "file-clock",
      columns: [
        { key: "minuteNumber", label: "Minute #" },
        { key: "contractNumber", label: "Contract #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "position", label: "Position" },
        { key: "startDate", label: "Start Date", sortKey: "startDateIso" },
        { key: "endDate", label: "End Date", sortKey: "endDateIso" },
        { key: "daysToExpiry", label: "Days to Expiry", sortKey: "sortDaysToExpiry" },
        { key: "status", label: "Status" },
      ],
      rows: rows.map((row) => ({
        minuteNumber: row.minute_number?.trim() || "—",
        contractNumber: row.contract_number?.trim() || "No assigned number",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        position: row.position?.trim() || "—",
        startDate: formatDateLabel(row.start_date.toISOString().slice(0, 10)),
        startDateIso: row.start_date.toISOString().slice(0, 10),
        endDate: formatDateLabel(row.end_date.toISOString().slice(0, 10)),
        endDateIso: row.end_date.toISOString().slice(0, 10),
        daysToExpiry: formatDays(row.days_to_expiry),
        sortDaysToExpiry: row.days_to_expiry,
        status: toStatusCell((row.status ?? "draft").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())),
        href: `/contracts/${row.id}`,
      })),
      emptyMessage: "No contracts are expiring within the next 90 days.",
    };
  }

  if (metric === "employees-with-no-contract") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        work_email: string | null;
        mobile_number: string | null;
      }>
    >(Prisma.sql`
      SELECT
        e.id::text AS id,
        e.file_number,
        e.first_name,
        e.last_name,
        e.department,
        e.position,
        e.work_email,
        e.mobile_number
      FROM public.employees e
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.contracts c
        WHERE c.employee_id = e.id
      )
      ORDER BY e.created_at DESC NULLS LAST, e.updated_at DESC NULLS LAST, e.last_name, e.first_name
    `);
    return {
      title: "Employees With No Contract",
      description: "Employees who do not have any contract record on file.",
      icon: "file-warning",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "workEmail", label: "Work Email" },
        { key: "mobileNumber", label: "Mobile Number" },
      ],
      rows: rows.map((row) => ({
        fileNumber: row.file_number || "—",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        department: row.department?.trim() || "—",
        position: row.position?.trim() || "—",
        workEmail: row.work_email?.trim() || "—",
        mobileNumber: row.mobile_number?.trim() || "—",
        href: `/employees/${row.id}`,
      })),
      emptyMessage: "All employees currently have at least one contract record.",
    };
  }

  const retirementAge = await getConfiguredRetirementAge();

  if (metric === "employees-over-retirement-age") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        date_of_birth: Date;
        age: number;
      }>
    >(Prisma.sql`
      SELECT
        id::text AS id,
        file_number,
        first_name,
        last_name,
        department,
        position,
        date_of_birth,
        DATE_PART('year', AGE(CURRENT_DATE, date_of_birth))::int AS age
      FROM public.employees
      WHERE date_of_birth IS NOT NULL
        AND DATE_PART('year', AGE(CURRENT_DATE, date_of_birth)) >= ${retirementAge}
      ORDER BY age DESC, last_name, first_name
    `);
    return {
      title: "Employees Over Retirement Age",
      description: "Employees who are at or above the configured retirement age.",
      icon: "user-check",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "dateOfBirth", label: "Date of Birth" },
        { key: "age", label: "Age" },
        { key: "retirementAge", label: "Retirement Age" },
      ],
      rows: rows.map((row) => ({
        fileNumber: row.file_number || "—",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        department: row.department?.trim() || "—",
        position: row.position?.trim() || "—",
        dateOfBirth: formatDateLabel(row.date_of_birth.toISOString().slice(0, 10)),
        age: row.age,
        retirementAge,
        href: `/employees/${row.id}`,
      })),
      emptyMessage: "No employees are currently at or above retirement age.",
    };
  }

  if (metric === "retirement-within-one-year") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        department: string | null;
        position: string | null;
        date_of_birth: Date;
      }>
    >(Prisma.sql`
      SELECT
        id::text AS id,
        file_number,
        first_name,
        last_name,
        department,
        position,
        date_of_birth
      FROM public.employees
      WHERE date_of_birth IS NOT NULL
    `);
    const today = new Date();
    const todayDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const nextYear = new Date(todayDate.getFullYear() + 1, todayDate.getMonth(), todayDate.getDate());
    const mapped = rows
      .map((row) => {
        const dob = new Date(row.date_of_birth);
        const retirementDate = new Date(dob.getFullYear() + retirementAge, dob.getMonth(), dob.getDate());
        const retirementDateOnly = new Date(
          retirementDate.getFullYear(),
          retirementDate.getMonth(),
          retirementDate.getDate(),
        );
        const daysUntilRetirement = Math.floor(
          (retirementDateOnly.getTime() - todayDate.getTime()) / (24 * 60 * 60 * 1000),
        );
        return {
          ...row,
          retirementDateOnly,
          daysUntilRetirement,
        };
      })
      .filter((row) => row.retirementDateOnly > todayDate && row.retirementDateOnly <= nextYear)
      .sort((a, b) => a.retirementDateOnly.getTime() - b.retirementDateOnly.getTime());
    return {
      title: "Reaching Retirement Age Within 1 Year",
      description: "Employees who will reach the configured retirement age within one year.",
      icon: "calendar-clock",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "department", label: "Department" },
        { key: "position", label: "Position" },
        { key: "dateOfBirth", label: "Date of Birth" },
        { key: "retirementDate", label: "Retirement Date", sortKey: "retirementDateIso" },
        { key: "daysUntilRetirement", label: "Days Until Retirement", sortKey: "sortDaysUntilRetirement" },
      ],
      rows: mapped.map((row) => ({
        fileNumber: row.file_number || "—",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        department: row.department?.trim() || "—",
        position: row.position?.trim() || "—",
        dateOfBirth: formatDateLabel(row.date_of_birth.toISOString().slice(0, 10)),
        retirementDate: formatDateLabel(row.retirementDateOnly.toISOString().slice(0, 10)),
        retirementDateIso: row.retirementDateOnly.toISOString().slice(0, 10),
        daysUntilRetirement: formatDays(row.daysUntilRetirement),
        sortDaysUntilRetirement: row.daysUntilRetirement,
        href: `/employees/${row.id}`,
      })),
      emptyMessage: "No employees are projected to reach retirement age within one year.",
    };
  }

  if (metric === "contracts-beyond-retirement-cutoff") {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        minute_number: string | null;
        contract_number: string | null;
        end_date: Date;
        status: string | null;
        first_name: string;
        last_name: string;
        date_of_birth: Date;
      }>
    >(Prisma.sql`
      SELECT
        c.id::text AS id,
        c.minute_number,
        c.contract_number,
        c.end_date,
        c.status,
        e.first_name,
        e.last_name,
        e.date_of_birth
      FROM public.contracts c
      JOIN public.employees e
        ON e.id = c.employee_id
      WHERE c.end_date IS NOT NULL
        AND e.date_of_birth IS NOT NULL
    `);
    const mapped = rows
      .map((row) => {
        const dob = new Date(row.date_of_birth);
        const retirementDate = new Date(dob.getFullYear() + retirementAge, dob.getMonth(), dob.getDate());
        const cutoff = new Date(retirementDate.getFullYear(), retirementDate.getMonth(), retirementDate.getDate() - 1);
        const contractEnd = new Date(row.end_date);
        const daysBeyondCutoff = Math.floor((contractEnd.getTime() - cutoff.getTime()) / (24 * 60 * 60 * 1000));
        return { ...row, cutoff, daysBeyondCutoff };
      })
      .filter((row) => row.daysBeyondCutoff > 0)
      .sort((a, b) => b.daysBeyondCutoff - a.daysBeyondCutoff);
    return {
      title: "Contracts Beyond Retirement Cutoff",
      description: "Contracts that extend beyond the employee’s configured retirement cutoff date.",
      icon: "shield-alert",
      columns: [
        { key: "minuteNumber", label: "Minute #" },
        { key: "contractNumber", label: "Contract #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "dateOfBirth", label: "Date of Birth" },
        { key: "retirementCutoffDate", label: "Retirement Cutoff Date", sortKey: "retirementCutoffIso" },
        { key: "contractEndDate", label: "Contract End Date", sortKey: "contractEndIso" },
        { key: "daysBeyondCutoff", label: "Days Beyond Cutoff", sortKey: "sortDaysBeyondCutoff" },
        { key: "status", label: "Status" },
      ],
      rows: mapped.map((row) => ({
        minuteNumber: row.minute_number?.trim() || "—",
        contractNumber: row.contract_number?.trim() || "No assigned number",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        dateOfBirth: formatDateLabel(row.date_of_birth.toISOString().slice(0, 10)),
        retirementCutoffDate: formatDateLabel(row.cutoff.toISOString().slice(0, 10)),
        retirementCutoffIso: row.cutoff.toISOString().slice(0, 10),
        contractEndDate: formatDateLabel(row.end_date.toISOString().slice(0, 10)),
        contractEndIso: row.end_date.toISOString().slice(0, 10),
        daysBeyondCutoff: formatDays(row.daysBeyondCutoff),
        sortDaysBeyondCutoff: row.daysBeyondCutoff,
        status: toStatusCell((row.status ?? "draft").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())),
        href: `/contracts/${row.id}`,
      })),
      emptyMessage: "No contracts currently extend beyond retirement cutoff dates.",
    };
  }

  if (metric === "on-leave-today") {
    const rows = await prisma.$queryRaw<
      Array<{
        leave_transaction_id: string;
        employee_id: string;
        file_number: string;
        first_name: string;
        last_name: string;
        leave_type: string;
        start_date: Date;
        end_date: Date;
        return_to_work_date: Date | null;
        leave_days: number | null;
        status: string;
      }>
    >(Prisma.sql`
      SELECT
        DISTINCT ON (lt.employee_id)
        lt.id::text AS leave_transaction_id,
        e.id::text AS employee_id,
        e.file_number,
        e.first_name,
        e.last_name,
        lt.leave_type,
        lt.start_date,
        lt.end_date,
        lt.return_to_work_date,
        lt.leave_days::numeric::float8 AS leave_days,
        lt.status
      FROM public.leave_transactions lt
      JOIN public.employees e
        ON e.id = lt.employee_id
      WHERE CURRENT_DATE BETWEEN lt.start_date AND lt.end_date
        AND lt.status IN ('recorded', 'approved', 'adjusted')
      ORDER BY lt.employee_id, lt.end_date ASC, lt.start_date ASC
    `);
    return {
      title: "Employees Currently on Leave Today",
      description: "Employees with leave records covering today.",
      icon: "calendar-days",
      columns: [
        { key: "fileNumber", label: "File #" },
        { key: "fullName", label: "First and Last Name" },
        { key: "leaveType", label: "Leave Type" },
        { key: "startDate", label: "Start Date", sortKey: "startDateIso" },
        { key: "endDate", label: "End Date", sortKey: "endDateIso" },
        { key: "returnToWorkDate", label: "Return to Work Date", sortKey: "returnToWorkIso" },
        { key: "daysUsed", label: "Days Used", sortKey: "sortDaysUsed" },
        { key: "status", label: "Status" },
      ],
      rows: rows.map((row) => ({
        fileNumber: row.file_number || "—",
        fullName: `${row.first_name} ${row.last_name}`.trim(),
        leaveType: getLeaveTypeLabel(row.leave_type),
        startDate: formatDateLabel(row.start_date.toISOString().slice(0, 10)),
        startDateIso: row.start_date.toISOString().slice(0, 10),
        endDate: formatDateLabel(row.end_date.toISOString().slice(0, 10)),
        endDateIso: row.end_date.toISOString().slice(0, 10),
        returnToWorkDate: row.return_to_work_date
          ? formatDateLabel(row.return_to_work_date.toISOString().slice(0, 10))
          : "—",
        returnToWorkIso: row.return_to_work_date ? row.return_to_work_date.toISOString().slice(0, 10) : "",
        daysUsed: formatDays(Math.round(Number(row.leave_days ?? 0))),
        sortDaysUsed: Math.round(Number(row.leave_days ?? 0)),
        status: toStatusCell((row.status ?? "recorded").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())),
        href: `/leave/employee/${row.employee_id}`,
      })),
      emptyMessage: "No employees are currently on leave today.",
    };
  }

  if (metric === "most-used-leave-type") {
    const rows = await prisma.$queryRaw<
      Array<{
        leave_type: string;
        total_days_used: number;
        transaction_count: number;
      }>
    >(Prisma.sql`
      SELECT
        leave_type,
        SUM(leave_days)::int AS total_days_used,
        COUNT(*)::int AS transaction_count
      FROM public.leave_transactions
      WHERE status IN ('recorded', 'approved', 'adjusted')
      GROUP BY leave_type
      ORDER BY total_days_used DESC
    `);
    return {
      title: "Most Used Leave Type",
      description: "Leave usage grouped by leave type.",
      icon: "chart",
      columns: [
        { key: "leaveType", label: "Leave Type" },
        { key: "totalDaysUsed", label: "Total Days Used", sortKey: "sortTotalDaysUsed" },
        { key: "transactionCount", label: "Number of Transactions", sortKey: "transactionCount" },
      ],
      rows: rows.map((row) => ({
        leaveType: getLeaveTypeLabel(row.leave_type),
        totalDaysUsed: formatDays(Number(row.total_days_used ?? 0)),
        sortTotalDaysUsed: Number(row.total_days_used ?? 0),
        transactionCount: Number(row.transaction_count ?? 0),
      })),
      emptyMessage: "No leave usage records found yet.",
    };
  }

  const leaveRows = await getLeaveSearchRowsFromDatabase();
  const lowRows = leaveRows.filter(
    (row) => row.status === "Low" || row.status === "Exhausted" || row.status === "Overused",
  );
  const statusRank: Record<string, number> = { Low: 1, Exhausted: 2, Overused: 3 };
  const uniqueByEmployee = new Map<string, (typeof lowRows)[number]>();
  for (const row of lowRows) {
    const existing = uniqueByEmployee.get(row.employeeId);
    if (!existing) {
      uniqueByEmployee.set(row.employeeId, row);
      continue;
    }
    const existingRank = statusRank[existing.status] ?? 0;
    const nextRank = statusRank[row.status] ?? 0;
    if (nextRank > existingRank) {
      uniqueByEmployee.set(row.employeeId, row);
    }
  }
  const dedupedRows = Array.from(uniqueByEmployee.values());
  return {
    title: "Low Leave Balances",
    description: "Employees whose current leave balance is low, exhausted, or overused.",
    icon: "alert",
    columns: [
      { key: "fileNumber", label: "File #" },
      { key: "fullName", label: "First and Last Name" },
      { key: "leaveType", label: "Leave Type" },
      { key: "contractPeriod", label: "Contract Period" },
      { key: "available", label: "Available", sortKey: "sortAvailable" },
      { key: "used", label: "Used", sortKey: "sortUsed" },
      { key: "remaining", label: "Remaining", sortKey: "sortRemaining" },
      { key: "status", label: "Status", sortKey: "sortStatusRank" },
    ],
    rows: dedupedRows.map((row) => ({
      fileNumber: row.fileNumber || "—",
      fullName: row.fullName,
      leaveType: getLeaveTypeLabel(row.leaveType),
      contractPeriod: row.contractPeriod || "—",
      available: row.availableText || "—",
      used: row.usedText || "—",
      remaining: row.remainingText || "—",
      sortAvailable: parseLeaveDaysForSort(row.availableText),
      sortUsed: parseLeaveDaysForSort(row.usedText),
      sortRemaining: parseLeaveDaysForSort(row.remainingText),
      sortStatusRank: statusRank[row.status] ?? 0,
      status: toStatusCell(row.status),
      href: `/leave/employee/${row.employeeId}`,
    })),
    emptyMessage: "No low leave balances found.",
  };
}
