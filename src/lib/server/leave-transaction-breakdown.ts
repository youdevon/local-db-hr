import "server-only";

import { Prisma } from "@prisma/client";

import { getLeaveEntitlementForContract } from "@/lib/leave-balances";
import { formatContractPeriod, formatDateLabel, formatDays, getLeaveTypeLabel } from "@/lib/leave";
import { generateContractYears, type ContractYearRange } from "@/lib/leave-contract-years";
import { prisma } from "@/lib/prisma";
import type { LeaveDetailData } from "@/lib/server/leave";
import { getLeaveYearBalances, syncLeaveYearBalances, type LeaveBalanceRow } from "@/lib/server/leave-year-balances";

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

type LeaveTxRow = {
  id: string;
  employee_id: string;
  contract_id: string | null;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  leave_days: number;
  status: string;
  notes: string | null;
};

function isoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
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

function getVacationCasualUsed(transactions: LeaveTxRow[]): {
  vacationUsed: number;
  casualUsed: number;
  totalUsed: number;
} {
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

export type LeaveBreakdownTxRow = {
  id: string;
  leavePeriod: string;
  leaveTypeLabel: string;
  leaveTypeRaw: string;
  daysTaken: string;
  daysTakenNum: number;
  balanceBefore: string | null;
  balanceAfter: string | null;
  status: string;
  remarks: string;
  _sortStartIso: string;
};

export type LeaveBreakdownYearBlock = {
  yearNumber: number;
  heading: string;
  startDate: string;
  endDate: string;
  transactions: LeaveBreakdownTxRow[];
};

export type LeaveBreakdownSummary = {
  vacationTaken: number;
  vacationRemaining: number | null;
  sickTaken: number;
  sickRemaining: number | null;
  generalTaken: number;
  generalRemaining: number | null;
};

export type LeaveTransactionBreakdownResult = {
  employeeId: string;
  employeeName: string;
  employeeFileNumber: string;
  contractId: string;
  contractPeriodLabel: string;
  contractNumber: string;
  minuteNumber: string;
  summary: LeaveBreakdownSummary;
  contractYears: LeaveBreakdownYearBlock[];
};

function normalizeStatus(value: string | null | undefined): string {
  const raw = (value ?? "").trim();
  if (!raw) return "—";
  return raw.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function leavePeriodLabel(startIso: string, endIso: string): string {
  return `${formatDateLabel(startIso)} – ${formatDateLabel(endIso)}`;
}

function isVacationPoolType(leaveType: string): boolean {
  return leaveType === "vacation" || leaveType === "casual";
}

function isGeneralLeaveType(leaveType: string): boolean {
  return !isVacationPoolType(leaveType) && leaveType !== "sick";
}

export async function getLeaveTransactionBreakdownForContract(
  employeeId: string,
  contractId: string,
): Promise<LeaveTransactionBreakdownResult | null> {
  try {
    const [employeeRows, contractRows, transactions] = await Promise.all([
      prisma.$queryRaw<Array<{ id: string; file_number: string; first_name: string; last_name: string }>>(
        Prisma.sql`
          SELECT id::text AS id, file_number, first_name, last_name
          FROM public.employees
          WHERE id::text = ${employeeId}
          LIMIT 1
        `,
      ),
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
        WHERE id::text = ${contractId}
          AND employee_id::text = ${employeeId}
        LIMIT 1
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
          status,
          notes
        FROM public.leave_transactions
        WHERE employee_id::text = ${employeeId}
        ORDER BY start_date ASC, id ASC
      `),
    ]);

    const employee = employeeRows[0];
    const contract = contractRows[0];
    if (!employee || !contract) return null;

    const contractStartIso = isoDate(contract.start_date);
    const contractEndIso = isoDate(contract.end_date);
    const contractYears = generateContractYears(contractStartIso, contractEndIso);
    if (contractYears.length === 0) return null;

    let balanceRows = await getLeaveYearBalances(employeeId, contract.id);
    if (balanceRows.length === 0) {
      await syncLeaveYearBalances(employeeId, contract.id);
      balanceRows = await getLeaveYearBalances(employeeId, contract.id);
    }
    const balanceByKey = new Map<string, LeaveBalanceRow>(
      balanceRows.map((row) => [`${row.contract_year_number}:${row.leave_type}`, row]),
    );

    const activeTransactions = transactions.filter((tx) => transactionMatchesContractByDate(tx, contract));

    let vacationRolloverChain = 0;
    const vacationRemainingByYear = new Map<number, number>();
    const sickRemainingByYear = new Map<number, number>();

    contractYears.forEach((year) => {
      const yearStart = new Date(`${year.startDate}T00:00:00`);
      const yearEnd = new Date(`${year.endDate}T23:59:59`);
      const txInYear = activeTransactions.filter((tx) => {
        const txStart = new Date(`${isoDate(tx.start_date)}T00:00:00`);
        return txStart >= yearStart && txStart <= yearEnd;
      });

      const countedYearTx = txInYear.filter((tx) => shouldCountLeaveStatus(tx.status));

      const vacationEntitlement = Number(getLeaveEntitlementForContract(contract, "vacation") ?? 0);
      const sickEntitlement = Number(getLeaveEntitlementForContract(contract, "sick") ?? 0);

      const { totalUsed: totalVacationUsed } = getVacationCasualUsed(countedYearTx);
      const sickUsed = getLiveUsedLeaveForContractYear(countedYearTx, "sick");

      const vacationBalance = balanceByKey.get(`${year.yearNumber}:vacation`);
      const sickBalance = balanceByKey.get(`${year.yearNumber}:sick`);

      const liveVacation = calculateLiveLeaveBalance({
        entitlement: Number(vacationBalance?.entitlement ?? vacationEntitlement),
        rolloverIn: Number(vacationBalance?.rollover_in ?? vacationRolloverChain),
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

      vacationRemainingByYear.set(year.yearNumber, liveVacation.remaining);
      sickRemainingByYear.set(year.yearNumber, liveSick.remaining);

      vacationRolloverChain = liveVacation.remaining > 0 ? liveVacation.remaining : 0;
    });

    const lastYear = contractYears[contractYears.length - 1]!;
    const vacationRemainingFinal = vacationRemainingByYear.get(lastYear.yearNumber) ?? 0;
    const sickRemainingFinal = sickRemainingByYear.get(lastYear.yearNumber) ?? 0;

    const countedContractTx = activeTransactions.filter((tx) => shouldCountLeaveStatus(tx.status));
    const vacationTaken = Number(
      countedContractTx
        .filter((tx) => isVacationPoolType(tx.leave_type))
        .reduce((s, tx) => s + Number(tx.leave_days), 0)
        .toFixed(2),
    );
    const sickTaken = Number(
      countedContractTx
        .filter((tx) => tx.leave_type === "sick")
        .reduce((s, tx) => s + Number(tx.leave_days), 0)
        .toFixed(2),
    );
    const generalTaken = Number(
      countedContractTx
        .filter((tx) => isGeneralLeaveType(tx.leave_type))
        .reduce((s, tx) => s + Number(tx.leave_days), 0)
        .toFixed(2),
    );

    const summary: LeaveBreakdownSummary = {
      vacationTaken,
      vacationRemaining: vacationRemainingFinal,
      sickTaken,
      sickRemaining: sickRemainingFinal,
      generalTaken,
      generalRemaining: null,
    };

    const yearBlocks = buildYearBlocks(contract, contractYears, activeTransactions, balanceByKey);

    return {
      employeeId,
      employeeName: `${employee.first_name} ${employee.last_name}`.trim(),
      employeeFileNumber: employee.file_number?.trim() || "—",
      contractId: contract.id,
      contractPeriodLabel: formatContractPeriod(contractStartIso, contractEndIso),
      contractNumber: contract.contract_number?.trim() || "—",
      minuteNumber: contract.minute_number?.trim() || "—",
      summary,
      contractYears: yearBlocks,
    };
  } catch {
    return null;
  }
}

function buildYearBlocks(
  contract: ContractRow,
  contractYears: ContractYearRange[],
  activeTransactions: LeaveTxRow[],
  balanceByKey: Map<string, LeaveBalanceRow>,
): LeaveBreakdownYearBlock[] {
  const blocks: LeaveBreakdownYearBlock[] = [];

  let vacationRollover = 0;

  for (const year of contractYears) {
    const yearStart = new Date(`${year.startDate}T00:00:00`);
    const yearEnd = new Date(`${year.endDate}T23:59:59`);

    const txsInYear = activeTransactions.filter((tx) => {
      const txStart = new Date(`${isoDate(tx.start_date)}T00:00:00`);
      return txStart >= yearStart && txStart <= yearEnd;
    });

    const vacationBalance = balanceByKey.get(`${year.yearNumber}:vacation`);
    const sickBalance = balanceByKey.get(`${year.yearNumber}:sick`);

    const vacationEntitlement = Number(getLeaveEntitlementForContract(contract, "vacation") ?? 0);
    const sickEntitlement = Number(getLeaveEntitlementForContract(contract, "sick") ?? 0);

    const vacationStartPool = calculateLiveLeaveBalance({
      entitlement: Number(vacationBalance?.entitlement ?? vacationEntitlement),
      rolloverIn: Number(vacationBalance?.rollover_in ?? vacationRollover),
      adjustment: Number(vacationBalance?.adjustment ?? 0),
      used: 0,
      leaveType: "vacation",
    }).available;

    const sickStartPool = calculateLiveLeaveBalance({
      entitlement: Number(sickBalance?.entitlement ?? sickEntitlement),
      rolloverIn: 0,
      adjustment: Number(sickBalance?.adjustment ?? 0),
      used: 0,
      leaveType: "sick",
    }).available;

    let vacationPool = vacationStartPool;
    let sickPool = sickStartPool;

    const sortedOldest = [...txsInYear].sort((a, b) => {
      const cmp = isoDate(a.start_date).localeCompare(isoDate(b.start_date));
      if (cmp !== 0) return cmp;
      return a.id.localeCompare(b.id);
    });

    const enriched: LeaveBreakdownTxRow[] = [];

    for (const tx of sortedOldest) {
      const startIso = isoDate(tx.start_date);
      const endIso = isoDate(tx.end_date);
      const days = Number(Number(tx.leave_days ?? 0).toFixed(2));
      const counts = shouldCountLeaveStatus(tx.status);
      const lt = tx.leave_type;

      let balanceBefore: string | null = null;
      let balanceAfter: string | null = null;

      if (isVacationPoolType(lt)) {
        balanceBefore = formatDays(vacationPool);
        if (counts) {
          vacationPool = Number((vacationPool - days).toFixed(2));
        }
        balanceAfter = formatDays(vacationPool);
      } else if (lt === "sick") {
        balanceBefore = formatDays(sickPool);
        if (counts) {
          sickPool = Number((sickPool - days).toFixed(2));
        }
        balanceAfter = formatDays(sickPool);
      }

      enriched.push({
        id: tx.id,
        leavePeriod: leavePeriodLabel(startIso, endIso),
        leaveTypeLabel: getLeaveTypeLabel(lt),
        leaveTypeRaw: lt,
        daysTaken: formatDays(days),
        daysTakenNum: days,
        balanceBefore,
        balanceAfter,
        status: normalizeStatus(tx.status),
        remarks: tx.notes?.trim() || "—",
        _sortStartIso: startIso,
      });
    }

    const countedYearTx = txsInYear.filter((tx) => shouldCountLeaveStatus(tx.status));
    const { totalUsed: totalVacationUsed } = getVacationCasualUsed(countedYearTx);
    const liveVacation = calculateLiveLeaveBalance({
      entitlement: Number(vacationBalance?.entitlement ?? vacationEntitlement),
      rolloverIn: Number(vacationBalance?.rollover_in ?? vacationRollover),
      adjustment: Number(vacationBalance?.adjustment ?? 0),
      used: totalVacationUsed,
      leaveType: "vacation",
    });
    vacationRollover = liveVacation.remaining > 0 ? liveVacation.remaining : 0;

    enriched.sort((a, b) => b._sortStartIso.localeCompare(a._sortStartIso));

    blocks.push({
      yearNumber: year.yearNumber,
      heading: `Contractual Year ${year.yearNumber}: ${formatDateLabel(year.startDate)} – ${formatDateLabel(year.endDate)}`,
      startDate: year.startDate,
      endDate: year.endDate,
      transactions: enriched,
    });
  }

  return blocks.sort((a, b) => b.yearNumber - a.yearNumber);
}

/**
 * Days remaining after each transaction (same running pools as breakdown: vacation/casual + sick per year).
 * Keys are transaction ids; omitted ids are types without a running balance row (e.g. general leave).
 */
export async function getLeaveTransactionDaysRemainingById(
  employeeId: string,
  detail: LeaveDetailData,
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const c of detail.contracts) {
    const breakdown = await getLeaveTransactionBreakdownForContract(employeeId, c.contractId);
    if (!breakdown) continue;
    for (const block of breakdown.contractYears) {
      for (const tx of block.transactions) {
        if (tx.balanceAfter != null && tx.balanceAfter.trim() !== "") {
          out[tx.id] = tx.balanceAfter;
        }
      }
    }
  }
  return out;
}
