import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export type ContractPeriodMatchRow = {
  id: string;
  contractNumber: string | null;
  minuteNumber: string | null;
  startDate: string;
  endDate: string;
  status: string | null;
};

export type ContractYearRange = {
  yearNumber: number;
  startDate: string;
  endDate: string;
};

type MatchResult =
  | {
      kind: "matched";
      contract: ContractPeriodMatchRow;
      contractYear: ContractYearRange | null;
      spansMultipleYears: boolean;
      isHistorical: boolean;
    }
  | { kind: "no_match"; message: string }
  | { kind: "crosses_contracts"; message: string };

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function addYears(value: Date, years: number): Date {
  const next = new Date(value.getTime());
  next.setFullYear(next.getFullYear() + years);
  return next;
}

function subtractDays(value: Date, days: number): Date {
  const next = new Date(value.getTime());
  next.setDate(next.getDate() - days);
  return next;
}

export function generateContractYears(contractStartDate: string, contractEndDate: string): ContractYearRange[] {
  const start = toDate(contractStartDate);
  const end = toDate(contractEndDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  const ranges: ContractYearRange[] = [];
  let cursor = start;
  let yearNumber = 1;
  while (cursor <= end) {
    const naturalYearEnd = subtractDays(addYears(cursor, 1), 1);
    const yearEnd = naturalYearEnd <= end ? naturalYearEnd : end;
    ranges.push({
      yearNumber,
      startDate: toIsoDate(cursor),
      endDate: toIsoDate(yearEnd),
    });
    cursor = new Date(yearEnd.getTime());
    cursor.setDate(cursor.getDate() + 1);
    yearNumber += 1;
  }
  return ranges;
}

export function getContractYearForDate(contractYears: ContractYearRange[], date: string): ContractYearRange | null {
  const target = toDate(date);
  return (
    contractYears.find((year) => {
      const start = toDate(year.startDate);
      const end = new Date(`${year.endDate}T23:59:59`);
      return target >= start && target <= end;
    }) ?? null
  );
}

export function findContractYearForLeavePeriod(
  contract: Pick<ContractPeriodMatchRow, "startDate" | "endDate">,
  leaveStartDate: string,
  leaveEndDate: string,
): { contractYear: ContractYearRange | null; spansMultipleYears: boolean } {
  const contractYears = generateContractYears(contract.startDate, contract.endDate);
  const startYear = getContractYearForDate(contractYears, leaveStartDate);
  const endYear = getContractYearForDate(contractYears, leaveEndDate);
  return {
    contractYear: startYear,
    spansMultipleYears: Boolean(startYear && endYear && startYear.yearNumber !== endYear.yearNumber),
  };
}

export async function findContractForLeavePeriod(
  employeeId: string,
  leaveStartDate: string,
  leaveEndDate: string,
): Promise<MatchResult> {
  const leaveStart = toDate(leaveStartDate);
  const leaveEnd = toDate(leaveEndDate);
  if (leaveEnd < leaveStart) {
    return { kind: "no_match", message: "Leave end date must be on or after the start date." };
  }

  const overlapping = await prisma.$queryRaw<
    Array<{
      id: string;
      contract_number: string | null;
      minute_number: string | null;
      start_date: Date;
      end_date: Date;
      status: string | null;
    }>
  >(Prisma.sql`
    SELECT
      id::text AS id,
      contract_number,
      minute_number,
      start_date,
      end_date,
      status
    FROM public.contracts
    WHERE employee_id::text = ${employeeId}
      AND start_date <= ${leaveEnd}::date
      AND end_date >= ${leaveStart}::date
    ORDER BY end_date DESC NULLS FIRST, start_date DESC
  `);

  if (overlapping.length === 0) {
    return {
      kind: "no_match",
      message: "No matching contract period was found for this leave date range.",
    };
  }

  const containing = overlapping.filter(
    (row) =>
      leaveStart >= new Date(`${toIsoDate(row.start_date)}T00:00:00`) &&
      leaveEnd <= new Date(`${toIsoDate(row.end_date)}T23:59:59`),
  );

  if (containing.length === 0) {
    return {
      kind: "crosses_contracts",
      message: "This leave period crosses more than one contract. Please split it into separate leave records.",
    };
  }

  const picked = containing.sort((a, b) => b.start_date.getTime() - a.start_date.getTime())[0];
  const contract: ContractPeriodMatchRow = {
    id: picked.id,
    contractNumber: picked.contract_number,
    minuteNumber: picked.minute_number,
    startDate: toIsoDate(picked.start_date),
    endDate: toIsoDate(picked.end_date),
    status: picked.status,
  };
  const year = findContractYearForLeavePeriod(contract, leaveStartDate, leaveEndDate);
  const now = new Date();
  const isHistorical = new Date(`${contract.endDate}T23:59:59`) < now;

  return {
    kind: "matched",
    contract,
    contractYear: year.contractYear,
    spansMultipleYears: year.spansMultipleYears,
    isHistorical,
  };
}
