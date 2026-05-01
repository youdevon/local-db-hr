import "server-only";

import { Prisma } from "@prisma/client";

import {
  getLeaveEntitlementForContract,
  getLeaveStatus,
} from "@/lib/leave-balances";
import {
  formatContractPeriod,
  formatDays,
  formatDateLabel,
  getLeaveTypeLabel,
  type LeaveType,
} from "@/lib/leave";
import { generateContractYears } from "@/lib/leave-contract-years";
import { ensureLeaveInfrastructure } from "@/lib/leave-infrastructure";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";
import { getLeaveYearBalances, syncLeaveYearBalances } from "@/lib/server/leave-year-balances";

type ContractRow = {
  id: string;
  employee_id: string;
  contract_number: string | null;
  minute_number: string | null;
  start_date: Date;
  end_date: Date;
  status: string | null;
  vacation_leave_entitlement: number;
  sick_leave_entitlement: number;
};

type EmployeeRow = {
  id: string;
  file_number: string;
  first_name: string;
  last_name: string;
  department: string | null;
  position: string | null;
  mobile_number: string | null;
  personal_email: string | null;
  work_email: string | null;
};

type LeaveTxRow = {
  id: string;
  employee_id: string;
  contract_id: string | null;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  return_to_work_date: Date;
  leave_days: number;
  status: string;
  notes: string | null;
};

export type LeaveSearchRow = {
  key: string;
  employeeId: string;
  contractId: string | null;
  leaveType: string;
  fullName: string;
  fileNumber: string;
  contractPeriod: string;
  availableText: string;
  usedText: string;
  remainingText: string;
  status: "Healthy" | "Low" | "Exhausted" | "Overused";
  searchText: string;
};

export type LeaveEmployeeOption = {
  id: string;
  fullName: string;
  fileNumber: string;
  department: string;
  position: string;
  mobileNumber: string;
  personalEmail: string;
  workEmail: string;
  idNumbers: string[];
  currentContract: {
    id: string;
    contractNumber: string | null;
    minuteNumber: string | null;
    startDate: string;
    endDate: string;
    status: string;
    vacationLeaveEntitlement: number;
    sickLeaveEntitlement: number;
  } | null;
  contracts: Array<{
    id: string;
    contractNumber: string | null;
    minuteNumber: string | null;
    startDate: string;
    endDate: string;
    status: string;
    vacationLeaveEntitlement: number;
    sickLeaveEntitlement: number;
  }>;
  usedByLeaveType: Partial<Record<LeaveType, number>>;
  searchText: string;
};

export type LeaveDetailData = {
  employee: {
    id: string;
    fullName: string;
    fileNumber: string;
    department: string;
    position: string;
  };
  latestContractStatus: string;
  latestContractPeriod: string;
  currentContractId: string | null;
  contracts: Array<{
    contractId: string;
    minuteNumber: string;
    contractNumber: string;
    contractPeriod: string;
    status: string;
    years: Array<{
      yearNumber: number;
      startDate: string;
      endDate: string;
      vacation: {
        balanceId: string;
        entitlement: string;
        rolloverIn: string;
        adjustment: string;
        usedVacation: string;
        usedCasual: string;
        usedTotal: string;
        remaining: string;
        status: "Healthy" | "Low" | "Exhausted" | "Overused";
        locked: boolean;
      };
      sick: {
        balanceId: string;
        entitlement: string;
        rolloverIn: string;
        adjustment: string;
        used: string;
        remaining: string;
        status: "Healthy" | "Low" | "Exhausted" | "Overused";
        locked: boolean;
      };
    }>;
  }>;
  transactions: Array<{
    id: string;
    leaveType: string;
    startDate: string;
    endDate: string;
    returnToWorkDate: string;
    daysUsed: string;
    contractPeriod: string;
    status: string;
    notes: string;
    /** ISO dates / numeric fields for client-side table sorting only */
    _sortStartIso: string;
    _sortEndIso: string;
    _sortReturnIso: string;
    _sortDays: number;
  }>;
};

export type LeaveTransactionListRow = LeaveDetailData["transactions"][number] & {
  employeeId: string;
};

export type LeaveTransactionEditData = {
  id: string;
  employeeId: string;
  employeeName: string;
  fileNumber: string;
  position: string;
  contractId: string | null;
  contractPeriod: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  returnToWorkDate: string;
  leaveDays: number;
  status: "recorded" | "approved" | "cancelled" | "rejected" | "adjusted";
  notes: string;
};

function isoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function normalizeStatus(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  return raw.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function getCurrentOrLatestContract(contracts: ContractRow[]): ContractRow | null {
  if (contracts.length === 0) return null;
  const now = new Date();
  const current = contracts.find((contract) => {
    const start = new Date(`${isoDate(contract.start_date)}T00:00:00`);
    const end = new Date(`${isoDate(contract.end_date)}T23:59:59`);
    return now >= start && now <= end;
  });
  return current ?? contracts[0];
}

function isCurrentPeriod(startIso: string, endIso: string, now = new Date()): boolean {
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T23:59:59`);
  return now >= start && now <= end;
}

function sortContractsCurrentFirst(contracts: ContractRow[]): ContractRow[] {
  const now = new Date();
  return [...contracts].sort((a, b) => {
    const aStart = isoDate(a.start_date);
    const aEnd = isoDate(a.end_date);
    const bStart = isoDate(b.start_date);
    const bEnd = isoDate(b.end_date);
    const aCurrent = isCurrentPeriod(aStart, aEnd, now);
    const bCurrent = isCurrentPeriod(bStart, bEnd, now);
    if (aCurrent && bCurrent) return b.start_date.getTime() - a.start_date.getTime();
    if (aCurrent) return -1;
    if (bCurrent) return 1;
    const aFuture = new Date(`${aStart}T00:00:00`) > now;
    const bFuture = new Date(`${bStart}T00:00:00`) > now;
    if (aFuture && bFuture) return a.start_date.getTime() - b.start_date.getTime();
    if (aFuture) return -1;
    if (bFuture) return 1;
    return b.end_date.getTime() - a.end_date.getTime();
  });
}

function sortContractYearsCurrentFirst<T extends { startDate: string; endDate: string }>(years: T[]): T[] {
  const now = new Date();
  return [...years].sort((a, b) => {
    const aCurrent = isCurrentPeriod(a.startDate, a.endDate, now);
    const bCurrent = isCurrentPeriod(b.startDate, b.endDate, now);
    if (aCurrent && bCurrent) return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    if (aCurrent) return -1;
    if (bCurrent) return 1;
    const aFuture = new Date(`${a.startDate}T00:00:00`) > now;
    const bFuture = new Date(`${b.startDate}T00:00:00`) > now;
    if (aFuture && bFuture) return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    if (aFuture) return -1;
    if (bFuture) return 1;
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });
}

function shouldCountLeaveStatus(status: string | null | undefined): boolean {
  if (!status) return true;
  const normalized = status.trim().toLowerCase();
  return normalized === "recorded" || normalized === "approved" || normalized === "adjusted";
}

function isDateWithinRange(dateIso: string, startIso: string, endIso: string): boolean {
  const date = new Date(`${dateIso}T00:00:00`);
  const start = new Date(`${startIso}T00:00:00`);
  const end = new Date(`${endIso}T23:59:59`);
  return date >= start && date <= end;
}

function transactionMatchesContractByDate(tx: LeaveTxRow, contract: ContractRow): boolean {
  if (tx.contract_id) return tx.contract_id === contract.id;
  const txStartIso = isoDate(tx.start_date);
  return isDateWithinRange(txStartIso, isoDate(contract.start_date), isoDate(contract.end_date));
}

function resolveContractForTransaction(tx: LeaveTxRow, contracts: ContractRow[]): ContractRow | null {
  if (tx.contract_id) {
    return contracts.find((contract) => contract.id === tx.contract_id) ?? null;
  }
  const txStartIso = isoDate(tx.start_date);
  return (
    contracts.find((contract) =>
      isDateWithinRange(txStartIso, isoDate(contract.start_date), isoDate(contract.end_date)),
    ) ?? null
  );
}

function getVacationCasualUsed(transactions: LeaveTxRow[]): { vacationUsed: number; casualUsed: number; totalUsed: number } {
  const vacationUsed = Number(
    transactions
      .filter((tx) => tx.leave_type === "vacation")
      .reduce((total, tx) => total + Number(tx.leave_days), 0)
      .toFixed(2),
  );
  const casualUsed = Number(
    transactions
      .filter((tx) => tx.leave_type === "casual")
      .reduce((total, tx) => total + Number(tx.leave_days), 0)
      .toFixed(2),
  );
  return {
    vacationUsed,
    casualUsed,
    totalUsed: Number((vacationUsed + casualUsed).toFixed(2)),
  };
}

function getLiveUsedLeaveForContractYear(transactions: LeaveTxRow[], leaveType: string): number {
  return Number(
    transactions
      .filter((tx) => tx.leave_type === leaveType)
      .reduce((sum, tx) => sum + Number(tx.leave_days), 0)
      .toFixed(2),
  );
}

function calculateLiveLeaveBalance(input: {
  entitlement: number;
  rolloverIn: number;
  adjustment: number;
  used: number;
  leaveType: string;
}): { available: number; remaining: number } {
  const available =
    input.leaveType === "vacation"
      ? Number((input.entitlement + input.rolloverIn + input.adjustment).toFixed(2))
      : Number((input.entitlement + input.adjustment).toFixed(2));
  return {
    available,
    remaining: Number((available - input.used).toFixed(2)),
  };
}

function keyFor(employeeId: string, contractId: string | null, leaveType: string): string {
  return `${employeeId}:${contractId ?? "none"}:${leaveType}`;
}

export async function getLeaveSearchRows(): Promise<LeaveSearchRow[]> {
  await ensureLeaveInfrastructure();
  const settings = await getLeaveWarningSettings();

  try {
    const [employees, contracts, transactions, ids] = await Promise.all([
      prisma.$queryRaw<EmployeeRow[]>(Prisma.sql`
        SELECT id::text AS id, file_number, first_name, last_name, department, position, mobile_number, personal_email, work_email
        FROM public.employees
      `),
      prisma.$queryRaw<ContractRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_number,
          minute_number,
          start_date,
          end_date,
          status,
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
          return_to_work_date,
          leave_days::numeric::float8 AS leave_days,
          status,
          notes
        FROM public.leave_transactions
        WHERE status <> 'cancelled'
      `),
      prisma.$queryRaw<Array<{ employee_id: string; id_number: string }>>(Prisma.sql`
        SELECT employee_id::text AS employee_id, id_number
        FROM public.employee_identifications
      `),
    ]);

    const contractsByEmployee = new Map<string, ContractRow[]>();
    contracts.forEach((contract) => {
      const group = contractsByEmployee.get(contract.employee_id) ?? [];
      group.push(contract);
      contractsByEmployee.set(contract.employee_id, group);
    });
    contractsByEmployee.forEach((group) =>
      group.sort((a, b) => b.end_date.getTime() - a.end_date.getTime()),
    );

    const activeTransactions = transactions.filter((tx) => shouldCountLeaveStatus(tx.status));

    const idNumbersByEmployee = new Map<string, string[]>();
    ids.forEach((row) => {
      const list = idNumbersByEmployee.get(row.employee_id) ?? [];
      list.push(row.id_number ?? "");
      idNumbersByEmployee.set(row.employee_id, list);
    });

    const rows: LeaveSearchRow[] = [];
    for (const employee of employees) {
      const employeeContracts = contractsByEmployee.get(employee.id) ?? [];
      const contract = getCurrentOrLatestContract(employeeContracts);
      if (!contract) continue;

      const leaveTypes = new Set<string>(["vacation", "sick"]);
      activeTransactions
        .filter((tx) => tx.employee_id === employee.id && transactionMatchesContractByDate(tx, contract))
        .forEach((tx) => {
          if (tx.leave_type === "casual" || tx.leave_type === "vacation" || tx.leave_type === "sick") return;
          leaveTypes.add(tx.leave_type);
        });

      let balanceRows = await getLeaveYearBalances(employee.id, contract.id);
      if (balanceRows.length === 0) {
        await syncLeaveYearBalances(employee.id, contract.id);
        balanceRows = await getLeaveYearBalances(employee.id, contract.id);
      }
      const now = new Date();
      const contractYears = generateContractYears(isoDate(contract.start_date), isoDate(contract.end_date));
      const currentYearRange =
        contractYears.find((year) => isCurrentPeriod(year.startDate, year.endDate, now)) ??
        contractYears[contractYears.length - 1] ??
        null;
      const txInYear = activeTransactions.filter((tx) => {
        if (tx.employee_id !== employee.id || !currentYearRange) return false;
        if (!transactionMatchesContractByDate(tx, contract)) return false;
        const txStart = new Date(`${isoDate(tx.start_date)}T00:00:00`);
        const yearStart = new Date(`${currentYearRange.startDate}T00:00:00`);
        const yearEnd = new Date(`${currentYearRange.endDate}T23:59:59`);
        return txStart >= yearStart && txStart <= yearEnd;
      });

      for (const leaveType of leaveTypes) {
        const isContractEntitledType = leaveType === "vacation" || leaveType === "sick";
        let entitlement = getLeaveEntitlementForContract(contract, leaveType) ?? 0;
        let used = 0;
        let remaining = 0;
        if (isContractEntitledType) {
          const currentYear = balanceRows.find((row) => {
            const start = new Date(`${isoDate(row.year_start_date)}T00:00:00`);
            const end = new Date(`${isoDate(row.year_end_date)}T23:59:59`);
            return row.leave_type === leaveType && now >= start && now <= end;
          }) ?? balanceRows.filter((row) => row.leave_type === leaveType).sort((a, b) => b.contract_year_number - a.contract_year_number)[0];
          const rolloverIn = leaveType === "vacation" ? Number(currentYear?.rollover_in ?? 0) : 0;
          const adjustment = Number(currentYear?.adjustment ?? 0);
          entitlement = Number(((Number(currentYear?.entitlement ?? entitlement) + rolloverIn + adjustment)).toFixed(2));
          used =
            leaveType === "vacation"
              ? getVacationCasualUsed(txInYear).totalUsed
              : getLiveUsedLeaveForContractYear(txInYear, "sick");
          remaining = Number((entitlement - used).toFixed(2));
        } else {
          used = getLiveUsedLeaveForContractYear(txInYear, leaveType);
          remaining = Number((0 - used).toFixed(2));
        }
        const status = getLeaveStatus(remaining, leaveType, settings);
        const fullName = `${employee.first_name} ${employee.last_name}`.trim();
        rows.push({
          key: keyFor(employee.id, contract.id, leaveType),
          employeeId: employee.id,
          contractId: contract.id,
          leaveType,
          fullName,
          fileNumber: employee.file_number,
          contractPeriod: formatContractPeriod(isoDate(contract.start_date), isoDate(contract.end_date)),
          availableText: isContractEntitledType ? formatDays(entitlement) : "—",
          usedText: isContractEntitledType ? formatDays(used) : "—",
          remainingText: isContractEntitledType ? formatDays(remaining) : "—",
          status,
          searchText: [
            employee.first_name,
            employee.last_name,
            fullName,
            employee.file_number,
            getLeaveTypeLabel(leaveType),
            leaveType,
            ...(idNumbersByEmployee.get(employee.id) ?? []),
          ]
            .join(" ")
            .toLowerCase(),
        });
      }
    }

    return rows.sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch {
    return [];
  }
}

export async function getLeaveEmployeeOptions(): Promise<LeaveEmployeeOption[]> {
  await ensureLeaveInfrastructure();
  try {
    const [employees, contracts, transactions, ids] = await Promise.all([
      prisma.$queryRaw<EmployeeRow[]>(Prisma.sql`
        SELECT id::text AS id, file_number, first_name, last_name, department, position, mobile_number, personal_email, work_email
        FROM public.employees
      `),
      prisma.$queryRaw<ContractRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_number,
          minute_number,
          start_date,
          end_date,
          status,
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
          return_to_work_date,
          leave_days::numeric::float8 AS leave_days,
          status,
          notes
        FROM public.leave_transactions
        WHERE status <> 'cancelled'
      `),
      prisma.$queryRaw<Array<{ employee_id: string; id_number: string }>>(Prisma.sql`
        SELECT employee_id::text AS employee_id, id_number
        FROM public.employee_identifications
      `),
    ]);

    const contractsByEmployee = new Map<string, ContractRow[]>();
    contracts.forEach((contract) => {
      const group = contractsByEmployee.get(contract.employee_id) ?? [];
      group.push(contract);
      contractsByEmployee.set(contract.employee_id, group);
    });
    contractsByEmployee.forEach((group) =>
      group.sort((a, b) => b.end_date.getTime() - a.end_date.getTime()),
    );

    const idsByEmployee = new Map<string, string[]>();
    ids.forEach((row) => {
      const list = idsByEmployee.get(row.employee_id) ?? [];
      list.push(row.id_number);
      idsByEmployee.set(row.employee_id, list);
    });

    const usedMap = new Map<string, number>();
    transactions.filter((tx) => shouldCountLeaveStatus(tx.status)).forEach((tx) => {
      const key = keyFor(tx.employee_id, tx.contract_id, tx.leave_type);
      usedMap.set(key, Number(((usedMap.get(key) ?? 0) + Number(tx.leave_days ?? 0)).toFixed(2)));
    });

    return employees
      .map((employee) => {
        const fullName = `${employee.first_name} ${employee.last_name}`.trim();
        const latestContract = getCurrentOrLatestContract(contractsByEmployee.get(employee.id) ?? []);
        const usedByLeaveType: Partial<Record<LeaveType, number>> = {};

        if (latestContract) {
          ([
            "sick",
            "vacation",
            "maternity",
            "paternity",
            "extended",
            "casual",
            "compassionate",
            "study",
            "no_pay",
            "other",
          ] as LeaveType[]).forEach((leaveType) => {
            const used = usedMap.get(keyFor(employee.id, latestContract.id, leaveType)) ?? 0;
            usedByLeaveType[leaveType] = Number(used.toFixed(2));
          });
        }

        return {
          id: employee.id,
          fullName,
          fileNumber: employee.file_number,
          department: employee.department ?? "—",
          position: employee.position ?? "—",
          mobileNumber: employee.mobile_number ?? "",
          personalEmail: employee.personal_email ?? "",
          workEmail: employee.work_email ?? "",
          idNumbers: idsByEmployee.get(employee.id) ?? [],
          currentContract: latestContract
            ? {
                id: latestContract.id,
                contractNumber: latestContract.contract_number,
                minuteNumber: latestContract.minute_number,
                startDate: isoDate(latestContract.start_date),
                endDate: isoDate(latestContract.end_date),
                status: normalizeStatus(latestContract.status),
                vacationLeaveEntitlement: Number(latestContract.vacation_leave_entitlement ?? 0),
                sickLeaveEntitlement: Number(latestContract.sick_leave_entitlement ?? 0),
              }
            : null,
          contracts: (contractsByEmployee.get(employee.id) ?? [])
            .sort((a, b) => {
              const byEnd = b.end_date.getTime() - a.end_date.getTime();
              if (byEnd !== 0) return byEnd;
              return b.start_date.getTime() - a.start_date.getTime();
            })
            .map((contract) => ({
              id: contract.id,
              contractNumber: contract.contract_number,
              minuteNumber: contract.minute_number,
              startDate: isoDate(contract.start_date),
              endDate: isoDate(contract.end_date),
              status: normalizeStatus(contract.status),
              vacationLeaveEntitlement: Number(contract.vacation_leave_entitlement ?? 0),
              sickLeaveEntitlement: Number(contract.sick_leave_entitlement ?? 0),
            })),
          usedByLeaveType,
          searchText: [
            employee.first_name,
            employee.last_name,
            fullName,
            employee.file_number,
            employee.mobile_number ?? "",
            employee.personal_email ?? "",
            employee.work_email ?? "",
            ...(idsByEmployee.get(employee.id) ?? []),
          ]
            .join(" ")
            .toLowerCase(),
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  } catch {
    return [];
  }
}

export async function getLeaveDetailByEmployee(employeeId: string): Promise<LeaveDetailData | null> {
  await ensureLeaveInfrastructure();
  const settings = await getLeaveWarningSettings();
  try {
    const [employeeRows, contracts, transactions] = await Promise.all([
      prisma.$queryRaw<EmployeeRow[]>(Prisma.sql`
        SELECT id::text AS id, file_number, first_name, last_name, department, position, mobile_number, personal_email, work_email
        FROM public.employees
        WHERE id::text = ${employeeId}
        LIMIT 1
      `),
      prisma.$queryRaw<ContractRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_number,
          minute_number,
          start_date,
          end_date,
          status,
          vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
          sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement
        FROM public.contracts
        WHERE employee_id::text = ${employeeId}
        ORDER BY end_date DESC NULLS FIRST, start_date DESC
      `),
      prisma.$queryRaw<LeaveTxRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_id::text AS contract_id,
          leave_type,
          start_date,
          end_date,
          return_to_work_date,
          leave_days::numeric::float8 AS leave_days,
          status,
          notes
        FROM public.leave_transactions
        WHERE employee_id::text = ${employeeId}
        ORDER BY created_at DESC NULLS LAST, start_date DESC
      `),
    ]);

    const employee = employeeRows[0];
    if (!employee) return null;

    const orderedContracts = sortContractsCurrentFirst(contracts);
    const activeTransactions = transactions.filter((tx) => shouldCountLeaveStatus(tx.status));
    const contractsBreakdown: LeaveDetailData["contracts"] = await Promise.all(orderedContracts.map(async (contract) => {
      const contractStartIso = isoDate(contract.start_date);
      const contractEndIso = isoDate(contract.end_date);
      const contractYears = generateContractYears(contractStartIso, contractEndIso);
      const contractTransactions = activeTransactions.filter((tx) => transactionMatchesContractByDate(tx, contract));
      let balanceRows = await getLeaveYearBalances(employeeId, contract.id);
      if (balanceRows.length === 0) {
        await syncLeaveYearBalances(employeeId, contract.id);
        balanceRows = await getLeaveYearBalances(employeeId, contract.id);
      }
      const balanceByKey = new Map(
        balanceRows.map((row) => [`${row.contract_year_number}:${row.leave_type}`, row]),
      );

      let vacationRollover = 0;
      const years = sortContractYearsCurrentFirst(contractYears).map((year) => {
        const yearStart = new Date(`${year.startDate}T00:00:00`);
        const yearEnd = new Date(`${year.endDate}T23:59:59`);

        // TODO: split multi-day transactions crossing year boundaries by overlap days.
        // For now, allocate by leave start date to the matching contract year.
        const txInYear = contractTransactions.filter((tx) => {
          const txStart = new Date(`${isoDate(tx.start_date)}T00:00:00`);
          return txStart >= yearStart && txStart <= yearEnd;
        });

        const vacationEntitlement = Number(getLeaveEntitlementForContract(contract, "vacation") ?? 0);
        const sickEntitlement = Number(getLeaveEntitlementForContract(contract, "sick") ?? 0);

        const { vacationUsed, casualUsed, totalUsed: totalVacationUsed } = getVacationCasualUsed(txInYear);
        const sickUsed = getLiveUsedLeaveForContractYear(txInYear, "sick");

        const vacationBalance = balanceByKey.get(`${year.yearNumber}:vacation`);
        const sickBalance = balanceByKey.get(`${year.yearNumber}:sick`);
        const liveVacation = calculateLiveLeaveBalance({
          entitlement: Number(vacationBalance?.entitlement ?? vacationEntitlement),
          rolloverIn: Number(vacationBalance?.rollover_in ?? vacationRollover),
          adjustment: Number(vacationBalance?.adjustment ?? 0),
          used: totalVacationUsed,
          leaveType: "vacation",
        });
        const liveSick = calculateLiveLeaveBalance({
          entitlement: Number(sickBalance?.entitlement ?? sickEntitlement),
          rolloverIn: 0,
          adjustment: Number(sickBalance?.adjustment ?? 0),
          used: sickUsed,
          leaveType: "sick",
        });

        const yearResult = {
          yearNumber: year.yearNumber,
          startDate: year.startDate,
          endDate: year.endDate,
          isCurrentYear: isCurrentPeriod(year.startDate, year.endDate),
          vacation: {
            balanceId: vacationBalance?.id ?? "",
            entitlement: formatDays(vacationBalance?.entitlement ?? vacationEntitlement),
            rolloverIn: formatDays(vacationBalance?.rollover_in ?? vacationRollover),
            adjustment: formatDays(vacationBalance?.adjustment ?? 0),
            usedVacation: formatDays(vacationUsed),
            usedCasual: formatDays(casualUsed),
            usedTotal: formatDays(totalVacationUsed),
            remaining: formatDays(liveVacation.remaining),
            status: getLeaveStatus(liveVacation.remaining, "vacation", settings),
            locked: Boolean(vacationBalance?.locked),
            isCurrentYear: isCurrentPeriod(year.startDate, year.endDate),
          },
          sick: {
            balanceId: sickBalance?.id ?? "",
            entitlement: formatDays(sickBalance?.entitlement ?? sickEntitlement),
            rolloverIn: "—",
            adjustment: formatDays(sickBalance?.adjustment ?? 0),
            used: formatDays(sickUsed),
            remaining: formatDays(liveSick.remaining),
            status: getLeaveStatus(liveSick.remaining, "sick", settings),
            locked: Boolean(sickBalance?.locked),
            isCurrentYear: isCurrentPeriod(year.startDate, year.endDate),
          },
        };

        vacationRollover = liveVacation.remaining > 0 ? liveVacation.remaining : 0;
        return yearResult;
      });

      return {
        contractId: contract.id,
        minuteNumber: contract.minute_number?.trim() || "—",
        contractNumber: contract.contract_number?.trim() || "—",
        contractPeriod: formatContractPeriod(contractStartIso, contractEndIso),
        status: normalizeStatus(contract.status),
        years,
      };
    }));

    return {
      employee: {
        id: employee.id,
        fullName: `${employee.first_name} ${employee.last_name}`.trim(),
        fileNumber: employee.file_number,
        department: employee.department ?? "—",
        position: employee.position ?? "—",
      },
      latestContractStatus: normalizeStatus(orderedContracts[0]?.status ?? null),
      latestContractPeriod: orderedContracts[0]
        ? formatContractPeriod(isoDate(orderedContracts[0].start_date), isoDate(orderedContracts[0].end_date))
        : "—",
      currentContractId: orderedContracts[0]?.id ?? null,
      contracts: contractsBreakdown,
      transactions: transactions.map((tx) => {
        const resolvedContract = resolveContractForTransaction(tx, contracts);
        const startIso = isoDate(tx.start_date);
        const endIso = isoDate(tx.end_date);
        const retIso = isoDate(tx.return_to_work_date);
        return {
          id: tx.id,
          leaveType: getLeaveTypeLabel(tx.leave_type),
          startDate: formatDateLabel(startIso),
          endDate: formatDateLabel(endIso),
          returnToWorkDate: formatDateLabel(retIso),
          daysUsed: formatDays(Number(tx.leave_days)),
          contractPeriod: resolvedContract
            ? formatContractPeriod(isoDate(resolvedContract.start_date), isoDate(resolvedContract.end_date))
            : "—",
          status: normalizeStatus(tx.status),
          notes: tx.notes?.trim() || "—",
          _sortStartIso: startIso,
          _sortEndIso: endIso,
          _sortReturnIso: retIso,
          _sortDays: Number(tx.leave_days ?? 0),
        };
      }),
    };
  } catch {
    return null;
  }
}

export async function getLeaveTransactionsForEmployee(employeeId: string): Promise<LeaveTransactionListRow[]> {
  await ensureLeaveInfrastructure();
  try {
    const [transactions, contracts] = await Promise.all([
      prisma.$queryRaw<LeaveTxRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_id::text AS contract_id,
          leave_type,
          start_date,
          end_date,
          return_to_work_date,
          leave_days::numeric::float8 AS leave_days,
          status,
          notes
        FROM public.leave_transactions
        WHERE employee_id::text = ${employeeId}
        ORDER BY created_at DESC NULLS LAST, start_date DESC
      `),
      prisma.$queryRaw<ContractRow[]>(Prisma.sql`
        SELECT
          id::text AS id,
          employee_id::text AS employee_id,
          contract_number,
          minute_number,
          start_date,
          end_date,
          status,
          vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
          sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement
        FROM public.contracts
        WHERE employee_id::text = ${employeeId}
      `),
    ]);
    return transactions.map((tx) => {
      const resolvedContract = resolveContractForTransaction(tx, contracts);
      const startIso = isoDate(tx.start_date);
      const endIso = isoDate(tx.end_date);
      const retIso = isoDate(tx.return_to_work_date);
      return {
        id: tx.id,
        employeeId: tx.employee_id,
        leaveType: getLeaveTypeLabel(tx.leave_type),
        startDate: formatDateLabel(startIso),
        endDate: formatDateLabel(endIso),
        returnToWorkDate: formatDateLabel(retIso),
        daysUsed: formatDays(Number(tx.leave_days)),
        contractPeriod: resolvedContract
          ? formatContractPeriod(isoDate(resolvedContract.start_date), isoDate(resolvedContract.end_date))
          : "—",
        status: normalizeStatus(tx.status),
        notes: tx.notes?.trim() || "—",
        _sortStartIso: startIso,
        _sortEndIso: endIso,
        _sortReturnIso: retIso,
        _sortDays: Number(tx.leave_days ?? 0),
      };
    });
  } catch {
    return [];
  }
}

export async function getLeaveTransactionForEdit(leaveTransactionId: string): Promise<LeaveTransactionEditData | null> {
  await ensureLeaveInfrastructure();
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string;
        employee_id: string;
        employee_name: string;
        file_number: string;
        position: string | null;
        contract_id: string | null;
        leave_type: string;
        start_date: Date;
        end_date: Date;
        return_to_work_date: Date;
        leave_days: number;
        status: string | null;
        notes: string | null;
        contract_start_date: Date | null;
        contract_end_date: Date | null;
      }>
    >(Prisma.sql`
      SELECT
        lt.id::text AS id,
        lt.employee_id::text AS employee_id,
        trim(e.first_name || ' ' || e.last_name) AS employee_name,
        e.file_number,
        e.position,
        lt.contract_id::text AS contract_id,
        lt.leave_type,
        lt.start_date,
        lt.end_date,
        lt.return_to_work_date,
        lt.leave_days::numeric::float8 AS leave_days,
        lt.status,
        lt.notes,
        c.start_date AS contract_start_date,
        c.end_date AS contract_end_date
      FROM public.leave_transactions lt
      JOIN public.employees e
        ON e.id = lt.employee_id
      LEFT JOIN public.contracts c
        ON c.id = lt.contract_id
      WHERE lt.id::text = ${leaveTransactionId}
      LIMIT 1
    `);
    const row = rows[0];
    if (!row) return null;
    const safeStatus = (row.status ?? "recorded").trim().toLowerCase();
    const normalizedStatus =
      safeStatus === "approved" ||
      safeStatus === "cancelled" ||
      safeStatus === "rejected" ||
      safeStatus === "adjusted"
        ? safeStatus
        : "recorded";
    return {
      id: row.id,
      employeeId: row.employee_id,
      employeeName: row.employee_name || "—",
      fileNumber: row.file_number || "—",
      position: row.position || "—",
      contractId: row.contract_id,
      contractPeriod:
        row.contract_start_date && row.contract_end_date
          ? formatContractPeriod(isoDate(row.contract_start_date), isoDate(row.contract_end_date))
          : "—",
      leaveType: row.leave_type,
      startDate: isoDate(row.start_date),
      endDate: isoDate(row.end_date),
      returnToWorkDate: isoDate(row.return_to_work_date),
      leaveDays: Math.max(1, Math.round(Number(row.leave_days ?? 0))),
      status: normalizedStatus,
      notes: row.notes?.trim() ?? "",
    };
  } catch {
    return null;
  }
}
