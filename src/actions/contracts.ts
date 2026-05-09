"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { assertViewerCannotMutateOrThrow, getSessionUserId, requirePermission } from "@/lib/auth-server";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { sendHrNotification } from "@/lib/email/hr-notifications";
import { buildNewContractRecordedTemplate, buildSimpleHrTemplate } from "@/lib/email/templates";
import { prisma } from "@/lib/prisma";
import { syncLeaveYearBalances } from "@/lib/server/leave-year-balances";
import {
  calculateRecommendedRetirementContractEndDate,
  doesContractExceedRetirementCutoff,
} from "@/lib/retirement-policy";
import { getRetirementAgePolicySettings } from "@/lib/retirement-policy-settings";
import { contractFormSchema, type ContractFormValues } from "@/lib/validators/contract-form";

type ContractActionResult =
  | { success: true; message: string; contractId: string }
  | { success: false; message: string };

export type DeleteContractResult =
  | { success: true; message: "Contract deleted successfully."; employeeId: string | null }
  | { success: false; message: string };

type AuditChange = {
  field: string;
  label: string;
  type: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
  format?: "text" | "currency" | "date" | "number" | "boolean" | "allowance";
};

class ContractCreateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContractCreateError";
  }
}

function parseDateOrNull(value?: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replaceAll(" ", "_");
}

function normalizeAllowanceType(allowanceType: string): string {
  return allowanceType.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function normalizeFrequency(frequency?: string): string {
  if (!frequency?.trim()) return "monthly";
  return frequency.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
}

function hasAllowanceRowContent(
  allowance: ContractFormValues["allowances"][number],
): boolean {
  const amountText =
    allowance.amount === "" || allowance.amount === null || allowance.amount === undefined
      ? ""
      : String(allowance.amount);
  return Boolean(
    allowance.allowanceType?.trim() ||
      allowance.description?.trim() ||
      amountText.trim() ||
      allowance.frequency?.trim() ||
      allowance.startDate?.trim() ||
      allowance.endDate?.trim() ||
      allowance.notes?.trim(),
  );
}

function areAllowanceRowsEqual(
  before: {
    allowance_type: string;
    description: string | null;
    amount: number;
    frequency: string;
    start_date: Date | null;
    end_date: Date | null;
    taxable: boolean;
    notes: string | null;
  },
  after: {
    allowanceType: string;
    description: string | null;
    amount: number;
    frequency: string;
    startDate: string | null;
    endDate: string | null;
    taxable: boolean;
    notes: string | null;
  },
): boolean {
  const beforeStart = before.start_date ? before.start_date.toISOString().slice(0, 10) : null;
  const beforeEnd = before.end_date ? before.end_date.toISOString().slice(0, 10) : null;
  return (
    before.allowance_type === after.allowanceType &&
    (before.description ?? null) === (after.description ?? null) &&
    Number(before.amount) === Number(after.amount) &&
    before.frequency === after.frequency &&
    beforeStart === after.startDate &&
    beforeEnd === after.endDate &&
    Boolean(before.taxable) === Boolean(after.taxable) &&
    (before.notes ?? null) === (after.notes ?? null)
  );
}

function buildOverlapWhere(employeeId: string, startDate: Date, endDate: Date, excludeContractId?: string) {
  return {
    employee_id: employeeId,
    start_date: { lte: endDate },
    // effective_end_date fallback: schema currently only has end_date.
    end_date: { gte: startDate },
    ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
  } as const;
}

function parseContractInput(input: ContractFormValues): {
  ok: true;
  data: {
    employeeId: string;
    minuteNumber: string | null;
    contractNumber: string | null;
    startDate: Date;
    endDate: Date;
    dateReceived: Date | null;
    dateSigned: Date | null;
    status: string;
    notes: string | null;
      retirementOverrideReason: string | null;
      retirementOverrideApprovalReference: string | null;
      retirementOverrideConfirmed: boolean;
    salary: number;
    gratuity: number;
    vacationLeaveEntitlement: number;
    sickLeaveEntitlement: number;
    vacationRolloverAllowed: boolean;
    sickRolloverAllowed: boolean;
    allowancesToInsert: Array<{
      allowance_type: string;
      description: string | null;
      amount: number;
      frequency: string;
      start_date: Date | null;
      end_date: Date | null;
      taxable: boolean;
      notes: string | null;
    }>;
    allowancesForDiff: Array<{
      aid: string | null;
      allowanceType: string;
      description: string | null;
      amount: number;
      frequency: string;
      startDate: string | null;
      endDate: string | null;
      taxable: boolean;
      notes: string | null;
    }>;
    rawAllowances: ContractFormValues["allowances"];
    allowancesChanged: boolean;
    allowanceStrategy: "replace" | "preserve";
  };
} | { ok: false; message: string } {
  const parsed = contractFormSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Please complete all required contract fields." };

  const data = parsed.data;
  if (!data.employeeId.trim()) {
    return { ok: false, message: "Please select an employee for this contract." };
  }
  if (!data.startDate || !data.endDate || data.endDate < data.startDate) {
    return { ok: false, message: "Contract end date must be after the start date." };
  }
  if (data.dateReceived && data.dateSigned && data.dateSigned < data.dateReceived) {
    return { ok: false, message: "Date employee signed contract cannot be before date employee received contract." };
  }

  const contractNumber = data.noAssignedContractNumber ? null : data.contractNumber?.trim() || "";
  if (!data.noAssignedContractNumber && !contractNumber) {
    return { ok: false, message: "Please complete all required contract fields." };
  }

  const startDate = parseDateOrNull(data.startDate);
  const endDate = parseDateOrNull(data.endDate);
  const dateReceived = parseDateOrNull(data.dateReceived);
  const dateSigned = parseDateOrNull(data.dateSigned);
  if (!startDate || !endDate) {
    return { ok: false, message: "Contract end date must be after the start date." };
  }

  const allowanceRows = Array.isArray(data.allowances) ? data.allowances : [];
  const allowancesChanged = Boolean(data.allowancesChanged);
  if (!allowancesChanged) {
    return {
      ok: true,
      data: {
        employeeId: data.employeeId,
        minuteNumber: data.minuteNumber?.trim() || null,
        contractNumber: contractNumber || null,
        startDate,
        endDate,
        dateReceived,
        dateSigned,
        status: normalizeStatus(data.status),
        notes: data.notes?.trim() || null,
        retirementOverrideReason: data.retirementOverrideReason?.trim() || null,
        retirementOverrideApprovalReference: data.retirementOverrideApprovalReference?.trim() || null,
        retirementOverrideConfirmed: Boolean(data.retirementOverrideConfirmed),
        salary: Number(data.salary),
        gratuity: data.gratuity === "" ? 0 : Number(data.gratuity),
        vacationLeaveEntitlement: Number(data.vacationLeaveEntitlement),
        sickLeaveEntitlement: Number(data.sickLeaveEntitlement),
        vacationRolloverAllowed: Boolean(data.vacationRolloverAllowed),
        sickRolloverAllowed: Boolean(data.sickRolloverAllowed),
        allowancesToInsert: [],
        allowancesForDiff: [],
        rawAllowances: allowanceRows,
        allowancesChanged: false,
        allowanceStrategy: "preserve",
      },
    };
  }

  const hasAnyAllowanceContent = allowanceRows.some(hasAllowanceRowContent);
  if (!hasAnyAllowanceContent) {
    return {
      ok: true,
      data: {
        employeeId: data.employeeId,
        minuteNumber: data.minuteNumber?.trim() || null,
        contractNumber: contractNumber || null,
        startDate,
        endDate,
        dateReceived,
        dateSigned,
        status: normalizeStatus(data.status),
        notes: data.notes?.trim() || null,
        retirementOverrideReason: data.retirementOverrideReason?.trim() || null,
        retirementOverrideApprovalReference: data.retirementOverrideApprovalReference?.trim() || null,
        retirementOverrideConfirmed: Boolean(data.retirementOverrideConfirmed),
        salary: Number(data.salary),
        gratuity: data.gratuity === "" ? 0 : Number(data.gratuity),
        vacationLeaveEntitlement: Number(data.vacationLeaveEntitlement),
        sickLeaveEntitlement: Number(data.sickLeaveEntitlement),
        vacationRolloverAllowed: Boolean(data.vacationRolloverAllowed),
        sickRolloverAllowed: Boolean(data.sickRolloverAllowed),
        allowancesToInsert: [],
        allowancesForDiff: [],
        rawAllowances: allowanceRows,
        allowancesChanged: true,
        allowanceStrategy: "preserve",
      },
    };
  }

  const partialAllowance = allowanceRows.find((allowance) => {
    if (!hasAllowanceRowContent(allowance)) return false;
    const hasType = allowance.allowanceType !== "";
    const hasAmount = allowance.amount !== "";
    return hasType !== hasAmount;
  });
  if (partialAllowance) {
    return { ok: false, message: "Please review the allowance details." };
  }

  const allowancesToInsert = allowanceRows
    .filter((allowance) => allowance.allowanceType !== "" && allowance.amount !== "")
    .map((allowance) => ({
      allowance_type: normalizeAllowanceType(allowance.allowanceType),
      description: allowance.description?.trim() || null,
      amount: Number(allowance.amount),
      frequency: normalizeFrequency(allowance.frequency),
      start_date: parseDateOrNull(allowance.startDate),
      end_date: parseDateOrNull(allowance.endDate),
      taxable: Boolean(allowance.taxable),
      notes: allowance.notes?.trim() || null,
    }));
  const allowancesForDiff = allowanceRows
    .filter((allowance) => allowance.allowanceType !== "" && allowance.amount !== "")
    .map((allowance) => ({
      aid: allowance.aid?.trim() || null,
      allowanceType: normalizeAllowanceType(allowance.allowanceType),
      description: allowance.description?.trim() || null,
      amount: Number(allowance.amount),
      frequency: normalizeFrequency(allowance.frequency),
      startDate: allowance.startDate?.trim() || null,
      endDate: allowance.endDate?.trim() || null,
      taxable: Boolean(allowance.taxable),
      notes: allowance.notes?.trim() || null,
    }));

  return {
    ok: true,
    data: {
      employeeId: data.employeeId,
      minuteNumber: data.minuteNumber?.trim() || null,
      contractNumber: contractNumber || null,
      startDate,
      endDate,
      dateReceived,
      dateSigned,
      status: normalizeStatus(data.status),
      notes: data.notes?.trim() || null,
      retirementOverrideReason: data.retirementOverrideReason?.trim() || null,
      retirementOverrideApprovalReference: data.retirementOverrideApprovalReference?.trim() || null,
      retirementOverrideConfirmed: Boolean(data.retirementOverrideConfirmed),
      salary: Number(data.salary),
      gratuity: data.gratuity === "" ? 0 : Number(data.gratuity),
      vacationLeaveEntitlement: Number(data.vacationLeaveEntitlement),
      sickLeaveEntitlement: Number(data.sickLeaveEntitlement),
      vacationRolloverAllowed: Boolean(data.vacationRolloverAllowed),
      sickRolloverAllowed: Boolean(data.sickRolloverAllowed),
      allowancesToInsert,
      allowancesForDiff,
      rawAllowances: allowanceRows,
      allowancesChanged: true,
      allowanceStrategy: allowanceRows.length === 0 || hasAnyAllowanceContent ? "replace" : "preserve",
    },
  };
}

export async function createContractAction(input: ContractFormValues): Promise<ContractActionResult> {
  await assertViewerCannotMutateOrThrow();
  const access = await requirePermission("contracts.create");
  if (!access) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const parsedInput = parseContractInput(input);
  if (!parsedInput.ok) {
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "created_contract",
      targetType: "contract",
      success: false,
      failureReason: parsedInput.message,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: parsedInput.message };
  }

  const { data } = parsedInput;
  const retirementPolicy = await getRetirementAgePolicySettings();
  const targetLabel = data.contractNumber
    ? `Contract: ${data.contractNumber}`
    : `Contract for Employee ID: ${data.employeeId}`;

  try {
    const created = await prisma.$transaction(async (tx) => {
      const employee = await tx.employees.findUnique({
        where: { id: data.employeeId },
        select: { id: true, date_of_birth: true },
      });
      if (!employee) {
        throw new ContractCreateError("Please select an employee for this contract.");
      }
      const employeeDobIso = employee.date_of_birth
        ? employee.date_of_birth.toISOString().slice(0, 10)
        : "";
      const retirementCutoffDate =
        retirementPolicy.enforceRetirementCheck && employeeDobIso
          ? calculateRecommendedRetirementContractEndDate(employeeDobIso, retirementPolicy.retirementAge)
          : null;
      const requiresRetirementOverride =
        retirementPolicy.enforceRetirementCheck &&
        employeeDobIso !== "" &&
        doesContractExceedRetirementCutoff(data.endDate.toISOString().slice(0, 10), retirementCutoffDate);

      if (requiresRetirementOverride && !retirementPolicy.allowOverride) {
        throw new ContractCreateError("Contract cannot extend beyond the configured retirement age.");
      }
      if (
        requiresRetirementOverride &&
        ((retirementPolicy.requireOverrideReason && !data.retirementOverrideReason) ||
          (retirementPolicy.requireApprovalReference && !data.retirementOverrideApprovalReference) ||
          !data.retirementOverrideConfirmed)
      ) {
        throw new ContractCreateError("Retirement age override details are required.");
      }

      const overlapping = await tx.contracts.findFirst({
        where: buildOverlapWhere(data.employeeId, data.startDate, data.endDate),
        select: { id: true },
      });
      if (overlapping) {
        throw new ContractCreateError("Contract period overlaps with an existing contract for this employee.");
      }

      if (data.contractNumber) {
        const duplicate = await tx.contracts.findFirst({
          where: { contract_number: { equals: data.contractNumber, mode: "insensitive" } },
          select: { id: true },
        });
        if (duplicate) {
          throw new ContractCreateError("Contract number already exists. Please use a unique contract number.");
        }
      }

      const contract = await tx.contracts.create({
        data: {
          employee_id: data.employeeId,
          minute_number: data.minuteNumber,
          contract_number: data.contractNumber,
          start_date: data.startDate,
          end_date: data.endDate,
          date_received: data.dateReceived,
          date_signed: data.dateSigned,
          salary: data.salary,
          gratuity: data.gratuity,
          vacation_leave_entitlement: data.vacationLeaveEntitlement,
          sick_leave_entitlement: data.sickLeaveEntitlement,
          vacation_rollover_allowed: data.vacationRolloverAllowed,
          sick_rollover_allowed: data.sickRolloverAllowed,
          status: data.status,
          notes: data.notes,
          retirement_override_required: requiresRetirementOverride,
          retirement_override_reason: requiresRetirementOverride ? data.retirementOverrideReason : null,
          retirement_override_approval_reference: requiresRetirementOverride
            ? data.retirementOverrideApprovalReference
            : null,
          retirement_cutoff_date: requiresRetirementOverride && retirementCutoffDate
            ? new Date(`${retirementCutoffDate}T00:00:00`)
            : null,
        },
        select: { id: true },
      });

      if (process.env.NODE_ENV !== "production") {
        console.log("Contract allowances received:", data.allowancesToInsert.length);
      }

      if (data.allowancesToInsert.length > 0) {
        await tx.contract_allowances.createMany({
          data: data.allowancesToInsert.map((allowance) => ({
            contract_id: contract.id,
            ...allowance,
          })),
        });
      }

      if (process.env.NODE_ENV !== "production") {
        console.log("Contract allowances inserted:", data.allowancesToInsert.length);
        console.log("Contract id for allowances:", contract.id);
      }

      return { contract, requiresRetirementOverride, retirementCutoffDate };
    });

    if (process.env.NODE_ENV !== "production") {
      console.log("Created contract id:", created.contract.id);
    }

    revalidatePath("/contracts");
    revalidatePath("/contracts/directory");
    revalidatePath(`/contracts/${created.contract.id}`);
    revalidatePath(`/employees/${data.employeeId}`);
    revalidatePath("/");
    await syncLeaveYearBalances(data.employeeId, created.contract.id, actorUserId);
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: created.requiresRetirementOverride ? "created_contract_with_retirement_override" : "created_contract",
      targetType: "contract",
      targetId: created.contract.id,
      targetLabel,
      success: true,
      metadata: created.requiresRetirementOverride
        ? {
            retirementAge: retirementPolicy.retirementAge,
            retirementCutoffDate: created.retirementCutoffDate,
            contractEndDate: data.endDate.toISOString().slice(0, 10),
            overrideApprovalReference: data.retirementOverrideApprovalReference,
          }
        : undefined,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    const employeeContact = await prisma.employees.findUnique({
      where: { id: data.employeeId },
      select: { first_name: true, last_name: true, position: true },
    });
    const employeeName = `${employeeContact?.first_name ?? ""} ${employeeContact?.last_name ?? ""}`.trim() || "Employee";
    const contractTemplate = buildNewContractRecordedTemplate({
      employeeName,
      contractNumber: data.contractNumber ?? "Not assigned",
      position: employeeContact?.position?.trim() || "Not specified",
      startDate: data.startDate.toISOString().slice(0, 10),
      endDate: data.endDate.toISOString().slice(0, 10),
    });
    await sendHrNotification({
      notificationType: "contract_created",
      settingKey: "sendNewContractAlerts",
      employeeId: data.employeeId,
      contractId: created.contract.id,
      ...contractTemplate,
      metadata: {
        employeeId: data.employeeId,
        employeeName,
        contractId: created.contract.id,
        contractNumber: data.contractNumber,
        position: employeeContact?.position?.trim() || null,
        startDate: data.startDate.toISOString().slice(0, 10),
        endDate: data.endDate.toISOString().slice(0, 10),
      },
    });

    return { success: true, message: "Contract created successfully.", contractId: created.contract.id };
  } catch (error) {
    let failureMessage = "Failed to create contract. Please try again.";
    if (error instanceof ContractCreateError) {
      failureMessage = error.message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      failureMessage = "Contract number already exists. Please use a unique contract number.";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
      failureMessage = "Please review the allowance details.";
    } else if (data.allowancesToInsert.length > 0) {
      failureMessage = "Failed to save contract allowances. Please try again.";
    }
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "created_contract",
      targetType: "contract",
      targetLabel,
      success: false,
      failureReason: failureMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: failureMessage };
  }
}

export async function updateContractAction(
  contractId: string,
  input: ContractFormValues,
): Promise<ContractActionResult> {
  await assertViewerCannotMutateOrThrow();
  const access = await requirePermission("contracts.edit");
  if (!access) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }
  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const parsedInput = parseContractInput(input);
  if (!parsedInput.ok) {
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "edited_contract",
      targetType: "contract",
      targetId: contractId,
      success: false,
      failureReason: parsedInput.message,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: parsedInput.message };
  }

  const { data } = parsedInput;
  const retirementPolicy = await getRetirementAgePolicySettings();
  const targetLabel = data.contractNumber
    ? `Contract: ${data.contractNumber}`
    : `Contract for Employee ID: ${data.employeeId}`;

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.contracts.findUnique({
        where: { id: contractId },
        select: {
          id: true,
          minute_number: true,
          contract_number: true,
          start_date: true,
          end_date: true,
          date_received: true,
          date_signed: true,
          salary: true,
          gratuity: true,
          vacation_leave_entitlement: true,
          sick_leave_entitlement: true,
          status: true,
          notes: true,
          contract_allowances: {
            select: {
              id: true,
              allowance_type: true,
              description: true,
              amount: true,
              frequency: true,
              start_date: true,
              end_date: true,
              taxable: true,
              notes: true,
            },
          },
        },
      });
      if (!existing) {
        throw new ContractCreateError("Failed to update contract. Please try again.");
      }

      const employee = await tx.employees.findUnique({
        where: { id: data.employeeId },
        select: { id: true, date_of_birth: true },
      });
      if (!employee) {
        throw new ContractCreateError("Please select an employee for this contract.");
      }
      const employeeDobIso = employee.date_of_birth
        ? employee.date_of_birth.toISOString().slice(0, 10)
        : "";
      const retirementCutoffDate =
        retirementPolicy.enforceRetirementCheck && employeeDobIso
          ? calculateRecommendedRetirementContractEndDate(employeeDobIso, retirementPolicy.retirementAge)
          : null;
      const requiresRetirementOverride =
        retirementPolicy.enforceRetirementCheck &&
        employeeDobIso !== "" &&
        doesContractExceedRetirementCutoff(data.endDate.toISOString().slice(0, 10), retirementCutoffDate);

      if (requiresRetirementOverride && !retirementPolicy.allowOverride) {
        throw new ContractCreateError("Contract cannot extend beyond the configured retirement age.");
      }
      if (
        requiresRetirementOverride &&
        ((retirementPolicy.requireOverrideReason && !data.retirementOverrideReason) ||
          (retirementPolicy.requireApprovalReference && !data.retirementOverrideApprovalReference) ||
          !data.retirementOverrideConfirmed)
      ) {
        throw new ContractCreateError("Retirement age override details are required.");
      }

      const overlapping = await tx.contracts.findFirst({
        where: buildOverlapWhere(data.employeeId, data.startDate, data.endDate, contractId),
        select: { id: true },
      });
      if (overlapping) {
        throw new ContractCreateError("Contract period overlaps with an existing contract for this employee.");
      }

      if (data.contractNumber) {
        const duplicate = await tx.contracts.findFirst({
          where: {
            id: { not: contractId },
            contract_number: { equals: data.contractNumber, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (duplicate) {
          throw new ContractCreateError("Contract number already exists. Please use a unique contract number.");
        }
      }

      const changes: AuditChange[] = [];
      const beforeIso = {
        startDate: existing.start_date.toISOString().slice(0, 10),
        endDate: existing.end_date.toISOString().slice(0, 10),
        dateReceived: existing.date_received ? existing.date_received.toISOString().slice(0, 10) : null,
        dateSigned: existing.date_signed ? existing.date_signed.toISOString().slice(0, 10) : null,
      };
      if ((existing.minute_number ?? null) !== (data.minuteNumber ?? null)) {
        changes.push({
          field: "minute_number",
          label: "Minute Number",
          type: "changed",
          before: existing.minute_number,
          after: data.minuteNumber,
          format: "text",
        });
      }
      if ((existing.contract_number ?? null) !== (data.contractNumber ?? null)) {
        changes.push({
          field: "contract_number",
          label: "Contract Number",
          type: "changed",
          before: existing.contract_number,
          after: data.contractNumber,
          format: "text",
        });
      }
      if (beforeIso.startDate !== data.startDate.toISOString().slice(0, 10)) {
        changes.push({
          field: "start_date",
          label: "Start Date",
          type: "changed",
          before: beforeIso.startDate,
          after: data.startDate.toISOString().slice(0, 10),
          format: "date",
        });
      }
      if (beforeIso.endDate !== data.endDate.toISOString().slice(0, 10)) {
        changes.push({
          field: "end_date",
          label: "End Date",
          type: "changed",
          before: beforeIso.endDate,
          after: data.endDate.toISOString().slice(0, 10),
          format: "date",
        });
      }
      if (beforeIso.dateReceived !== (data.dateReceived ? data.dateReceived.toISOString().slice(0, 10) : null)) {
        changes.push({
          field: "date_received",
          label: "Date Received",
          type: "changed",
          before: beforeIso.dateReceived,
          after: data.dateReceived ? data.dateReceived.toISOString().slice(0, 10) : null,
          format: "date",
        });
      }
      if (beforeIso.dateSigned !== (data.dateSigned ? data.dateSigned.toISOString().slice(0, 10) : null)) {
        changes.push({
          field: "date_signed",
          label: "Date Signed",
          type: "changed",
          before: beforeIso.dateSigned,
          after: data.dateSigned ? data.dateSigned.toISOString().slice(0, 10) : null,
          format: "date",
        });
      }
      if (Number(existing.salary) !== Number(data.salary)) {
        changes.push({
          field: "salary",
          label: "Salary",
          type: "changed",
          before: Number(existing.salary),
          after: Number(data.salary),
          format: "currency",
        });
      }
      if (Number(existing.gratuity) !== Number(data.gratuity)) {
        changes.push({
          field: "gratuity",
          label: "Gratuity",
          type: "changed",
          before: Number(existing.gratuity),
          after: Number(data.gratuity),
          format: "currency",
        });
      }
      if (Number(existing.vacation_leave_entitlement) !== Number(data.vacationLeaveEntitlement)) {
        changes.push({
          field: "vacation_leave_entitlement",
          label: "Vacation Entitlement",
          type: "changed",
          before: Number(existing.vacation_leave_entitlement),
          after: Number(data.vacationLeaveEntitlement),
          format: "number",
        });
      }
      if (Number(existing.sick_leave_entitlement) !== Number(data.sickLeaveEntitlement)) {
        changes.push({
          field: "sick_leave_entitlement",
          label: "Sick Entitlement",
          type: "changed",
          before: Number(existing.sick_leave_entitlement),
          after: Number(data.sickLeaveEntitlement),
          format: "number",
        });
      }
      if ((existing.status ?? "") !== data.status) {
        changes.push({
          field: "status",
          label: "Status",
          type: "changed",
          before: existing.status,
          after: data.status,
          format: "text",
        });
      }
      if ((existing.notes ?? null) !== (data.notes ?? null)) {
        changes.push({
          field: "notes",
          label: "Notes",
          type: "changed",
          before: existing.notes,
          after: data.notes,
          format: "text",
        });
      }

      const contract = await tx.contracts.update({
        where: { id: contractId },
        data: {
          employee_id: data.employeeId,
          minute_number: data.minuteNumber,
          contract_number: data.contractNumber,
          start_date: data.startDate,
          end_date: data.endDate,
          date_received: data.dateReceived,
          date_signed: data.dateSigned,
          salary: data.salary,
          gratuity: data.gratuity,
          vacation_leave_entitlement: data.vacationLeaveEntitlement,
          sick_leave_entitlement: data.sickLeaveEntitlement,
          vacation_rollover_allowed: data.vacationRolloverAllowed,
          sick_rollover_allowed: data.sickRolloverAllowed,
          status: data.status,
          notes: data.notes,
          retirement_override_required: requiresRetirementOverride,
          retirement_override_reason: requiresRetirementOverride ? data.retirementOverrideReason : null,
          retirement_override_approval_reference: requiresRetirementOverride
            ? data.retirementOverrideApprovalReference
            : null,
          retirement_cutoff_date: requiresRetirementOverride && retirementCutoffDate
            ? new Date(`${retirementCutoffDate}T00:00:00`)
            : null,
        },
        select: { id: true },
      });

      if (data.allowanceStrategy === "replace") {
        const existingById = new Map(existing.contract_allowances.map((item) => [item.id, item]));
        const seenIds = new Set<string>();
        data.allowancesForDiff.forEach((allowance) => {
          if (allowance.aid && existingById.has(allowance.aid)) {
            seenIds.add(allowance.aid);
            const before = existingById.get(allowance.aid)!;

            const normalizedBefore = {
              allowance_type: before.allowance_type,
              description: before.description,
              amount: Number(before.amount),
              frequency: before.frequency,
              start_date: before.start_date,
              end_date: before.end_date,
              taxable: before.taxable,
              notes: before.notes,
            };

            const normalizedAllowance = {
              allowanceType: allowance.allowanceType,
              description: allowance.description,
              amount: Number(allowance.amount),
              frequency: allowance.frequency,
              startDate: allowance.startDate,
              endDate: allowance.endDate,
              taxable: allowance.taxable,
              notes: allowance.notes,
            };

            if (!areAllowanceRowsEqual(normalizedBefore, normalizedAllowance)) {
              changes.push({
                field: "allowances",
                label: "Allowance",
                type: "changed",
                before: {
                  allowanceType: before.allowance_type,
                  description: before.description,
                  amount: Number(before.amount),
                  frequency: before.frequency,
                  startDate: before.start_date ? before.start_date.toISOString().slice(0, 10) : null,
                  endDate: before.end_date ? before.end_date.toISOString().slice(0, 10) : null,
                  taxable: before.taxable,
                  notes: before.notes,
                },
                after: allowance,
                format: "allowance",
              });
            }
          } else {
            changes.push({
              field: "allowances",
              label: "Allowance",
              type: "added",
              after: allowance,
              format: "allowance",
            });
          }
        });
        existing.contract_allowances.forEach((before) => {
          if (!seenIds.has(before.id)) {
            changes.push({
              field: "allowances",
              label: "Allowance",
              type: "removed",
              before: {
                allowanceType: before.allowance_type,
                description: before.description,
                amount: Number(before.amount),
                frequency: before.frequency,
                startDate: before.start_date ? before.start_date.toISOString().slice(0, 10) : null,
                endDate: before.end_date ? before.end_date.toISOString().slice(0, 10) : null,
                taxable: before.taxable,
                notes: before.notes,
              },
              format: "allowance",
            });
          }
        });

        await tx.contract_allowances.deleteMany({ where: { contract_id: contractId } });

        if (process.env.NODE_ENV !== "production") {
          console.log("Contract allowances received:", data.allowancesToInsert.length);
        }

        if (data.allowancesToInsert.length > 0) {
          await tx.contract_allowances.createMany({
            data: data.allowancesToInsert.map((allowance) => ({
              contract_id: contractId,
              ...allowance,
            })),
          });
        }

        if (process.env.NODE_ENV !== "production") {
          console.log("Contract allowances inserted:", data.allowancesToInsert.length);
          console.log("Contract id for allowances:", contract.id);
        }
      }

      return {
        contract,
        requiresRetirementOverride,
        retirementCutoffDate,
        changes,
        beforeStatus: existing.status ?? null,
        afterStatus: data.status,
      };
    });

    revalidatePath("/contracts");
    revalidatePath("/contracts/directory");
    revalidatePath(`/contracts/${updated.contract.id}`);
    revalidatePath(`/contracts/${updated.contract.id}/edit`);
    revalidatePath(`/employees/${data.employeeId}`);
    revalidatePath("/");
    await syncLeaveYearBalances(data.employeeId, updated.contract.id, actorUserId);
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: updated.requiresRetirementOverride ? "edited_contract_with_retirement_override" : "edited_contract",
      targetType: "contract",
      targetId: updated.contract.id,
      targetLabel,
      success: true,
      metadata: updated.requiresRetirementOverride
        ? {
            retirementAge: retirementPolicy.retirementAge,
            retirementCutoffDate: updated.retirementCutoffDate,
            contractEndDate: data.endDate.toISOString().slice(0, 10),
            overrideApprovalReference: data.retirementOverrideApprovalReference,
            changes: updated.changes,
          }
        : updated.changes.length > 0
          ? {
              changes: updated.changes,
            }
          : undefined,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    const normalizedBeforeStatus = (updated.beforeStatus ?? "").trim().toLowerCase();
    const normalizedAfterStatus = (updated.afterStatus ?? "").trim().toLowerCase();
    const terminatedTransition =
      normalizedAfterStatus === "terminated" && normalizedBeforeStatus !== "terminated";

    await sendHrNotification({
      notificationType: terminatedTransition ? "contract_terminated" : "contract_updated",
      settingKey: "sendContractUpdatedAlerts",
      employeeId: data.employeeId,
      contractId: updated.contract.id,
      subject: terminatedTransition ? "Contract Terminated" : "Contract Updated",
      text: buildSimpleHrTemplate({
        lines: [
          terminatedTransition ? "A contract has been terminated." : "A contract has been updated.",
          `Contract number: ${data.contractNumber ?? "Not assigned"}`,
          `Start date: ${data.startDate.toISOString().slice(0, 10)}`,
          `End date: ${data.endDate.toISOString().slice(0, 10)}`,
          `Status: ${data.status}`,
        ],
      }),
      metadata: {
        employeeId: data.employeeId,
        contractId: updated.contract.id,
        beforeStatus: updated.beforeStatus,
        afterStatus: updated.afterStatus,
        changedFields: updated.changes.map((c) => c.field),
      },
    });

    return { success: true, message: "Contract updated successfully.", contractId: updated.contract.id };
  } catch (error) {
    let failureMessage = "Failed to update contract. Please try again.";
    if (error instanceof ContractCreateError) {
      failureMessage = error.message;
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      failureMessage = "Contract number already exists. Please use a unique contract number.";
    } else if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2004") {
      failureMessage = "Please review the allowance details.";
    } else if (data.allowanceStrategy === "replace" && data.allowancesToInsert.length > 0) {
      failureMessage = "Failed to save contract allowances. Please review the allowance details.";
    }
    if (data.allowanceStrategy === "replace") {
      console.error("[contract edit] allowance save failed", {
        contractId,
        allowancesChanged: data.allowancesChanged,
        rawAllowances: data.rawAllowances,
        validAllowances: data.allowancesToInsert,
        error: error instanceof Error ? error.message : String(error),
      });
    }
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "edited_contract",
      targetType: "contract",
      targetId: contractId,
      targetLabel,
      success: false,
      failureReason: failureMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    return { success: false, message: failureMessage };
  }
}

export async function deleteContractAction(contractId: string): Promise<DeleteContractResult> {
  await assertViewerCannotMutateOrThrow();
  const access = await requirePermission("contracts.delete");
  if (!access) {
    return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  }

  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    const contract = await prisma.contracts.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        employee_id: true,
        contract_number: true,
        minute_number: true,
      },
    });

    if (!contract) {
      return { success: false, message: "Contract not found." };
    }

    const targetLabel = contract.contract_number
      ? `Contract: ${contract.contract_number}`
      : `Contract: ${contract.minute_number ?? contract.id}`;

    const deletedCounts = await prisma.$transaction(async (tx) => {
      const deletedLeaveTransactions = await tx.leave_transactions.deleteMany({
        where: { contract_id: contractId },
      });
      const deletedLeaveYearBalances = await tx.leave_year_balances.deleteMany({
        where: { contract_id: contractId },
      });
      const deletedAllowances = await tx.contract_allowances.deleteMany({
        where: { contract_id: contractId },
      });
      await tx.contracts.delete({
        where: { id: contractId },
      });

      return {
        leaveTransactions: deletedLeaveTransactions.count,
        leaveYearBalances: deletedLeaveYearBalances.count,
        contractAllowances: deletedAllowances.count,
      };
    });

    revalidatePath("/contracts");
    revalidatePath("/contracts/directory");
    revalidatePath(`/contracts/${contractId}`);
    revalidatePath(`/contracts/employee/${contract.employee_id}`);
    revalidatePath(`/employees/${contract.employee_id}`);
    revalidatePath("/");

    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "deleted_contract",
      targetType: "contract",
      targetId: contractId,
      targetLabel,
      success: true,
      metadata: deletedCounts,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    return {
      success: true,
      message: "Contract deleted successfully.",
      employeeId: contract.employee_id ?? null,
    };
  } catch (error) {
    const failureMessage = "Failed to delete contract. Please try again.";
    await createSystemAuditLog({
      actorUserId,
      module: "Contracts",
      action: "deleted_contract",
      targetType: "contract",
      targetId: contractId,
      success: false,
      failureReason: failureMessage,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    console.error("[contracts:delete] failed", error);
    return { success: false, message: failureMessage };
  }
}
