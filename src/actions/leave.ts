"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertViewerCannotMutateOrThrow } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { canPerformAction, MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import {
  calculateLeaveRemaining,
  getLeaveEntitlementForContract,
} from "@/lib/leave-balances";
import { calculateInclusiveLeaveDays, getLeaveTypeLabel } from "@/lib/leave";
import { ensureLeaveInfrastructure } from "@/lib/leave-infrastructure";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { findContractForLeavePeriod } from "@/lib/server/contract-period-matching";
import { syncLeaveYearBalances } from "@/lib/server/leave-year-balances";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/validators/leave-form";
import {
  leaveTransactionEditSchema,
  type LeaveTransactionEditValues,
} from "@/lib/validators/leave-form";

type LeaveActionResult = { success: boolean; message: string; leaveId?: string };
type LeaveMutationResult = { success: boolean; message: string; employeeId?: string };
type AuditChange = {
  field: string;
  label: string;
  type: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
  format?: "text" | "date" | "number";
};

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function normalizeLeaveStatus(value: string): "recorded" | "approved" | "cancelled" | "rejected" | "adjusted" {
  const normalized = value.trim().toLowerCase();
  if (normalized === "approved") return "approved";
  if (normalized === "cancelled") return "cancelled";
  if (normalized === "rejected") return "rejected";
  if (normalized === "adjusted") return "adjusted";
  return "recorded";
}

function formatIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function formatMatchedContractLabel(match: {
  contractNumber: string | null;
  minuteNumber: string | null;
}) {
  const minute = match.minuteNumber?.trim() || "No minute #";
  const contract = match.contractNumber?.trim() || "No assigned contract #";
  return `${minute} / ${contract}`;
}

async function syncLeaveBalancesForEmployeeContracts(
  employeeId: string,
  contractId: string | null,
  actorUserId: string | null,
) {
  if (contractId) {
    await syncLeaveYearBalances(employeeId, contractId, actorUserId);
    return;
  }
  const contractRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id::text AS id
    FROM public.contracts
    WHERE employee_id::text = ${employeeId}
  `);
  for (const row of contractRows) {
    await syncLeaveYearBalances(employeeId, row.id, actorUserId);
  }
}

export async function createLeaveAction(input: LeaveFormValues): Promise<LeaveActionResult> {
  await assertViewerCannotMutateOrThrow();
  await ensureLeaveInfrastructure();
  const actorSession = await getSession();
  const actorUser = actorSession.user;
  if (!actorUser?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  if (!canPerformAction(actorUser.role ?? null, "leave.create")) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = actorUser?.userId ?? null;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = leaveFormSchema.safeParse(input);
  if (!parsed.success) {
    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "created_leave_record",
      targetType: "leave",
      targetLabel: "Leave: attempted",
      success: false,
      failureReason: "Please complete all required leave fields.",
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: "Failed to create leave record. Please try again." };
  }

  const data = parsed.data;
  if (!data.employeeId?.trim()) return { success: false, message: "Please select an employee." };
  if (!data.leaveType?.trim()) return { success: false, message: "Please select a leave type." };
  if (toDate(data.endDate) < toDate(data.startDate)) {
    return { success: false, message: "Leave end date must be on or after the start date." };
  }
  if (toDate(data.returnToWorkDate) <= toDate(data.endDate)) {
    return { success: false, message: "Return to work date must be after the leave end date." };
  }

  const requestedDays = Math.round(Number(data.leaveDays || calculateInclusiveLeaveDays(data.startDate, data.endDate)));
  if (requestedDays < 1) {
    return { success: false, message: "Leave period must be at least one day." };
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const employeeRows = await tx.$queryRaw<Array<{ id: string; full_name: string }>>(
        Prisma.sql`
          SELECT id::text AS id, trim(first_name || ' ' || last_name) AS full_name
          FROM public.employees
          WHERE id::text = ${data.employeeId}
          LIMIT 1
        `,
      );
      const employee = employeeRows[0];
      if (!employee) throw new Error("Please select an employee.");

      const matched = await findContractForLeavePeriod(data.employeeId, data.startDate, data.endDate);
      if (matched.kind !== "matched") {
        throw new Error(matched.message);
      }
      const contractId = matched.contract.id;

      const contractRows = await tx.$queryRaw<
        Array<{
          id: string;
          contract_number: string | null;
          start_date: Date;
          end_date: Date;
          vacation_leave_entitlement: number;
          sick_leave_entitlement: number;
        }>
      >(Prisma.sql`
        SELECT
          id::text AS id,
          contract_number,
          start_date,
          end_date,
          vacation_leave_entitlement::numeric::float8 AS vacation_leave_entitlement,
          sick_leave_entitlement::numeric::float8 AS sick_leave_entitlement
        FROM public.contracts
        WHERE id::text = ${contractId}
        LIMIT 1
      `);
      const contract = contractRows[0] ?? null;

      const usedRows = await tx.$queryRaw<Array<{ used_days: number }>>(Prisma.sql`
        SELECT COALESCE(SUM(leave_days::numeric), 0)::float8 AS used_days
        FROM public.leave_transactions
        WHERE employee_id::text = ${data.employeeId}
          AND contract_id::text = ${contractId}
          AND (
            (${data.leaveType} = 'sick' AND leave_type = 'sick')
            OR
            (${data.leaveType} IN ('vacation', 'casual') AND leave_type IN ('vacation', 'casual'))
          )
          AND status IN ('recorded', 'approved', 'adjusted')
      `);
      const used = Number(usedRows[0]?.used_days ?? 0);
      const entitlement = contract ? getLeaveEntitlementForContract(contract, data.leaveType) ?? 0 : 0;
      const projectedRemaining = calculateLeaveRemaining(entitlement, used + requestedDays);
      const enforceBalance = data.leaveType === "vacation" || data.leaveType === "sick";

      if (enforceBalance && projectedRemaining < 0) {
        throw new Error("Requested leave exceeds the remaining balance for this contract period.");
      }

      const result = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`
          INSERT INTO public.leave_transactions (
            employee_id,
            contract_id,
            leave_type,
            start_date,
            end_date,
            return_to_work_date,
            leave_days,
            status,
            notes,
            created_by,
            updated_by
          )
          VALUES (
            ${data.employeeId}::uuid,
            ${contractId ?? null}::uuid,
            ${data.leaveType},
            ${toDate(data.startDate)}::date,
            ${toDate(data.endDate)}::date,
            ${toDate(data.returnToWorkDate)}::date,
            ${requestedDays},
            'recorded',
            ${data.notes?.trim() || null},
            ${actorUserId ?? null}::uuid,
            ${actorUserId ?? null}::uuid
          )
          RETURNING id::text
        `,
      );

      return {
        leaveId: result[0]?.id,
        employeeName: employee.full_name || "Employee",
        leaveLabel: getLeaveTypeLabel(data.leaveType),
        contractId,
        matchedContractLabel: formatMatchedContractLabel(matched.contract),
        matchedContractPeriod: `${matched.contract.startDate} – ${matched.contract.endDate}`,
        matchedContractYear: matched.contractYear
          ? `Year ${matched.contractYear.yearNumber}: ${matched.contractYear.startDate} – ${matched.contractYear.endDate}`
          : null,
        historicalMatch: matched.isHistorical,
      };
    });

    if (created.contractId) {
      await syncLeaveYearBalances(data.employeeId, created.contractId, actorUserId);
    }

    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "created_leave_record",
      targetType: "leave",
      targetId: created.leaveId ?? null,
      targetLabel: `Leave: ${created.employeeName} - ${created.leaveLabel}`,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        matchedContractId: created.contractId,
        matchedContractLabel: created.matchedContractLabel,
        matchedContractPeriod: created.matchedContractPeriod,
        matchedContractYear: created.matchedContractYear,
        historicalMatch: created.historicalMatch,
      },
    });

    revalidatePath("/leave");
    revalidatePath(`/leave/employee/${data.employeeId}`);
    revalidatePath("/");
    return { success: true, message: "Leave record created successfully.", leaveId: created.leaveId };
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message
        ? error.message
        : "Failed to create leave record. Please try again.";
    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "created_leave_record",
      targetType: "leave",
      targetLabel: "Leave: attempted",
      success: false,
      failureReason,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: failureReason };
  }
}

export async function updateLeaveTransactionAction(
  input: LeaveTransactionEditValues,
): Promise<LeaveMutationResult> {
  await assertViewerCannotMutateOrThrow();
  await ensureLeaveInfrastructure();
  const actorSession = await getSession();
  const actorUser = actorSession.user;
  if (!actorUser?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  if (!canPerformAction(actorUser.role ?? null, "leave.edit")) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = actorUser?.userId ?? null;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  const parsed = leaveTransactionEditSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Please complete all required leave fields." };
  }
  const data = parsed.data;
  const requestedDays = Math.round(Number(data.leaveDays || calculateInclusiveLeaveDays(data.startDate, data.endDate)));
  if (requestedDays < 1) return { success: false, message: "Leave period must be at least one day." };
  if (toDate(data.endDate) < toDate(data.startDate)) {
    return { success: false, message: "Leave end date must be on or after the start date." };
  }
  if (toDate(data.returnToWorkDate) <= toDate(data.endDate)) {
    return { success: false, message: "Return to work date must be after the leave end date." };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw<
        Array<{
          id: string;
          employee_id: string;
          contract_id: string | null;
          leave_type: string;
          start_date: Date;
          end_date: Date;
          return_to_work_date: Date;
          leave_days: number;
          status: string | null;
          notes: string | null;
          employee_name: string;
        }>
      >(Prisma.sql`
        SELECT
          lt.id::text AS id,
          lt.employee_id::text AS employee_id,
          lt.contract_id::text AS contract_id,
          lt.leave_type,
          lt.start_date,
          lt.end_date,
          lt.return_to_work_date,
          lt.leave_days::numeric::float8 AS leave_days,
          lt.status,
          lt.notes,
          trim(e.first_name || ' ' || e.last_name) AS employee_name
        FROM public.leave_transactions lt
        JOIN public.employees e
          ON e.id = lt.employee_id
        WHERE lt.id::text = ${data.id}
        LIMIT 1
      `);
      const existing = existingRows[0];
      if (!existing) throw new Error("Leave record not found.");
      const previousContractId = existing.contract_id;
      const matched = await findContractForLeavePeriod(existing.employee_id, data.startDate, data.endDate);
      if (matched.kind !== "matched") {
        throw new Error(matched.message);
      }
      const matchedContractId = matched.contract.id;

      const normalizedStatus = normalizeLeaveStatus(data.status);
      const existingStatus = normalizeLeaveStatus(existing.status ?? "recorded");
      const changes: AuditChange[] = [];
      const beforeStart = formatIsoDate(existing.start_date);
      const beforeEnd = formatIsoDate(existing.end_date);
      const beforeReturn = formatIsoDate(existing.return_to_work_date);
      if (existing.leave_type !== data.leaveType) {
        changes.push({
          field: "leave_type",
          label: "Leave Type",
          type: "changed",
          before: existing.leave_type,
          after: data.leaveType,
          format: "text",
        });
      }
      if (beforeStart !== data.startDate) {
        changes.push({
          field: "start_date",
          label: "Start Date",
          type: "changed",
          before: beforeStart,
          after: data.startDate,
          format: "date",
        });
      }
      if (beforeEnd !== data.endDate) {
        changes.push({
          field: "end_date",
          label: "End Date",
          type: "changed",
          before: beforeEnd,
          after: data.endDate,
          format: "date",
        });
      }
      if (beforeReturn !== data.returnToWorkDate) {
        changes.push({
          field: "return_to_work_date",
          label: "Return to Work Date",
          type: "changed",
          before: beforeReturn,
          after: data.returnToWorkDate,
          format: "date",
        });
      }
      if (Math.round(Number(existing.leave_days ?? 0)) !== requestedDays) {
        changes.push({
          field: "leave_days",
          label: "Days Used",
          type: "changed",
          before: Math.round(Number(existing.leave_days ?? 0)),
          after: requestedDays,
          format: "number",
        });
      }
      if (existingStatus !== normalizedStatus) {
        changes.push({
          field: "status",
          label: "Status",
          type: "changed",
          before: existingStatus,
          after: normalizedStatus,
          format: "text",
        });
      }
      const existingNotes = existing.notes?.trim() || "";
      const nextNotes = data.notes?.trim() || "";
      if (existingNotes !== nextNotes) {
        changes.push({
          field: "notes",
          label: "Notes",
          type: "changed",
          before: existingNotes || null,
          after: nextNotes || null,
          format: "text",
        });
      }
      if ((existing.contract_id ?? null) !== matchedContractId) {
        changes.push({
          field: "contract_id",
          label: "Matched Contract",
          type: "changed",
          before: existing.contract_id,
          after: matchedContractId,
          format: "text",
        });
      }

      await tx.$executeRaw(Prisma.sql`
        UPDATE public.leave_transactions
        SET
          leave_type = ${data.leaveType},
          start_date = ${toDate(data.startDate)}::date,
          end_date = ${toDate(data.endDate)}::date,
          return_to_work_date = ${toDate(data.returnToWorkDate)}::date,
          leave_days = ${requestedDays},
          contract_id = ${matchedContractId}::uuid,
          status = ${normalizedStatus},
          notes = ${nextNotes || null},
          updated_by = ${actorUserId ?? null}::uuid,
          updated_at = now()
        WHERE id::text = ${data.id}
      `);

      return {
        id: existing.id,
        employeeId: existing.employee_id,
        contractId: matchedContractId,
        previousContractId,
        employeeName: existing.employee_name || "Employee",
        beforeLeaveType: existing.leave_type,
        afterLeaveType: data.leaveType,
        changes,
        matchedContractLabel: formatMatchedContractLabel(matched.contract),
        matchedContractPeriod: `${matched.contract.startDate} – ${matched.contract.endDate}`,
        matchedContractYear: matched.contractYear
          ? `Year ${matched.contractYear.yearNumber}: ${matched.contractYear.startDate} – ${matched.contractYear.endDate}`
          : null,
        historicalMatch: matched.isHistorical,
      };
    });

    if (result.previousContractId && result.previousContractId !== result.contractId) {
      await syncLeaveYearBalances(result.employeeId, result.previousContractId, actorUserId);
    }
    await syncLeaveYearBalances(result.employeeId, result.contractId, actorUserId);

    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "edited_leave_record",
      targetType: "leave",
      targetId: result.id,
      targetLabel: `Leave: ${result.employeeName} - ${getLeaveTypeLabel(result.afterLeaveType)}`,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        matchedContractId: result.contractId,
        matchedContractLabel: result.matchedContractLabel,
        matchedContractPeriod: result.matchedContractPeriod,
        matchedContractYear: result.matchedContractYear,
        historicalMatch: result.historicalMatch,
        changes: result.changes,
      },
    });

    revalidatePath("/leave");
    revalidatePath(`/leave/employee/${result.employeeId}`);
    revalidatePath(`/leave/employee/${result.employeeId}/transactions`);
    revalidatePath(`/leave/transactions/${result.id}/edit`);
    revalidatePath("/");
    return { success: true, message: "Leave record updated successfully.", employeeId: result.employeeId };
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message
        ? error.message
        : "Failed to update leave record. Please try again.";
    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "edited_leave_record",
      targetType: "leave",
      targetId: data.id || null,
      targetLabel: "Leave: attempted edit",
      success: false,
      failureReason,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: failureReason };
  }
}

export async function deleteLeaveTransactionAction(
  leaveTransactionId: string,
): Promise<LeaveMutationResult> {
  await assertViewerCannotMutateOrThrow();
  await ensureLeaveInfrastructure();
  const actorSession = await getSession();
  const actorUser = actorSession.user;
  if (!actorUser?.userId) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  if (!canPerformAction(actorUser.role ?? null, "leave.delete")) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = actorUser?.userId ?? null;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existingRows = await tx.$queryRaw<
        Array<{
          id: string;
          employee_id: string;
          contract_id: string | null;
          leave_type: string;
          start_date: Date;
          end_date: Date;
          return_to_work_date: Date;
          leave_days: number;
          status: string | null;
          notes: string | null;
          employee_name: string;
        }>
      >(Prisma.sql`
        SELECT
          lt.id::text AS id,
          lt.employee_id::text AS employee_id,
          lt.contract_id::text AS contract_id,
          lt.leave_type,
          lt.start_date,
          lt.end_date,
          lt.return_to_work_date,
          lt.leave_days::numeric::float8 AS leave_days,
          lt.status,
          lt.notes,
          trim(e.first_name || ' ' || e.last_name) AS employee_name
        FROM public.leave_transactions lt
        JOIN public.employees e
          ON e.id = lt.employee_id
        WHERE lt.id::text = ${leaveTransactionId}
        LIMIT 1
      `);
      const existing = existingRows[0];
      if (!existing) throw new Error("Leave record not found.");

      await tx.$executeRaw(Prisma.sql`
        DELETE FROM public.leave_transactions
        WHERE id::text = ${leaveTransactionId}
      `);

      return existing;
    });

    await syncLeaveBalancesForEmployeeContracts(result.employee_id, result.contract_id, actorUserId);

    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "deleted_leave_record",
      targetType: "leave",
      targetId: result.id,
      targetLabel: `Leave: ${result.employee_name} - ${getLeaveTypeLabel(result.leave_type)}`,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        deletedRecord: {
          leaveType: result.leave_type,
          startDate: formatIsoDate(result.start_date),
          endDate: formatIsoDate(result.end_date),
          returnToWorkDate: formatIsoDate(result.return_to_work_date),
          leaveDays: Math.round(Number(result.leave_days ?? 0)),
          status: normalizeLeaveStatus(result.status ?? "recorded"),
          notes: result.notes?.trim() || null,
        },
      },
    });

    revalidatePath("/leave");
    revalidatePath(`/leave/employee/${result.employee_id}`);
    revalidatePath(`/leave/employee/${result.employee_id}/transactions`);
    revalidatePath("/");
    return { success: true, message: "Leave record deleted successfully.", employeeId: result.employee_id };
  } catch (error) {
    const failureReason =
      error instanceof Error && error.message
        ? error.message
        : "Failed to delete leave record. Please try again.";
    await createSystemAuditLog({
      actorUserId,
      actorEmail: actorUser?.email ?? null,
      actorName: actorUser?.name ?? null,
      module: "Leave",
      action: "deleted_leave_record",
      targetType: "leave",
      targetId: leaveTransactionId || null,
      targetLabel: "Leave: attempted delete",
      success: false,
      failureReason,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: failureReason };
  }
}
