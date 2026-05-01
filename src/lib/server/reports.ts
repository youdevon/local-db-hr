import "server-only";

import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { getLeaveLowThresholdDays, getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";
import {
  AGE_CONDITION_OPTIONS,
  type EmployeeFilterOption,
  getReportDefinition,
  REPORT_DEFINITIONS,
  REPORT_CATEGORIES,
  type ReportDefinition,
  type ReportResult,
} from "@/lib/reports/report-definitions";
import { getRetirementAgePolicySettings } from "@/lib/retirement-policy-settings";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";

const REPORT_PREVIEW_LIMIT = 100;

type ReportFilterOptions = {
  employees: EmployeeFilterOption[];
  departments: Array<{ label: string; value: string }>;
  positions: Array<{ label: string; value: string }>;
  nationalities: Array<{ label: string; value: string }>;
  genders: Array<{ label: string; value: string }>;
  contractStatuses: Array<{ label: string; value: string }>;
  leaveTypes: Array<{ label: string; value: string }>;
  leaveStatuses: Array<{ label: string; value: string }>;
  roles: Array<{ label: string; value: string }>;
  linkedEmployeeStatuses: Array<{ label: string; value: string }>;
  successOptions: Array<{ label: string; value: string }>;
  auditTypes: Array<{ label: string; value: string }>;
  auditModules: Array<{ label: string; value: string }>;
  ageConditions: Array<{ label: string; value: string }>;
};

function toDateString(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function toDateTimeString(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString();
}

function normalizeLabel(value: string): string {
  return value
    .split("_")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatOptionLabel(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toOptions(rows: Array<{ value: string | null }>) {
  return [
    { label: "All", value: "all" },
    ...rows
      .map((row) => String(row.value ?? "").trim())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b))
      .map((value) => ({ label: formatOptionLabel(value), value })),
  ];
}

async function safeOptions(
  queryName: string,
  loader: () => Promise<Array<{ value: string | null }>>,
) {
  try {
    const rows = await loader();
    return toOptions(rows);
  } catch (error) {
    console.error(`[reports] failed to load ${queryName} options`, error);
    return [{ label: "All", value: "all" }];
  }
}

function ageFromDateOfBirth(dateOfBirth: Date | null | undefined, today = new Date()): number | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  let age = today.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = today.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age;
}

function retirementDate(dateOfBirth: Date, retirementAge: number): Date {
  return new Date(Date.UTC(dateOfBirth.getUTCFullYear() + retirementAge, dateOfBirth.getUTCMonth(), dateOfBirth.getUTCDate()));
}

function daysDiff(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.ceil(ms / 86400000);
}

function normalizeFilterValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "object" && "value" in value) {
    return normalizeFilterValue((value as { value?: unknown }).value);
  }
  return "";
}

function normalizeReportFilters(filters: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, normalizeFilterValue(value)]));
}

function isAllOrEmpty(value: string): boolean {
  return !value || value.toLowerCase() === "all";
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validateDateRange(from: string, to: string, field = "Date"): string | null {
  if (!from || !to) return null;
  if (from > to) return `${field} From cannot be after ${field} To.`;
  return null;
}

function parsePositiveNumber(value: string): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  return num;
}

async function assertReportsAccess() {
  const session = await getSession();
  if (!session.user?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  const role = normalizeUserRole(session.user.role);
  if (!canPerformAction(role, "reports.view")) throw new Error("Unauthorized");
  return role;
}

export async function getReportDefinitions(): Promise<{
  categories: Array<{ id: string; label: string }>;
  reports: ReportDefinition[];
}> {
  const role = await assertReportsAccess();
  const reports = REPORT_DEFINITIONS.filter((item) => {
    if (item.category === "audit" || item.category === "user") return role === "administrator";
    return true;
  });
  return { categories: REPORT_CATEGORIES, reports };
}

export async function getReportFilterOptions(): Promise<ReportFilterOptions> {
  await assertReportsAccess();
  const [employees, departments, positions, nationalities, genders, contractStatuses, leaveTypes, leaveStatuses, auditModules, roles] =
    await Promise.all([
      prisma.employees.findMany({
        select: { id: true, first_name: true, last_name: true, file_number: true, work_email: true, mobile_number: true },
        orderBy: [{ first_name: "asc" }, { last_name: "asc" }],
      }),
      safeOptions("department", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT department AS value FROM public.employees WHERE department IS NOT NULL AND TRIM(department) <> '' ORDER BY department ASC`,
        ),
      ),
      safeOptions("position", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT position AS value FROM public.employees WHERE position IS NOT NULL AND TRIM(position) <> '' ORDER BY position ASC`,
        ),
      ),
      safeOptions("nationality", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT nationality AS value FROM public.employees WHERE nationality IS NOT NULL AND TRIM(nationality) <> '' ORDER BY nationality ASC`,
        ),
      ),
      safeOptions("gender", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT gender AS value FROM public.employees WHERE gender IS NOT NULL AND TRIM(gender) <> '' ORDER BY gender ASC`,
        ),
      ),
      safeOptions("contract status", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT status AS value FROM public.contracts WHERE status IS NOT NULL AND TRIM(status) <> '' ORDER BY status ASC`,
        ),
      ),
      safeOptions("leave type", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT leave_type AS value FROM public.leave_transactions WHERE leave_type IS NOT NULL AND TRIM(leave_type) <> '' ORDER BY leave_type ASC`,
        ),
      ),
      safeOptions("leave status", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT status AS value FROM public.leave_transactions WHERE status IS NOT NULL AND TRIM(status) <> '' ORDER BY status ASC`,
        ),
      ),
      safeOptions("audit module", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT module AS value FROM public.system_audit_logs WHERE module IS NOT NULL AND TRIM(module) <> '' ORDER BY module ASC`,
        ),
      ),
      safeOptions("user role", () =>
        prisma.$queryRaw<Array<{ value: string | null }>>(
          Prisma.sql`SELECT DISTINCT role AS value FROM public.user_profiles WHERE role IS NOT NULL AND TRIM(role) <> '' ORDER BY role ASC`,
        ),
      ),
    ]);

  return {
    employees: employees.map((item) => {
      const fullName = `${item.first_name} ${item.last_name}`.trim();
      const label = [fullName, item.file_number ? `File # ${item.file_number}` : "", item.work_email ?? "", item.mobile_number ?? ""]
        .filter(Boolean)
        .join(" • ");
      const searchText = `${item.first_name} ${item.last_name} ${fullName} ${item.file_number ?? ""} ${item.work_email ?? ""} ${item.mobile_number ?? ""}`.toLowerCase();
      return { label, value: item.id, fullName, fileNumber: item.file_number ?? "", searchText };
    }),
    departments,
    positions,
    nationalities,
    genders,
    contractStatuses,
    leaveTypes,
    leaveStatuses,
    roles,
    linkedEmployeeStatuses: [
      { label: "All", value: "all" },
      { label: "Linked", value: "linked" },
      { label: "Unlinked", value: "unlinked" },
    ],
    successOptions: [
      { label: "All", value: "all" },
      { label: "Success", value: "success" },
      { label: "Failed", value: "failed" },
    ],
    auditTypes: [
      { label: "All", value: "all" },
      { label: "Login", value: "login" },
      { label: "System", value: "system" },
    ],
    auditModules,
    ageConditions: AGE_CONDITION_OPTIONS,
  };
}

export async function runReport(reportType: string, filters: Record<string, unknown>): Promise<ReportResult> {
  const role = await assertReportsAccess();
  const definition = getReportDefinition(reportType);
  if (!definition) throw new Error("Invalid report type.");
  if ((definition.category === "audit" || definition.category === "user") && role !== "administrator") {
    throw new Error("Unauthorized");
  }

  const normalizedFilters = normalizeReportFilters(filters);
  const generatedAt = new Date().toISOString();

  const buildResult = (
    definitionInput: ReportDefinition,
    generatedAtInput: string,
    filtersApplied: Record<string, string>,
    rows: Array<Record<string, string | number>>,
  ): ReportResult => ({
    title: definitionInput.label,
    generatedAt: generatedAtInput,
    filtersApplied,
    columns: definitionInput.columns,
    rows: rows.slice(0, REPORT_PREVIEW_LIMIT),
    totalMatchingRows: rows.length,
    previewLimit: REPORT_PREVIEW_LIMIT,
  });

  try {
    if (["employee-directory", "employees-by-age", "employees-by-department", "employees-by-position", "employees-by-nationality", "employees-by-gender", "employees-over-selected-age", "employees-at-selected-age"].includes(reportType)) {
      const rows = await runEmployeeReport(reportType, normalizedFilters);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (reportType === "employees-with-no-contract") {
      const rows = await runEmployeesWithoutContract();
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (["all-contracts", "contract-history-by-employee", "contracts-expiring-within-days", "contracts-beyond-retirement-cutoff"].includes(reportType)) {
      const rows = await runContractReports(reportType, normalizedFilters);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (["leave-transactions", "current-leave-balances", "low-leave-balances", "employees-currently-on-leave"].includes(reportType)) {
      const rows = await runLeaveReports(reportType, normalizedFilters);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (["employees-over-retirement-age", "employees-reaching-retirement-within-1-year"].includes(reportType)) {
      const rows = await runRetirementReports(reportType);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (reportType === "full-audit-trail") {
      const rows = await runFullAuditTrail(normalizedFilters);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    if (reportType === "user-accounts") {
      const rows = await runUserAccounts(normalizedFilters);
      return buildResult(definition, generatedAt, normalizedFilters, rows);
    }
    throw new Error("Unsupported report type.");
  } catch (error) {
    console.error("[reports] runReport failed", { reportType, normalizedFilters, error });
    throw new Error("Failed to run report.");
  }
}

async function runEmployeeReport(reportType: string, filters: Record<string, string>) {
  const employeeId = filters.employeeId ?? "";
  const department = filters.department ?? "";
  const position = filters.position ?? "";
  const nationality = filters.nationality ?? "";
  const gender = filters.gender ?? "";
  const ageCondition = (filters.ageCondition || "all").toLowerCase();
  const ageValue = parsePositiveNumber(filters.ageValue ?? "");
  const ageFrom = parsePositiveNumber(filters.ageFrom ?? "");
  const ageTo = parsePositiveNumber(filters.ageTo ?? "");

  if (employeeId && !isUuid(employeeId)) throw new Error("Invalid employee selected.");
  if (ageCondition === "between" && ageFrom !== null && ageTo !== null && ageFrom > ageTo) {
    throw new Error("Age From cannot be greater than Age To.");
  }

  const where: Prisma.employeesWhereInput = {
    ...(employeeId ? { id: employeeId } : {}),
    ...(isAllOrEmpty(department) ? {} : { department }),
    ...(isAllOrEmpty(position) ? {} : { position }),
    ...(isAllOrEmpty(nationality) ? {} : { nationality }),
    ...(isAllOrEmpty(gender) ? {} : { gender }),
  };
  const rows = await prisma.employees.findMany({
    where,
    select: {
      file_number: true,
      first_name: true,
      last_name: true,
      department: true,
      position: true,
      gender: true,
      date_of_birth: true,
      nationality: true,
      work_email: true,
      mobile_number: true,
    },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });

  return rows
    .map((item) => {
      const age = ageFromDateOfBirth(item.date_of_birth);
      return {
        fileNumber: item.file_number ?? "—",
        firstName: item.first_name ?? "—",
        lastName: item.last_name ?? "—",
        department: item.department ?? "—",
        position: item.position ?? "—",
        gender: item.gender ?? "—",
        dateOfBirth: toDateString(item.date_of_birth) || "—",
        age: age ?? 0,
        nationality: item.nationality ?? "—",
        workEmail: item.work_email ?? "—",
        mobileNumber: item.mobile_number ?? "—",
      };
    })
    .filter((item) => {
      if (["employees-by-department"].includes(reportType) && item.department !== (department || "—")) return false;
      if (["employees-by-position"].includes(reportType) && item.position !== (position || "—")) return false;
      if (["employees-by-nationality"].includes(reportType) && item.nationality !== (nationality || "—")) return false;
      if (["employees-by-gender"].includes(reportType) && item.gender !== (gender || "—")) return false;

      const age = item.age;
      if (reportType === "employees-over-selected-age") return ageValue !== null && age > ageValue;
      if (reportType === "employees-at-selected-age") return ageValue !== null && age === ageValue;
      if (!["employee-directory", "employees-by-age"].includes(reportType)) return true;

      if (isAllOrEmpty(ageCondition)) return true;
      if (ageCondition === "between") return ageFrom !== null && ageTo !== null && age >= ageFrom && age <= ageTo;
      if (ageValue === null) return true;
      if (ageCondition === "equals") return age === ageValue;
      if (ageCondition === "gt") return age > ageValue;
      if (ageCondition === "gte") return age >= ageValue;
      if (ageCondition === "lt") return age < ageValue;
      if (ageCondition === "lte") return age <= ageValue;
      return true;
    });
}

async function runEmployeesWithoutContract() {
  const rows = await prisma.employees.findMany({
    where: { contracts: { none: {} } },
    select: { file_number: true, first_name: true, last_name: true, department: true, position: true, work_email: true, mobile_number: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });
  return rows.map((item) => ({
    fileNumber: item.file_number ?? "—",
    employee: `${item.first_name} ${item.last_name}`.trim() || "—",
    department: item.department ?? "—",
    position: item.position ?? "—",
    workEmail: item.work_email ?? "—",
    mobileNumber: item.mobile_number ?? "—",
  }));
}

async function runContractReports(reportType: string, filters: Record<string, string>) {
  const employeeId = filters.employeeId ?? "";
  if (employeeId && !isUuid(employeeId)) throw new Error("Invalid employee selected.");
  const startRangeError = validateDateRange(filters.startDateFrom ?? "", filters.startDateTo ?? "", "Start Date");
  if (startRangeError) throw new Error(startRangeError);
  const endRangeError = validateDateRange(filters.endDateFrom ?? "", filters.endDateTo ?? "", "End Date");
  if (endRangeError) throw new Error(endRangeError);

  const contracts = await prisma.contracts.findMany({
    where: {
      ...(employeeId ? { employee_id: employeeId } : {}),
      ...(isAllOrEmpty(filters.contractStatus ?? "") ? {} : { status: filters.contractStatus }),
      ...(filters.startDateFrom || filters.startDateTo
        ? { start_date: { ...(filters.startDateFrom ? { gte: new Date(`${filters.startDateFrom}T00:00:00.000Z`) } : {}), ...(filters.startDateTo ? { lte: new Date(`${filters.startDateTo}T23:59:59.999Z`) } : {}) } }
        : {}),
      ...(filters.endDateFrom || filters.endDateTo
        ? { end_date: { ...(filters.endDateFrom ? { gte: new Date(`${filters.endDateFrom}T00:00:00.000Z`) } : {}), ...(filters.endDateTo ? { lte: new Date(`${filters.endDateTo}T23:59:59.999Z`) } : {}) } }
        : {}),
      employees: {
        ...(isAllOrEmpty(filters.department ?? "") ? {} : { department: filters.department }),
        ...(isAllOrEmpty(filters.position ?? "") ? {} : { position: filters.position }),
      },
    },
    include: { employees: true },
    orderBy: [{ end_date: "asc" }, { start_date: "desc" }],
  });

  const today = new Date();
  if (reportType === "contracts-expiring-within-days") {
    const dayLimit = parsePositiveNumber(filters.expiringWithinDays || "90");
    if (dayLimit === null) throw new Error("Expiring Within Days is required.");
    return contracts
      .map((item) => ({ item, daysToExpiry: daysDiff(today, item.end_date) }))
      .filter((entry) => entry.daysToExpiry >= 0 && entry.daysToExpiry <= dayLimit)
      .sort((a, b) => a.daysToExpiry - b.daysToExpiry)
      .map(({ item, daysToExpiry }) => ({
        minuteNumber: item.minute_number ?? "—",
        contractNumber: item.contract_number ?? "—",
        fileNumber: item.employees.file_number ?? "—",
        employee: `${item.employees.first_name} ${item.employees.last_name}`.trim(),
        position: item.employees.position ?? "—",
        endDate: toDateString(item.end_date),
        daysToExpiry,
        status: normalizeLabel(item.status),
      }));
  }

  if (reportType === "contracts-beyond-retirement-cutoff") {
    const retirementPolicy = await getRetirementAgePolicySettings();
    return contracts
      .filter((item) => !!item.employees.date_of_birth)
      .map((item) => {
        const dob = item.employees.date_of_birth as Date;
        const cutoff = retirementDate(dob, retirementPolicy.retirementAge);
        const beyond = daysDiff(cutoff, item.end_date);
        return { item, cutoff, beyond };
      })
      .filter((entry) => entry.beyond > 0)
      .map(({ item, cutoff, beyond }) => ({
        minuteNumber: item.minute_number ?? "—",
        contractNumber: item.contract_number ?? "—",
        employee: `${item.employees.first_name} ${item.employees.last_name}`.trim(),
        dateOfBirth: toDateString(item.employees.date_of_birth),
        retirementCutoffDate: toDateString(cutoff),
        contractEndDate: toDateString(item.end_date),
        daysBeyondCutoff: beyond,
        status: normalizeLabel(item.status),
      }));
  }

  const mapped = contracts.map((item) => ({
    minuteNumber: item.minute_number ?? "—",
    contractNumber: item.contract_number ?? "—",
    fileNumber: item.employees.file_number ?? "—",
    employee: `${item.employees.first_name} ${item.employees.last_name}`.trim(),
    department: item.employees.department ?? "—",
    position: item.employees.position ?? "—",
    startDate: toDateString(item.start_date),
    endDate: toDateString(item.end_date),
    salary: Number(item.salary),
    gratuity: Number(item.gratuity),
    status: normalizeLabel(item.status),
    sortStartDate: toDateString(item.start_date),
  }));

  if (reportType === "contract-history-by-employee") {
    return mapped
      .sort((a, b) => b.sortStartDate.localeCompare(a.sortStartDate))
      .map((item) => {
        const { sortStartDate: _unused, ...rest } = item;
        return rest;
      });
  }
  return mapped.map((item) => {
    const { sortStartDate: _unused, ...rest } = item;
    return rest;
  });
}

async function runLeaveReports(reportType: string, filters: Record<string, string>) {
  if (filters.employeeId && !isUuid(filters.employeeId)) throw new Error("Invalid employee selected.");
  const startRangeError = validateDateRange(filters.startDateFrom ?? "", filters.startDateTo ?? "", "Start Date");
  if (startRangeError) throw new Error(startRangeError);
  const endRangeError = validateDateRange(filters.endDateFrom ?? "", filters.endDateTo ?? "", "End Date");
  if (endRangeError) throw new Error(endRangeError);

  if (reportType === "leave-transactions" || reportType === "employees-currently-on-leave") {
    const rows = await prisma.leave_transactions.findMany({
      where: {
        ...(isAllOrEmpty(filters.leaveType ?? "") ? {} : { leave_type: filters.leaveType }),
        ...(isAllOrEmpty(filters.leaveStatus ?? "") ? {} : { status: filters.leaveStatus }),
        ...(filters.startDateFrom || filters.startDateTo
          ? { start_date: { ...(filters.startDateFrom ? { gte: new Date(`${filters.startDateFrom}T00:00:00.000Z`) } : {}), ...(filters.startDateTo ? { lte: new Date(`${filters.startDateTo}T23:59:59.999Z`) } : {}) } }
          : {}),
        ...(filters.endDateFrom || filters.endDateTo
          ? { end_date: { ...(filters.endDateFrom ? { gte: new Date(`${filters.endDateFrom}T00:00:00.000Z`) } : {}), ...(filters.endDateTo ? { lte: new Date(`${filters.endDateTo}T23:59:59.999Z`) } : {}) } }
          : {}),
        employees: {
          ...(filters.employeeId ? { id: filters.employeeId } : {}),
          ...(isAllOrEmpty(filters.department ?? "") ? {} : { department: filters.department }),
          ...(isAllOrEmpty(filters.position ?? "") ? {} : { position: filters.position }),
        },
      },
      include: { employees: true },
      orderBy: [{ start_date: "desc" }],
    });
    const today = new Date();
    return rows
      .filter((item) => (reportType === "employees-currently-on-leave" ? item.start_date <= today && item.end_date >= today : true))
      .map((item) => ({
        fileNumber: item.employees.file_number ?? "—",
        employee: `${item.employees.first_name} ${item.employees.last_name}`.trim(),
        department: item.employees.department ?? "—",
        position: item.employees.position ?? "—",
        leaveType: normalizeLabel(item.leave_type),
        startDate: toDateString(item.start_date),
        endDate: toDateString(item.end_date),
        returnToWorkDate: toDateString(item.return_to_work_date),
        daysUsed: Number(item.leave_days),
        ...(reportType === "leave-transactions" ? { status: normalizeLabel(item.status) } : {}),
      }));
  }

  const balances = await prisma.leave_year_balances.findMany({
    where: {
      employees: {
        ...(filters.employeeId ? { id: filters.employeeId } : {}),
        ...(isAllOrEmpty(filters.department ?? "") ? {} : { department: filters.department }),
        ...(isAllOrEmpty(filters.position ?? "") ? {} : { position: filters.position }),
      },
    },
    include: { employees: true, contracts: true },
    orderBy: [{ year_start_date: "desc" }, { leave_type: "asc" }],
  });
  const warning = await getLeaveWarningSettings();

  return balances
    .map((item) => {
      const remaining = Number(item.remaining);
      let status = "Healthy";
      if (remaining < 0) status = "Overused";
      else if (remaining === 0) status = "Exhausted";
      else {
        const threshold = getLeaveLowThresholdDays(warning, item.leave_type);
        if (remaining <= threshold) status = "Low";
      }
      return {
        fileNumber: item.employees.file_number ?? "—",
        employee: `${item.employees.first_name} ${item.employees.last_name}`.trim(),
        department: item.employees.department ?? "—",
        position: item.employees.position ?? "—",
        contractPeriod: `${toDateString(item.contracts.start_date)} to ${toDateString(item.contracts.end_date)}`,
        leaveType: normalizeLabel(item.leave_type),
        entitlement: Number(item.entitlement),
        used: Number(item.used),
        remaining,
        status,
      };
    })
    .filter((item) => (reportType === "low-leave-balances" ? ["Low", "Exhausted", "Overused"].includes(item.status) : true));
}

async function runRetirementReports(reportType: string) {
  const policy = await getRetirementAgePolicySettings();
  const today = new Date();
  const rows = await prisma.employees.findMany({
    where: { date_of_birth: { not: null } },
    select: { file_number: true, first_name: true, last_name: true, department: true, position: true, date_of_birth: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
  });
  return rows
    .map((item) => {
      const dob = item.date_of_birth as Date;
      const age = ageFromDateOfBirth(dob, today) ?? 0;
      const retirement = retirementDate(dob, policy.retirementAge);
      return {
        fileNumber: item.file_number ?? "—",
        employee: `${item.first_name} ${item.last_name}`.trim(),
        department: item.department ?? "—",
        position: item.position ?? "—",
        dateOfBirth: toDateString(item.date_of_birth),
        age,
        retirementAge: policy.retirementAge,
        retirementDate: toDateString(retirement),
        daysUntilRetirement: daysDiff(today, retirement),
      };
    })
    .filter((item) => {
      if (reportType === "employees-over-retirement-age") return item.age >= policy.retirementAge;
      return item.daysUntilRetirement >= 0 && item.daysUntilRetirement <= 365;
    });
}

async function runFullAuditTrail(filters: Record<string, string>) {
  const rangeError = validateDateRange(filters.dateFrom ?? "", filters.dateTo ?? "");
  if (rangeError) throw new Error(rangeError);
  const [loginRows, systemRows] = await Promise.all([
    prisma.loginAuditLog.findMany({
      where: {
        ...(filters.dateFrom || filters.dateTo
          ? { created_at: { ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}), ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}) } }
          : {}),
      },
      include: { user: { include: { profile: true } } },
      orderBy: { created_at: "desc" },
      take: 5000,
    }),
    prisma.systemAuditLog.findMany({
      where: {
        ...(isAllOrEmpty(filters.module ?? "") ? {} : { module: filters.module }),
        ...(filters.action ? { action: { contains: filters.action, mode: "insensitive" } } : {}),
        ...(filters.dateFrom || filters.dateTo
          ? { created_at: { ...(filters.dateFrom ? { gte: new Date(`${filters.dateFrom}T00:00:00.000Z`) } : {}), ...(filters.dateTo ? { lte: new Date(`${filters.dateTo}T23:59:59.999Z`) } : {}) } }
          : {}),
      },
      include: { actor: { include: { profile: true } } },
      orderBy: { created_at: "desc" },
      take: 5000,
    }),
  ]);

  const rows = [
    ...loginRows.map((item) => ({
      dateTime: toDateTimeString(item.created_at),
      auditType: "Login",
      whoAttemptedIt: item.user?.profile?.full_name || item.email_attempted || "Unknown",
      action: normalizeLabel(item.action),
      target: item.email_attempted ?? "—",
      module: "Authentication",
      success: item.success ? "Success" : "Failed",
      failureReason: item.failure_reason ?? "—",
      ipAddress: item.ip_address ?? "—",
      deviceName: item.device_name ?? "—",
    })),
    ...systemRows.map((item) => ({
      dateTime: toDateTimeString(item.created_at),
      auditType: "System",
      whoAttemptedIt: item.actor_name || item.actor_email || "Unknown",
      action: normalizeLabel(item.action),
      target: item.target_label || item.target_type || "—",
      module: normalizeLabel(item.module),
      success: item.success ? "Success" : "Failed",
      failureReason: item.failure_reason ?? "—",
      ipAddress: item.ip_address ?? "—",
      deviceName: item.device_name ?? "—",
    })),
  ];

  return rows
    .filter((item) => (isAllOrEmpty(filters.auditType ?? "") ? true : item.auditType.toLowerCase() === filters.auditType.toLowerCase()))
    .filter((item) => (isAllOrEmpty(filters.success ?? "") ? true : (filters.success === "success" ? item.success === "Success" : item.success === "Failed")))
    .filter((item) => (filters.actorUser ? item.whoAttemptedIt.toLowerCase().includes(filters.actorUser.toLowerCase()) : true))
    .sort((a, b) => b.dateTime.localeCompare(a.dateTime));
}

async function runUserAccounts(filters: Record<string, string>) {
  const rows = await prisma.user.findMany({
    include: { profile: { include: { employees: true } } },
    orderBy: { created_at: "desc" },
  });
  return rows
    .map((item) => {
      const role = normalizeUserRole(item.profile?.role);
      const linkedEmployee = item.profile?.employees
        ? `${item.profile.employees.first_name} ${item.profile.employees.last_name}`.trim()
        : "—";
      return {
        name: item.profile?.full_name ?? "—",
        email: item.email,
        role: normalizeLabel(role),
        department: item.profile?.department ?? "—",
        linkedEmployee,
        status: item.is_active ? "Active" : "Inactive",
        createdAt: toDateTimeString(item.created_at),
        lastLoginIp: item.last_login_ip ?? "—",
        lastLoginDevice: item.last_login_device ?? "—",
      };
    })
    .filter((item) => (isAllOrEmpty(filters.role ?? "") ? true : item.role.toLowerCase() === filters.role.toLowerCase()))
    .filter((item) => {
      if (isAllOrEmpty(filters.linkedEmployeeStatus ?? "")) return true;
      if (filters.linkedEmployeeStatus === "linked") return item.linkedEmployee !== "—";
      if (filters.linkedEmployeeStatus === "unlinked") return item.linkedEmployee === "—";
      return true;
    });
}
