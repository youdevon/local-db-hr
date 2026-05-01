import "server-only";

import { Prisma } from "@prisma/client";

import { getLeaveStatus, type LeaveStatus } from "@/lib/leave-balances";
import { calculateInclusiveLeaveDays, formatDateLabel, formatLeaveDays } from "@/lib/leave";
import { generateContractYears } from "@/lib/leave-contract-years";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";
import { getLeaveYearBalances } from "@/lib/server/leave-year-balances";

type ContractCore = {
  id: string;
  startDate: string;
  endDate: string;
  vacationEntitlement: number;
  sickEntitlement: number;
};

type LeaveTx = {
  leave_type: string;
  contract_id: string | null;
  start_date: Date;
  end_date: Date;
  leave_days: number | null;
  status: string | null;
};

export type ProfileLeaveSummary = {
  contractYearLabel: string;
  vacation: {
    entitlementText: string;
    rolloverInText: string;
    usedText: string;
    remainingText: string;
    status: LeaveStatus;
  };
  sick: {
    entitlementText: string;
    rolloverInText: string;
    usedText: string;
    remainingText: string;
    status: LeaveStatus;
  };
};

function toDateOnly(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shouldCountStatus(status: string | null | undefined): boolean {
  const normalized = (status ?? "").trim().toLowerCase();
  return normalized === "recorded" || normalized === "approved" || normalized === "adjusted";
}

function txDays(tx: LeaveTx): number {
  const stored = Math.round(Number(tx.leave_days ?? 0));
  if (stored > 0) return stored;
  return calculateInclusiveLeaveDays(tx.start_date, tx.end_date);
}

function buildContractYears(contract: ContractCore) {
  return generateContractYears(contract.startDate, contract.endDate);
}

function pickCurrentOrLatestYear(years: ReturnType<typeof buildContractYears>) {
  const now = new Date();
  return (
    years.find((year) => {
      const start = new Date(`${year.startDate}T00:00:00`);
      const end = new Date(`${year.endDate}T23:59:59`);
      return now >= start && now <= end;
    }) ??
    years[years.length - 1] ??
    null
  );
}

function txForContractYear(transactions: LeaveTx[], contractId: string, startDate: string, endDate: string): LeaveTx[] {
  const yearStart = new Date(`${startDate}T00:00:00`);
  const yearEnd = new Date(`${endDate}T23:59:59`);
  return transactions.filter((tx) => {
    if (!shouldCountStatus(tx.status)) return false;
    // contract_id-aware matching; null contract_id falls back to date-range matching
    if (tx.contract_id && tx.contract_id !== contractId) return false;
    const txStart = new Date(`${tx.start_date.toISOString().slice(0, 10)}T00:00:00`);
    return txStart >= yearStart && txStart <= yearEnd;
  });
}

function sumUsed(rows: LeaveTx[], leaveTypes: string[]): number {
  return rows
    .filter((row) => leaveTypes.includes(row.leave_type))
    .reduce((sum, row) => sum + txDays(row), 0);
}

export async function getProfileLeaveSummaryForContract(
  employeeId: string,
  contract: ContractCore,
): Promise<ProfileLeaveSummary | null> {
  const [settings, balances, txRows] = await Promise.all([
    getLeaveWarningSettings(),
    getLeaveYearBalances(employeeId, contract.id),
    prisma.$queryRaw<LeaveTx[]>(Prisma.sql`
      SELECT
        leave_type,
        contract_id::text AS contract_id,
        start_date,
        end_date,
        leave_days::numeric::float8 AS leave_days,
        status
      FROM public.leave_transactions
      WHERE employee_id::text = ${employeeId}
      ORDER BY start_date ASC
    `),
  ]);

  const years = buildContractYears(contract);
  const selectedYear = pickCurrentOrLatestYear(years);
  if (!selectedYear) return null;

  const contractYearLabel = `${formatDateLabel(selectedYear.startDate)} – ${formatDateLabel(selectedYear.endDate)}`;
  const selectedYearTx = txForContractYear(txRows, contract.id, selectedYear.startDate, selectedYear.endDate);

  const vacationUsed = sumUsed(selectedYearTx, ["vacation"]);
  const casualUsed = sumUsed(selectedYearTx, ["casual"]);
  const vacationTotalUsed = Math.round(vacationUsed + casualUsed);
  const sickUsed = Math.round(sumUsed(selectedYearTx, ["sick"]));

  const vacationStored = balances.find(
    (row) => row.contract_year_number === selectedYear.yearNumber && row.leave_type === "vacation",
  );
  const sickStored = balances.find(
    (row) => row.contract_year_number === selectedYear.yearNumber && row.leave_type === "sick",
  );

  let vacationEntitlement = Math.round(Number(vacationStored?.entitlement ?? contract.vacationEntitlement));
  let vacationRolloverIn = Math.round(Number(vacationStored?.rollover_in ?? 0));
  let vacationAdjustment = Math.round(Number(vacationStored?.adjustment ?? 0));
  let sickEntitlement = Math.round(Number(sickStored?.entitlement ?? contract.sickEntitlement));
  let sickAdjustment = Math.round(Number(sickStored?.adjustment ?? 0));

  // Fallback when leave_year_balances is missing: compute rollover forward by live transaction usage per contract year.
  if (!vacationStored || !sickStored) {
    let runningRollover = 0;
    for (const year of years) {
      const yearTx = txForContractYear(txRows, contract.id, year.startDate, year.endDate);
      const yearVacationUsed = Math.round(sumUsed(yearTx, ["vacation", "casual"]));
      const yearAvailable = Math.round(contract.vacationEntitlement + runningRollover);
      const yearRemaining = Math.round(yearAvailable - yearVacationUsed);
      if (year.yearNumber === selectedYear.yearNumber) {
        if (!vacationStored) {
          vacationEntitlement = Math.round(contract.vacationEntitlement);
          vacationRolloverIn = Math.round(runningRollover);
          vacationAdjustment = 0;
        }
        if (!sickStored) {
          sickEntitlement = Math.round(contract.sickEntitlement);
          sickAdjustment = 0;
        }
      }
      runningRollover = yearRemaining > 0 ? yearRemaining : 0;
    }
  }

  const vacationAvailable = Math.round(vacationEntitlement + vacationRolloverIn + vacationAdjustment);
  const vacationRemaining = Math.round(vacationAvailable - vacationTotalUsed);
  const sickAvailable = Math.round(sickEntitlement + sickAdjustment);
  const sickRemaining = Math.round(sickAvailable - sickUsed);

  return {
    contractYearLabel,
    vacation: {
      entitlementText: formatLeaveDays(vacationAvailable),
      rolloverInText: formatLeaveDays(vacationRolloverIn),
      usedText: formatLeaveDays(vacationTotalUsed),
      remainingText: formatLeaveDays(vacationRemaining),
      status: getLeaveStatus(vacationRemaining, "vacation", settings),
    },
    sick: {
      entitlementText: formatLeaveDays(sickAvailable),
      rolloverInText: "—",
      usedText: formatLeaveDays(sickUsed),
      remainingText: formatLeaveDays(sickRemaining),
      status: getLeaveStatus(sickRemaining, "sick", settings),
    },
  };
}
