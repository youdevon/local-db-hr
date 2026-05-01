import "server-only";

import { Prisma } from "@prisma/client";

import { createSystemAuditLog } from "@/lib/audit";
import { getLeaveStatus } from "@/lib/leave-balances";
import { generateContractYears, type ContractYearRange } from "@/lib/leave-contract-years";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { prisma } from "@/lib/prisma";

type LeaveBalanceRow = {
  id: string;
  employee_id: string;
  contract_id: string;
  contract_year_number: number;
  year_start_date: Date;
  year_end_date: Date;
  leave_type: string;
  entitlement: number;
  rollover_in: number;
  used: number;
  remaining: number;
  adjustment: number;
  adjustment_reason: string | null;
  locked: boolean;
};

type ContractCore = {
  id: string;
  employee_id: string;
  start_date: Date;
  end_date: Date;
  vacation_leave_entitlement: number;
  sick_leave_entitlement: number;
};

type LeaveTx = {
  id: string;
  employee_id: string;
  contract_id: string | null;
  leave_type: string;
  start_date: Date;
  end_date: Date;
  leave_days: number;
  status: string;
};

type ComputedYearBalance = {
  employeeId: string;
  contractId: string;
  contractYearNumber: number;
  yearStartDate: string;
  yearEndDate: string;
  leaveType: "vacation" | "sick";
  entitlement: number;
  rolloverIn: number;
  used: number;
  remaining: number;
  adjustment: number;
};

function isoDate(value: Date | string): string {
  if (typeof value === "string") return value;
  return value.toISOString().slice(0, 10);
}

function normalizeNumber(value: unknown): number {
  const num = Number(value ?? 0);
  if (!Number.isFinite(num)) return 0;
  return Number(num.toFixed(2));
}

function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function formatTypeLabel(leaveType: string): string {
  if (leaveType === "vacation") return "Vacation";
  if (leaveType === "sick") return "Sick";
  return leaveType;
}

export function generateContractYearsForBalances(contractStartDate: string, contractEndDate: string): ContractYearRange[] {
  return generateContractYears(contractStartDate, contractEndDate);
}

export async function calculateContractYearBalances(
  employeeId: string,
  contractId: string,
): Promise<ComputedYearBalance[]> {
  const [contracts, transactions, existing] = await Promise.all([
    prisma.$queryRaw<ContractCore[]>(Prisma.sql`
      SELECT
        id::text AS id,
        employee_id::text AS employee_id,
        start_date,
        end_date,
        vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
        sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement
      FROM public.contracts
      WHERE id::text = ${contractId}
        AND employee_id::text = ${employeeId}
      LIMIT 1
    `),
    prisma.$queryRaw<LeaveTx[]>(Prisma.sql`
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
      WHERE employee_id::text = ${employeeId}
        AND contract_id::text = ${contractId}
        AND status <> 'cancelled'
    `),
    prisma.$queryRaw<LeaveBalanceRow[]>(Prisma.sql`
      SELECT
        id::text AS id,
        employee_id::text AS employee_id,
        contract_id::text AS contract_id,
        contract_year_number,
        year_start_date,
        year_end_date,
        leave_type,
        entitlement::numeric::float8 AS entitlement,
        rollover_in::numeric::float8 AS rollover_in,
        used::numeric::float8 AS used,
        remaining::numeric::float8 AS remaining,
        adjustment::numeric::float8 AS adjustment,
        adjustment_reason,
        locked
      FROM public.leave_year_balances
      WHERE employee_id::text = ${employeeId}
        AND contract_id::text = ${contractId}
    `),
  ]);

  const contract = contracts[0];
  if (!contract) return [];

  const years = generateContractYears(isoDate(contract.start_date), isoDate(contract.end_date));
  let rollover = 0;
  const balances: ComputedYearBalance[] = [];
  const adjustmentMap = new Map<string, number>();
  existing.forEach((row) => {
    adjustmentMap.set(`${row.contract_year_number}:${row.leave_type}`, normalizeNumber(row.adjustment));
  });

  for (const year of years) {
    const yearStart = toDate(year.startDate);
    const yearEnd = new Date(`${year.endDate}T23:59:59`);
    // TODO: split cross-year transactions by overlap days.
    const yearTx = transactions.filter((tx) => {
      const start = new Date(`${isoDate(tx.start_date)}T00:00:00`);
      return start >= yearStart && start <= yearEnd;
    });

    const vacationUsed = normalizeNumber(
      yearTx.filter((tx) => tx.leave_type === "vacation").reduce((sum, tx) => sum + normalizeNumber(tx.leave_days), 0),
    );
    const casualUsed = normalizeNumber(
      yearTx.filter((tx) => tx.leave_type === "casual").reduce((sum, tx) => sum + normalizeNumber(tx.leave_days), 0),
    );
    const sickUsed = normalizeNumber(
      yearTx.filter((tx) => tx.leave_type === "sick").reduce((sum, tx) => sum + normalizeNumber(tx.leave_days), 0),
    );

    const vacationEntitlement = normalizeNumber(contract.vacation_leave_entitlement);
    const sickEntitlement = normalizeNumber(contract.sick_leave_entitlement);
    const vacationAdjustment = adjustmentMap.get(`${year.yearNumber}:vacation`) ?? 0;
    const sickAdjustment = adjustmentMap.get(`${year.yearNumber}:sick`) ?? 0;
    const vacationAvailable = normalizeNumber(vacationEntitlement + rollover + vacationAdjustment);
    const vacationRemaining = normalizeNumber(vacationAvailable - (vacationUsed + casualUsed));
    const sickAvailable = normalizeNumber(sickEntitlement + sickAdjustment);
    const sickRemaining = normalizeNumber(sickAvailable - sickUsed);

    balances.push({
      employeeId,
      contractId,
      contractYearNumber: year.yearNumber,
      yearStartDate: year.startDate,
      yearEndDate: year.endDate,
      leaveType: "vacation",
      entitlement: vacationEntitlement,
      rolloverIn: rollover,
      used: normalizeNumber(vacationUsed + casualUsed),
      remaining: vacationRemaining,
      adjustment: normalizeNumber(vacationAdjustment),
    });
    balances.push({
      employeeId,
      contractId,
      contractYearNumber: year.yearNumber,
      yearStartDate: year.startDate,
      yearEndDate: year.endDate,
      leaveType: "sick",
      entitlement: sickEntitlement,
      rolloverIn: 0,
      used: sickUsed,
      remaining: sickRemaining,
      adjustment: normalizeNumber(sickAdjustment),
    });

    rollover = vacationRemaining > 0 ? vacationRemaining : 0;
  }

  return balances;
}

export async function syncLeaveYearBalances(
  employeeId: string,
  contractId: string,
  actorUserId?: string | null,
): Promise<void> {
  const computed = await calculateContractYearBalances(employeeId, contractId);
  if (computed.length === 0) return;

  const existing = await prisma.$queryRaw<LeaveBalanceRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      employee_id::text AS employee_id,
      contract_id::text AS contract_id,
      contract_year_number,
      year_start_date,
      year_end_date,
      leave_type,
      entitlement::numeric::float8 AS entitlement,
      rollover_in::numeric::float8 AS rollover_in,
      used::numeric::float8 AS used,
      remaining::numeric::float8 AS remaining,
      adjustment::numeric::float8 AS adjustment,
      adjustment_reason,
      locked
    FROM public.leave_year_balances
    WHERE employee_id::text = ${employeeId}
      AND contract_id::text = ${contractId}
  `);
  const existingMap = new Map(existing.map((row) => [`${row.contract_year_number}:${row.leave_type}`, row]));

  await prisma.$transaction(async (tx) => {
    for (const row of computed) {
      const key = `${row.contractYearNumber}:${row.leaveType}`;
      const current = existingMap.get(key);
      if (current) {
        if (current.locked) continue;
        await tx.$executeRaw(
          Prisma.sql`
            UPDATE public.leave_year_balances
            SET
              year_start_date = ${toDate(row.yearStartDate)}::date,
              year_end_date = ${toDate(row.yearEndDate)}::date,
              entitlement = ${row.entitlement},
              rollover_in = ${row.rolloverIn},
              used = ${row.used},
              remaining = ${row.remaining},
              updated_by = ${actorUserId ?? null}::uuid,
              updated_at = NOW()
            WHERE id::text = ${current.id}
          `,
        );
      } else {
        await tx.$executeRaw(
          Prisma.sql`
            INSERT INTO public.leave_year_balances (
              employee_id,
              contract_id,
              contract_year_number,
              year_start_date,
              year_end_date,
              leave_type,
              entitlement,
              rollover_in,
              used,
              remaining,
              adjustment,
              locked,
              created_by,
              updated_by
            )
            VALUES (
              ${row.employeeId}::uuid,
              ${row.contractId}::uuid,
              ${row.contractYearNumber},
              ${toDate(row.yearStartDate)}::date,
              ${toDate(row.yearEndDate)}::date,
              ${row.leaveType},
              ${row.entitlement},
              ${row.rolloverIn},
              ${row.used},
              ${row.remaining},
              ${row.adjustment},
              false,
              ${actorUserId ?? null}::uuid,
              ${actorUserId ?? null}::uuid
            )
          `,
        );
      }
    }
  });

  await createSystemAuditLog({
    actorUserId: actorUserId ?? null,
    module: "Leave",
    action: "synced_leave_year_balance",
    targetType: "leave_balance",
    targetLabel: `Leave Balance Sync: Employee ${employeeId}`,
    success: true,
    metadata: { contract_id: contractId, rows: computed.length },
  });
}

export async function getLeaveYearBalances(employeeId: string, contractId?: string): Promise<LeaveBalanceRow[]> {
  const whereContract = contractId
    ? Prisma.sql`AND contract_id::text = ${contractId}`
    : Prisma.sql``;
  return prisma.$queryRaw<LeaveBalanceRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      employee_id::text AS employee_id,
      contract_id::text AS contract_id,
      contract_year_number,
      year_start_date,
      year_end_date,
      leave_type,
      entitlement::numeric::float8 AS entitlement,
      rollover_in::numeric::float8 AS rollover_in,
      used::numeric::float8 AS used,
      remaining::numeric::float8 AS remaining,
      adjustment::numeric::float8 AS adjustment,
      adjustment_reason,
      locked
    FROM public.leave_year_balances
    WHERE employee_id::text = ${employeeId}
    ${whereContract}
    ORDER BY contract_year_number ASC, leave_type ASC
  `);
}

export async function adjustLeaveYearBalance(
  balanceId: string,
  adjustment: number,
  reason: string,
  actorUserId?: string | null,
): Promise<{ before: LeaveBalanceRow; after: LeaveBalanceRow } | null> {
  const rows = await prisma.$queryRaw<LeaveBalanceRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      employee_id::text AS employee_id,
      contract_id::text AS contract_id,
      contract_year_number,
      year_start_date,
      year_end_date,
      leave_type,
      entitlement::numeric::float8 AS entitlement,
      rollover_in::numeric::float8 AS rollover_in,
      used::numeric::float8 AS used,
      remaining::numeric::float8 AS remaining,
      adjustment::numeric::float8 AS adjustment,
      adjustment_reason,
      locked
    FROM public.leave_year_balances
    WHERE id::text = ${balanceId}
    LIMIT 1
  `);
  const before = rows[0];
  if (!before || before.locked) return null;

  const newAdjustment = normalizeNumber(adjustment);
  const available =
    before.leave_type === "vacation"
      ? normalizeNumber(before.entitlement + before.rollover_in + newAdjustment)
      : normalizeNumber(before.entitlement + newAdjustment);
  const remaining = normalizeNumber(available - before.used);

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.leave_year_balances
      SET
        adjustment = ${newAdjustment},
        adjustment_reason = ${reason.trim()},
        remaining = ${remaining},
        updated_by = ${actorUserId ?? null}::uuid,
        updated_at = NOW()
      WHERE id::text = ${balanceId}
    `,
  );

  const updatedRows = await prisma.$queryRaw<LeaveBalanceRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      employee_id::text AS employee_id,
      contract_id::text AS contract_id,
      contract_year_number,
      year_start_date,
      year_end_date,
      leave_type,
      entitlement::numeric::float8 AS entitlement,
      rollover_in::numeric::float8 AS rollover_in,
      used::numeric::float8 AS used,
      remaining::numeric::float8 AS remaining,
      adjustment::numeric::float8 AS adjustment,
      adjustment_reason,
      locked
    FROM public.leave_year_balances
    WHERE id::text = ${balanceId}
    LIMIT 1
  `);
  const after = updatedRows[0];
  if (!after) return null;
  return { before, after };
}

export async function lockLeaveYearBalance(balanceId: string, actorUserId?: string | null): Promise<boolean> {
  const result = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.leave_year_balances
      SET
        locked = true,
        locked_at = NOW(),
        locked_by = ${actorUserId ?? null}::uuid,
        updated_by = ${actorUserId ?? null}::uuid,
        updated_at = NOW()
      WHERE id::text = ${balanceId}
    `,
  );
  return Number(result) > 0;
}

export async function unlockLeaveYearBalance(balanceId: string, actorUserId?: string | null): Promise<boolean> {
  const result = await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.leave_year_balances
      SET
        locked = false,
        locked_at = NULL,
        locked_by = NULL,
        updated_by = ${actorUserId ?? null}::uuid,
        updated_at = NOW()
      WHERE id::text = ${balanceId}
    `,
  );
  return Number(result) > 0;
}

export async function getLeaveBalanceStatusSummary(balance: {
  leave_type: string;
  remaining: number;
}) {
  const settings = await getLeaveWarningSettings();
  return getLeaveStatus(balance.remaining, balance.leave_type, settings);
}

export function formatLeaveBalanceTargetLabel(input: {
  employeeName: string;
  contractYearNumber: number;
  leaveType: string;
}) {
  return `Leave Balance: ${input.employeeName} - Contract Year ${input.contractYearNumber} - ${formatTypeLabel(input.leaveType)}`;
}

export type { LeaveBalanceRow };
