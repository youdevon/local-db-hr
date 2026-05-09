import "server-only";

import { Prisma } from "@prisma/client";

import { getLeaveStatus } from "@/lib/leave-balances";
import { calculateWorkingLeaveDays } from "@/lib/leave-days";
import { formatContractPeriod, formatLeaveDays } from "@/lib/leave";
import { getPublicHolidaySetForRange } from "@/lib/server/public-holidays";
import { generateContractYears } from "@/lib/leave-contract-years";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";
import { getLeaveYearBalances, syncLeaveYearBalances } from "@/lib/server/leave-year-balances";
import type { LeaveSearchRow } from "@/lib/server/leave";

type EmployeeRow = {
  id: string;
  file_number: string;
  first_name: string;
  last_name: string;
};

type ContractRow = {
  id: string;
  employee_id: string;
  start_date: Date;
  end_date: Date;
  vacation_leave_entitlement: number;
  sick_leave_entitlement: number;
};

type LeaveTxRow = {
  id: string;
  employee_id: string;
  contract_id: string | null;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  leave_days: number | null;
  status: string | null;
};

function iso(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isCurrentRange(startDate: string, endDate: string): boolean {
  const now = new Date();
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59`);
  return now >= start && now <= end;
}

function shouldCountStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return normalized === "recorded" || normalized === "approved" || normalized === "adjusted";
}

function pickCurrentOrLatestContract(contracts: ContractRow[]): ContractRow | null {
  if (contracts.length === 0) return null;
  const current = contracts.find((contract) => isCurrentRange(iso(contract.start_date), iso(contract.end_date)));
  if (current) return current;
  return [...contracts].sort((a, b) => b.end_date.getTime() - a.end_date.getTime())[0];
}

function isDateWithinRange(dateIso: string, startIso: string, endIso: string): boolean {
  const date = new Date(`${dateIso}T00:00:00`);
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T23:59:59`);
  return date >= start && date <= end;
}

function transactionBelongsToContract(tx: LeaveTxRow, contract: ContractRow): boolean {
  if (tx.contract_id) return tx.contract_id === contract.id;
  return isDateWithinRange(iso(tx.start_date), iso(contract.start_date), iso(contract.end_date));
}

export async function getLeaveSearchRowsFromDatabase(): Promise<LeaveSearchRow[]> {
  const settings = await getLeaveWarningSettings();
  const [employees, contracts, transactions, ids] = await Promise.all([
    prisma.$queryRaw<EmployeeRow[]>(Prisma.sql`
      SELECT id::text AS id, file_number, first_name, last_name
      FROM public.employees
      ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST, last_name ASC, first_name ASC
    `),
    prisma.$queryRaw<ContractRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        employee_id::text AS employee_id,
        start_date,
        end_date,
        vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
        sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement
      FROM public.contracts
    `),
    prisma.$queryRaw<LeaveTxRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        employee_id::text AS employee_id,
        contract_id::text AS contract_id,
        leave_type,
        start_date,
        end_date,
        leave_days::numeric::float8 AS leave_days,
        status
      FROM public.leave_transactions
    `),
    prisma.$queryRaw<Array<{ employee_id: string; id_number: string }>>(Prisma.sql`
      SELECT employee_id::text AS employee_id, id_number
      FROM public.employee_identifications
    `),
  ]);

  let holidayMin = "";
  let holidayMax = "";
  for (const tx of transactions) {
    const s = iso(tx.start_date);
    const e = iso(tx.end_date);
    if (!holidayMin || s < holidayMin) holidayMin = s;
    if (!holidayMax || e > holidayMax) holidayMax = e;
  }
  const holidaySetAll =
    transactions.length > 0 && holidayMin && holidayMax
      ? await getPublicHolidaySetForRange(holidayMin, holidayMax)
      : new Set<string>();

  function txDays(tx: LeaveTxRow): number {
    const stored = Number(tx.leave_days ?? 0);
    if (Number.isFinite(stored) && stored > 0) return Math.round(stored);
    return calculateWorkingLeaveDays(tx.start_date, tx.end_date, holidaySetAll);
  }

  const contractsByEmployee = new Map<string, ContractRow[]>();
  contracts.forEach((contract) => {
    const list = contractsByEmployee.get(contract.employee_id) ?? [];
    list.push(contract);
    contractsByEmployee.set(contract.employee_id, list);
  });

  const idsByEmployee = new Map<string, string[]>();
  ids.forEach((row) => {
    const list = idsByEmployee.get(row.employee_id) ?? [];
    list.push(row.id_number);
    idsByEmployee.set(row.employee_id, list);
  });

  const rows: LeaveSearchRow[] = [];
  for (const employee of employees) {
    const fullName = `${employee.first_name} ${employee.last_name}`.trim();
    const selectedContract = pickCurrentOrLatestContract(contractsByEmployee.get(employee.id) ?? []);
    if (!selectedContract) continue;

    const years = generateContractYears(iso(selectedContract.start_date), iso(selectedContract.end_date));
    const selectedYear =
      years.find((year) => isCurrentRange(year.startDate, year.endDate)) ??
      years[years.length - 1] ??
      null;
    if (!selectedYear) continue;

    let yearBalances = await getLeaveYearBalances(employee.id, selectedContract.id);
    if (yearBalances.length === 0) {
      await syncLeaveYearBalances(employee.id, selectedContract.id);
      yearBalances = await getLeaveYearBalances(employee.id, selectedContract.id);
    }

    const vacationBalance =
      yearBalances.find(
        (row) => row.leave_type === "vacation" && row.contract_year_number === selectedYear.yearNumber,
      ) ?? null;
    const sickBalance =
      yearBalances.find((row) => row.leave_type === "sick" && row.contract_year_number === selectedYear.yearNumber) ??
      null;

    const yearStart = new Date(`${selectedYear.startDate}T00:00:00`);
    const yearEnd = new Date(`${selectedYear.endDate}T23:59:59`);
    const matchingTx = transactions.filter((tx) => {
      if (tx.employee_id !== employee.id) return false;
      if (!shouldCountStatus(tx.status)) return false;
      if (!transactionBelongsToContract(tx, selectedContract)) return false;
      const txStart = new Date(`${iso(tx.start_date)}T00:00:00`);
      return txStart >= yearStart && txStart <= yearEnd;
    });

    const vacationUsed = matchingTx
      .filter((tx) => tx.leave_type === "vacation")
      .reduce((sum, tx) => sum + txDays(tx), 0);
    const casualUsed = matchingTx
      .filter((tx) => tx.leave_type === "casual")
      .reduce((sum, tx) => sum + txDays(tx), 0);
    const sickUsed = matchingTx
      .filter((tx) => tx.leave_type === "sick")
      .reduce((sum, tx) => sum + txDays(tx), 0);

    const vacationAvailable = Math.round(
      Number(vacationBalance?.entitlement ?? selectedContract.vacation_leave_entitlement) +
        Number(vacationBalance?.rollover_in ?? 0) +
        Number(vacationBalance?.adjustment ?? 0),
    );
    const vacationUsedTotal = Math.round(vacationUsed + casualUsed);
    const vacationRemaining = Math.round(vacationAvailable - vacationUsedTotal);
    const sickAvailable = Math.round(
      Number(sickBalance?.entitlement ?? selectedContract.sick_leave_entitlement) +
        Number(sickBalance?.adjustment ?? 0),
    );
    const sickRemaining = Math.round(sickAvailable - sickUsed);

    if (process.env.NODE_ENV !== "production") {
      console.log("[leave/search]", {
        employee: fullName,
        contractId: selectedContract.id,
        yearRange: `${selectedYear.startDate}..${selectedYear.endDate}`,
        txCount: matchingTx.length,
        vacationUsed: vacationUsedTotal,
        sickUsed,
      });
    }

    rows.push({
      key: `${employee.id}:${selectedContract.id}:vacation`,
      employeeId: employee.id,
      contractId: selectedContract.id,
      leaveType: "vacation",
      fullName,
      fileNumber: employee.file_number,
      contractPeriod: formatContractPeriod(iso(selectedContract.start_date), iso(selectedContract.end_date)),
      availableText: formatLeaveDays(vacationAvailable),
      usedText: formatLeaveDays(vacationUsedTotal),
      remainingText: formatLeaveDays(vacationRemaining),
      status: getLeaveStatus(vacationRemaining, "vacation", settings),
      searchText: [
        employee.first_name,
        employee.last_name,
        fullName,
        employee.file_number,
        "vacation",
        "casual",
        ...(idsByEmployee.get(employee.id) ?? []),
      ]
        .join(" ")
        .toLowerCase(),
    });

    rows.push({
      key: `${employee.id}:${selectedContract.id}:sick`,
      employeeId: employee.id,
      contractId: selectedContract.id,
      leaveType: "sick",
      fullName,
      fileNumber: employee.file_number,
      contractPeriod: formatContractPeriod(iso(selectedContract.start_date), iso(selectedContract.end_date)),
      availableText: formatLeaveDays(sickAvailable),
      usedText: formatLeaveDays(sickUsed),
      remainingText: formatLeaveDays(sickRemaining),
      status: getLeaveStatus(sickRemaining, "sick", settings),
      searchText: [
        employee.first_name,
        employee.last_name,
        fullName,
        employee.file_number,
        "sick",
        ...(idsByEmployee.get(employee.id) ?? []),
      ]
        .join(" ")
        .toLowerCase(),
    });
  }

  return rows;
}
