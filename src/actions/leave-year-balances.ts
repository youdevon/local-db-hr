"use server";

import { revalidatePath } from "next/cache";

import { assertViewerCannotMutateOrThrow, requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getSession } from "@/lib/get-session";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import {
  adjustLeaveYearBalance,
  formatLeaveBalanceTargetLabel,
  lockLeaveYearBalance,
  unlockLeaveYearBalance,
} from "@/lib/server/leave-year-balances";

type ActionResult = { success: boolean; message: string };

async function getActor() {
  const session = await getSession();
  return session.user ?? null;
}

export async function adjustLeaveYearBalanceAction(input: {
  balanceId: string;
  adjustment: number;
  reason: string;
  employeeId: string;
  employeeName: string;
}): Promise<ActionResult> {
  await assertViewerCannotMutateOrThrow();
  const auth = await requirePermission("leave.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  if (!input.balanceId?.trim() || !input.reason?.trim()) {
    return { success: false, message: "Adjustment amount and reason are required." };
  }

  const updated = await adjustLeaveYearBalance(
    input.balanceId,
    input.adjustment,
    input.reason,
    actor?.userId ?? null,
  );
  if (!updated) return { success: false, message: "Failed to adjust leave balance. Please try again." };

  const targetLabel = formatLeaveBalanceTargetLabel({
    employeeName: input.employeeName,
    contractYearNumber: updated.after.contract_year_number,
    leaveType: updated.after.leave_type,
  });
  await createSystemAuditLog({
    actorUserId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorName: actor?.name ?? null,
    module: "Leave",
    action: "adjusted_leave_balance",
    targetType: "leave_balance",
    targetId: updated.after.id,
    targetLabel,
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    metadata: {
      contract_id: updated.after.contract_id,
      contract_year_number: updated.after.contract_year_number,
      leave_type: updated.after.leave_type,
      before_adjustment: updated.before.adjustment,
      after_adjustment: updated.after.adjustment,
      adjustment_reason: updated.after.adjustment_reason,
      before_remaining: updated.before.remaining,
      after_remaining: updated.after.remaining,
    },
  });
  revalidatePath(`/leave/employee/${input.employeeId}`);
  revalidatePath("/leave");
  return { success: true, message: "Leave balance adjusted successfully." };
}

export async function lockLeaveYearBalanceAction(input: {
  balanceId: string;
  employeeId: string;
  employeeName: string;
  contractYearNumber: number;
  leaveType: string;
}): Promise<ActionResult> {
  await assertViewerCannotMutateOrThrow();
  const auth = await requirePermission("leave.delete");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const ok = await lockLeaveYearBalance(input.balanceId, actor?.userId ?? null);
  if (!ok) return { success: false, message: "Failed to lock leave balance. Please try again." };

  await createSystemAuditLog({
    actorUserId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorName: actor?.name ?? null,
    module: "Leave",
    action: "locked_leave_balance",
    targetType: "leave_balance",
    targetId: input.balanceId,
    targetLabel: formatLeaveBalanceTargetLabel({
      employeeName: input.employeeName,
      contractYearNumber: input.contractYearNumber,
      leaveType: input.leaveType,
    }),
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  revalidatePath(`/leave/employee/${input.employeeId}`);
  return { success: true, message: "Leave balance locked successfully." };
}

export async function unlockLeaveYearBalanceAction(input: {
  balanceId: string;
  employeeId: string;
  employeeName: string;
  contractYearNumber: number;
  leaveType: string;
}): Promise<ActionResult> {
  await assertViewerCannotMutateOrThrow();
  const auth = await requirePermission("leave.delete");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const actor = await getActor();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const ok = await unlockLeaveYearBalance(input.balanceId, actor?.userId ?? null);
  if (!ok) return { success: false, message: "Failed to unlock leave balance. Please try again." };

  await createSystemAuditLog({
    actorUserId: actor?.userId ?? null,
    actorEmail: actor?.email ?? null,
    actorName: actor?.name ?? null,
    module: "Leave",
    action: "unlocked_leave_balance",
    targetType: "leave_balance",
    targetId: input.balanceId,
    targetLabel: formatLeaveBalanceTargetLabel({
      employeeName: input.employeeName,
      contractYearNumber: input.contractYearNumber,
      leaveType: input.leaveType,
    }),
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
  });
  revalidatePath(`/leave/employee/${input.employeeId}`);
  return { success: true, message: "Leave balance unlocked successfully." };
}
