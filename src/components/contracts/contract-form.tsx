"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useFieldArray, useForm, type SubmitErrorHandler } from "react-hook-form";
import { useRouter } from "next/navigation";

import { createContractAction, updateContractAction } from "@/actions/contracts";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ALLOWANCE_FREQUENCY_OPTIONS,
  ALLOWANCE_TYPE_OPTIONS,
  CONTRACT_STATUS_OPTIONS,
  formatCurrencyTTD,
  type ContractRecord,
} from "@/lib/mock/contracts";
import { getFullName, type EmployeeRecord } from "@/lib/mock/employees";
import { notifyError, notifySuccess } from "@/lib/notify";
import { contractFormSchema, type ContractFormValues } from "@/lib/validators/contract-form";
import { cn } from "@/lib/utils";
import {
  calculateGratuity,
  contractMonthsBetween,
  defaultGratuitySettings,
  loadGratuitySettings,
} from "@/lib/gratuity-settings";
import {
  calculateContractEndDate,
  contractEndDateMatchesPeriod,
} from "@/lib/contract-dates";
import {
  calculateRecommendedRetirementContractEndDate,
  doesContractExceedRetirementCutoff,
  type RetirementAgePolicy,
} from "@/lib/retirement-policy";

const floatingCard =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";
const selectClass =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

function formatContractDate(value: string | Date | null | undefined): string {
  if (!value) return "—";

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function newAllowanceRow(): ContractFormValues["allowances"][number] {
  const aid =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `aid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return {
    aid,
    allowanceType: "",
    description: "",
    amount: "",
    frequency: "",
    startDate: "",
    endDate: "",
    taxable: false,
    notes: "",
  };
}

function toAllowanceTypeDisplay(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replaceAll("-", "_") ?? "";
  const map: Record<string, string> = {
    travelling: "Travelling",
    professional: "Professional",
    housing: "Housing",
    acting: "Acting",
    duty: "Duty",
    telephone: "Telephone",
    meal: "Meal",
    other: "Other",
  };
  return map[normalized] ?? "";
}

function toFrequencyDisplay(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase().replaceAll("-", "_") ?? "";
  const map: Record<string, string> = {
    monthly: "Monthly",
    one_time: "One-time",
    quarterly: "Quarterly",
    annually: "Annually",
    per_duty: "Per duty",
    other: "Other",
  };
  return map[normalized] ?? "";
}

function toDefaultValues(contract?: ContractRecord): ContractFormValues {
  if (contract) {
      return {
        employeeId: contract.employeeId,
        minuteNumber: contract.minuteNumber ?? "",
        noAssignedContractNumber: contract.contractNumber === null || contract.contractNumber.startsWith("UNASSIGNED-"),
        contractNumber:
          contract.contractNumber && !contract.contractNumber.startsWith("UNASSIGNED-")
            ? contract.contractNumber
            : "",
        durationPreset: "custom",
        customDurationMonths: Math.max(1, Math.round(contractMonthsBetween(contract.startDate, contract.endDate))),
        manualEndDateOverride: false,
        startDate: contract.startDate,
        endDate: contract.endDate,
        dateReceived: contract.dateReceived,
        dateSigned: contract.dateSigned,
        status: contract.status,
        notes: contract.notes,
        retirementOverrideReason: contract.retirementOverrideReason ?? "",
        retirementOverrideApprovalReference: contract.retirementOverrideApprovalReference ?? "",
        retirementOverrideConfirmed: Boolean(contract.retirementOverrideRequired),
        allowancesChanged: false,
        salary: contract.salary,
        gratuity: contract.gratuity ?? "",
        vacationLeaveEntitlement: contract.vacationLeaveEntitlement,
        sickLeaveEntitlement: contract.sickLeaveEntitlement,
        vacationRolloverAllowed: contract.vacationRolloverAllowed,
        sickRolloverAllowed: contract.sickRolloverAllowed,
        allowances:
          contract.allowances.map((allowance) => ({
            ...allowance,
            allowanceType: toAllowanceTypeDisplay(allowance.allowanceType),
            frequency: toFrequencyDisplay(allowance.frequency),
            amount: allowance.amount ?? "",
          })) || [],
      };
  }
  return {
    employeeId: "",
    minuteNumber: "",
    noAssignedContractNumber: false,
    contractNumber: "",
    durationPreset: "12",
    customDurationMonths: "",
    manualEndDateOverride: false,
    startDate: "",
    endDate: "",
    dateReceived: "",
    dateSigned: "",
    status: "Draft",
    notes: "",
    retirementOverrideReason: "",
    retirementOverrideApprovalReference: "",
    retirementOverrideConfirmed: false,
    allowancesChanged: false,
    salary: 0,
    gratuity: "",
    vacationLeaveEntitlement: 0,
    sickLeaveEntitlement: 0,
    vacationRolloverAllowed: true,
    sickRolloverAllowed: false,
    allowances: [],
  };
}

export function ContractForm({
  mode,
  contractId,
  employees,
  existingContracts,
  retirementPolicy,
  initialContract,
}: {
  mode: "create" | "edit";
  contractId?: string;
  employees: EmployeeRecord[];
  existingContracts: ContractRecord[];
  retirementPolicy: RetirementAgePolicy;
  initialContract?: ContractRecord;
}) {
  const router = useRouter();
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);
  const [gratuitySettings, setGratuitySettings] = useState(defaultGratuitySettings);

  const form = useForm<ContractFormValues>({
    resolver: zodResolver(contractFormSchema),
    defaultValues: toDefaultValues(initialContract),
  });
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "allowances" });
  const markAllowancesChanged = () =>
    setValue("allowancesChanged", true, { shouldDirty: true });

  const employeeId = watch("employeeId");
  const noAssignedContractNumber = watch("noAssignedContractNumber");
  const durationPreset = watch("durationPreset");
  const customDurationMonths = watch("customDurationMonths");
  const manualEndDateOverride = watch("manualEndDateOverride");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const retirementOverrideReason = watch("retirementOverrideReason");
  const retirementOverrideApprovalReference = watch("retirementOverrideApprovalReference");
  const retirementOverrideConfirmed = Boolean(watch("retirementOverrideConfirmed"));
  const salary = Number(watch("salary") || 0);
  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId),
    [employeeId, employees],
  );
  const employeeOptions = useMemo(() => {
    const q = employeeQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    return employees.filter((employee) => {
      const hay = [
        getFullName(employee),
        employee.firstName,
        employee.lastName,
        employee.fileNumber,
        employee.mobileNumber,
        employee.homeNumber,
        employee.personalEmail,
        employee.workEmail,
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [employeeQuery, employees]);
  const retirementCutoffDate = useMemo(() => {
    if (!selectedEmployee?.dateOfBirth) return null;
    return calculateRecommendedRetirementContractEndDate(selectedEmployee.dateOfBirth, retirementPolicy.retirementAge);
  }, [selectedEmployee?.dateOfBirth, retirementPolicy.retirementAge]);
  const retirementCheckEnabled = Boolean(retirementPolicy.enforceRetirementCheck);
  const exceedsRetirementCutoff =
    retirementCheckEnabled &&
    Boolean(selectedEmployee?.dateOfBirth) &&
    doesContractExceedRetirementCutoff(endDate, retirementCutoffDate);
  const requiresRetirementOverride = exceedsRetirementCutoff && retirementPolicy.allowOverride;
  const missingRetirementOverrideDetails =
    requiresRetirementOverride &&
    ((retirementPolicy.requireOverrideReason && !retirementOverrideReason?.trim()) ||
      (retirementPolicy.requireApprovalReference && !retirementOverrideApprovalReference?.trim()) ||
      !retirementOverrideConfirmed);

  useEffect(() => {
    setGratuitySettings(loadGratuitySettings());
  }, []);

  const contractMonths = contractMonthsBetween(startDate, endDate);
  const gratuityBreakdown = calculateGratuity({
    monthlySalary: salary,
    contractMonths,
    gratuityRate: gratuitySettings.gratuityRate,
    governmentTaxRate: gratuitySettings.governmentTaxRate,
  });

  useEffect(() => {
    setValue("gratuity", Math.round(gratuityBreakdown.netGratuity * 100) / 100);
    setValue("sickRolloverAllowed", false);
  }, [gratuityBreakdown.netGratuity, setValue]);

  useEffect(() => {
    if (manualEndDateOverride) return;
    if (!startDate) return;
    const durationMonths =
      durationPreset === "custom"
        ? customDurationMonths === ""
          ? 0
          : Number(customDurationMonths)
        : durationPreset === ""
          ? 0
          : Number(durationPreset);
    if (durationMonths <= 0) return;
    const computedEnd = calculateContractEndDate(startDate, durationMonths);
    if (computedEnd) {
      setValue("endDate", computedEnd, { shouldValidate: true, shouldDirty: true });
    }
  }, [manualEndDateOverride, startDate, durationPreset, customDurationMonths, setValue]);

  function hasOverlappingContract(data: ContractFormValues): boolean {
    return existingContracts.some((existing) => {
      if (existing.employeeId !== data.employeeId) return false;
      if (contractId && existing.id === contractId) return false;
      return data.startDate <= existing.endDate && data.endDate >= existing.startDate;
    });
  }

  const onInvalid: SubmitErrorHandler<ContractFormValues> = (formErrors) => {
    if (formErrors.employeeId) return notifyError("Please select an employee for this contract.");
    if (formErrors.endDate || formErrors.startDate || formErrors.dateSigned) {
      return notifyError("Contract end date must be after the start date.");
    }
    if (formErrors.durationPreset || formErrors.customDurationMonths) {
      return notifyError("Please complete all required contract fields.");
    }
    return notifyError("Please complete all required contract fields.");
  };

  async function onSubmit(data: ContractFormValues) {
    try {
      if (!data.employeeId) {
        notifyError("Please select an employee for this contract.");
        return;
      }
      if (data.endDate < data.startDate) {
        notifyError("Contract end date must be after the start date.");
        return;
      }
      if (!data.manualEndDateOverride) {
        const durationMonths =
          data.durationPreset === "custom"
            ? data.customDurationMonths === ""
              ? 0
              : Number(data.customDurationMonths)
            : data.durationPreset === ""
              ? 0
              : Number(data.durationPreset);
        if (!durationMonths || !contractEndDateMatchesPeriod(data.startDate, data.endDate, durationMonths)) {
          notifyError("Contract end date must follow the selected contract period.");
          return;
        }
      }
      if (hasOverlappingContract(data)) {
        notifyError("Contract period overlaps with an existing contract for this employee.");
        return;
      }

      const finalContractNumber = data.noAssignedContractNumber ? "" : data.contractNumber?.trim() ?? "";
      if (!data.noAssignedContractNumber && !finalContractNumber) {
        notifyError("Please complete all required contract fields.");
        return;
      }

      const duplicate = !data.noAssignedContractNumber && existingContracts.some((contract) => {
        if (!contract.contractNumber) return false;
        return (
          contract.contractNumber.toLowerCase() === finalContractNumber.toLowerCase() &&
          contract.id !== contractId
        );
      });
      if (duplicate) {
        notifyError("Contract number already exists. Please use a unique contract number.");
        return;
      }

      const allowanceInvalid = data.allowances.some(
        (allowance) =>
          allowance.allowanceType !== "" &&
          (allowance.amount === "" || Number(allowance.amount) < 0),
      );
      if (allowanceInvalid) {
        notifyError("Please review the allowance details.");
        return;
      }
      if (exceedsRetirementCutoff && !retirementPolicy.allowOverride) {
        notifyError("Contract cannot extend beyond the configured retirement age.");
        return;
      }
      if (missingRetirementOverrideDetails) {
        notifyError("Retirement age override details are required.");
        return;
      }

      if (mode === "create") {
        const result = await createContractAction({
          ...data,
          contractNumber: data.noAssignedContractNumber ? "" : finalContractNumber,
          retirementOverrideReason: data.retirementOverrideReason?.trim() || "",
          retirementOverrideApprovalReference: data.retirementOverrideApprovalReference?.trim() || "",
          retirementOverrideConfirmed: Boolean(data.retirementOverrideConfirmed),
        });
        if (!result.success) {
          notifyError(result.message);
          return;
        }
        notifySuccess("Contract created successfully.");
        router.push(`/contracts/${result.contractId}`);
      } else {
        if (!contractId) {
          notifyError("Failed to update contract. Please try again.");
          return;
        }
        const result = await updateContractAction(contractId, {
          ...data,
          contractNumber: data.noAssignedContractNumber ? "" : finalContractNumber,
          retirementOverrideReason: data.retirementOverrideReason?.trim() || "",
          retirementOverrideApprovalReference: data.retirementOverrideApprovalReference?.trim() || "",
          retirementOverrideConfirmed: Boolean(data.retirementOverrideConfirmed),
        });
        if (!result.success) {
          notifyError(result.message);
          return;
        }
        notifySuccess("Contract updated successfully.");
        router.push(`/contracts/${result.contractId}`);
      }
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "";
      if (msg) notifyError(msg);
      else {
        notifyError(
          mode === "create" ? "Failed to create contract. Please try again." : "Failed to update contract. Please try again.",
        );
      }
    }
  }

  const cancelHref = mode === "edit" && contractId ? `/contracts/${contractId}` : "/contracts";

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-5">
      <section className={cn(floatingCard, "space-y-4")}>
        <div>
          <h2 className="text-base font-semibold">Employee Selection</h2>
        </div>
        <div className="space-y-3">
          <Field label="Employee" required error={errors.employeeId?.message}>
            <Input
              className="rounded-md"
              placeholder="Search employee by name, file number, phone, or email"
              value={employeeQuery}
              onChange={(e) => {
                setEmployeeQuery(e.target.value);
                setShowEmployeeResults(true);
              }}
              onFocus={() => setShowEmployeeResults(true)}
            />
          </Field>
          {showEmployeeResults && employeeOptions.length > 0 ? (
            <div className="rounded-xl border border-border bg-card shadow-sm">
              {employeeOptions.map((employee) => (
                <button
                  key={employee.id}
                  type="button"
                  className="hover:bg-muted/50 flex w-full items-start justify-between gap-3 border-b border-border px-3 py-2 text-left last:border-b-0"
                  onClick={() => {
                    setValue("employeeId", employee.id, { shouldValidate: true });
                    setEmployeeQuery(`${getFullName(employee)} · ${employee.fileNumber}`);
                    setShowEmployeeResults(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{getFullName(employee)}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {employee.fileNumber} · {employee.mobileNumber || employee.homeNumber || "—"}
                    </p>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">{employee.workEmail || employee.personalEmail || "—"}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedEmployee ? (
          <div className="rounded-xl border border-border bg-muted/20 p-4 text-sm space-y-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-medium">{getFullName(selectedEmployee)}</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setValue("employeeId", "", { shouldValidate: true });
                  setEmployeeQuery("");
                  setShowEmployeeResults(false);
                }}
              >
                Clear selected employee
              </Button>
            </div>
            <p className="text-muted-foreground">
              {selectedEmployee.fileNumber} · {selectedEmployee.position} · {selectedEmployee.department}
            </p>
            <p className="text-muted-foreground">
              {selectedEmployee.mobileNumber || selectedEmployee.homeNumber || "—"} ·{" "}
              {selectedEmployee.workEmail || selectedEmployee.personalEmail || "—"}
            </p>
          </div>
        ) : null}
        {retirementCheckEnabled && selectedEmployee && !selectedEmployee.dateOfBirth ? (
          <div className="rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            Date of birth is missing for this employee. Retirement age validation cannot be performed.
          </div>
        ) : null}
        <input type="hidden" {...register("employeeId")} />
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Contract Details</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Minute #" error={errors.minuteNumber?.message}>
            <Input
              className="rounded-md"
              placeholder="Enter Executive Council or Secretary minute number"
              {...register("minuteNumber")}
            />
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" className="size-4 rounded border border-input" {...register("noAssignedContractNumber")} />
              Contract has no assigned number
            </label>
          </div>
          <Field
            label="Contract number"
            required={!noAssignedContractNumber}
            error={errors.contractNumber?.message}
          >
            <Input
              className="rounded-md"
              disabled={noAssignedContractNumber}
              placeholder={noAssignedContractNumber ? "No assigned number" : undefined}
              {...register("contractNumber")}
            />
          </Field>
          <Field label="Start date" required error={errors.startDate?.message}>
            <Input type="date" className="rounded-md" {...register("startDate")} />
          </Field>
          <Field label="Contract Duration" required error={errors.durationPreset?.message}>
            <select className={selectClass} {...register("durationPreset")}>
              <option value="">Select…</option>
              <option value="3">3 months</option>
              <option value="6">6 months</option>
              <option value="12">1 year</option>
              <option value="24">2 years</option>
              <option value="custom">Custom months</option>
            </select>
          </Field>
          {durationPreset === "custom" ? (
            <Field label="Custom Duration Months" required error={errors.customDurationMonths?.message as string | undefined}>
              <Input type="number" min="1" className="rounded-md" {...register("customDurationMonths")} />
            </Field>
          ) : (
            <div />
          )}
          <Field label="End date" required error={errors.endDate?.message}>
            <Input type="date" className="rounded-md" {...register("endDate")} disabled={!manualEndDateOverride} />
            <p className="text-muted-foreground text-xs">
              Contract end date is calculated as the day before the next contract period begins.
            </p>
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium md:pt-8">
            <input type="checkbox" className="size-4 rounded border border-input" {...register("manualEndDateOverride")} />
            Manually override end date
          </label>
          <Field label="Date employee received contract" error={errors.dateReceived?.message}>
            <Input type="date" className="rounded-md" {...register("dateReceived")} />
          </Field>
          <Field label="Date employee signed contract" error={errors.dateSigned?.message}>
            <Input type="date" className="rounded-md" {...register("dateSigned")} />
          </Field>
          <Field label="Contract status" required error={errors.status?.message}>
            <select className={selectClass} {...register("status")}>
              {CONTRACT_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </Field>
          <div className="md:col-span-2 lg:col-span-3">
            <Field label="Notes" error={errors.notes?.message}>
              <textarea className="border-input bg-background min-h-24 w-full rounded-md border p-3 text-sm" {...register("notes")} />
            </Field>
          </div>
          {exceedsRetirementCutoff ? (
            <div className="md:col-span-2 lg:col-span-3 rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
              This contract extends beyond the employee&apos;s configured retirement age of {retirementPolicy.retirementAge} years.
              The recommended contract end date is {retirementCutoffDate ? formatContractDate(retirementCutoffDate) : "—"}.
              {retirementPolicy.allowOverride ? " An override is required to continue." : ""}
            </div>
          ) : null}
          {requiresRetirementOverride ? (
            <div className="md:col-span-2 lg:col-span-3 space-y-4 rounded-xl border border-border bg-muted/15 p-4">
              <h3 className="text-sm font-semibold">Retirement Age Override</h3>
              <Field
                label="Override reason"
                required={retirementPolicy.requireOverrideReason}
                error={errors.retirementOverrideReason?.message}
              >
                <textarea
                  className="border-input bg-background min-h-24 w-full rounded-md border p-3 text-sm"
                  placeholder="Explain why this contract is being issued beyond the configured retirement age."
                  {...register("retirementOverrideReason")}
                />
              </Field>
              <Field
                label="Approval reference / Minute number"
                required={retirementPolicy.requireApprovalReference}
                error={errors.retirementOverrideApprovalReference?.message}
              >
                <Input
                  className="rounded-md"
                  placeholder="Enter approval reference, Executive Council minute number, or Secretary minute number."
                  {...register("retirementOverrideApprovalReference")}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  className="size-4 rounded border border-input"
                  {...register("retirementOverrideConfirmed")}
                />
                I confirm that approval exists to continue this contract beyond the configured retirement age.
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Compensation</h2>
        <p className="text-muted-foreground text-sm">
          Gratuity is calculated using the active rate from Global Settings.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Field label="Salary (TTD)" required error={errors.salary?.message}>
            <Input type="number" step="0.01" min="0" className="rounded-md" {...register("salary")} />
          </Field>
          <Field label="Contract Duration">
            <Input className="rounded-md" value={`${contractMonths} months`} disabled readOnly />
          </Field>
          <Field label="Gross Contract Salary">
            <Input className="rounded-md" value={formatCurrencyTTD(gratuityBreakdown.grossContractSalary)} disabled readOnly />
          </Field>
          <Field label="Gratuity Rate">
            <Input className="rounded-md" value={`${gratuitySettings.gratuityRate}%`} disabled readOnly />
          </Field>
          <Field label="Gross Gratuity">
            <Input className="rounded-md" value={formatCurrencyTTD(gratuityBreakdown.grossGratuity)} disabled readOnly />
          </Field>
          <Field label="Government Tax Rate">
            <Input className="rounded-md" value={`${gratuitySettings.governmentTaxRate}%`} disabled readOnly />
          </Field>
          <Field label="Tax Deduction">
            <Input className="rounded-md" value={formatCurrencyTTD(gratuityBreakdown.taxDeduction)} disabled readOnly />
          </Field>
          <Field label="Net Gratuity (TTD)" error={errors.gratuity?.message}>
            <Input className="rounded-md" value={formatCurrencyTTD(gratuityBreakdown.netGratuity)} disabled readOnly />
          </Field>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Leave Entitlement for Contract Period</h2>
        <p className="text-muted-foreground text-sm">
          Vacation leave may roll over only within the same contract period. Sick leave does not roll over.
        </p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Field label="Vacation leave entitlement" error={errors.vacationLeaveEntitlement?.message}>
            <Input type="number" min="0" className="rounded-md" {...register("vacationLeaveEntitlement")} />
          </Field>
          <Field label="Sick leave entitlement" error={errors.sickLeaveEntitlement?.message}>
            <Input type="number" min="0" className="rounded-md" {...register("sickLeaveEntitlement")} />
          </Field>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" className="size-4 rounded border border-input" {...register("vacationRolloverAllowed")} />
            Vacation leave rollover allowed
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={false} disabled className="size-4 rounded border border-input" />
            Sick leave rollover allowed
          </label>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold">Allowances</h2>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              append(newAllowanceRow());
              markAllowancesChanged();
            }}
          >
            <Plus className="size-4" />
            Add Allowance
          </Button>
        </div>
        {fields.length === 0 ? <p className="text-muted-foreground text-sm">No allowances recorded.</p> : null}
        <div className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="rounded-xl border border-border bg-muted/15 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-medium">Allowance {index + 1}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  onClick={() => {
                    remove(index);
                    markAllowancesChanged();
                  }}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <Field label="Allowance type" error={errors.allowances?.[index]?.allowanceType?.message}>
                  <select
                    className={selectClass}
                    {...register(`allowances.${index}.allowanceType`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  >
                    <option value="">Select…</option>
                    {ALLOWANCE_TYPE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Description" error={errors.allowances?.[index]?.description?.message}>
                  <Input
                    className="rounded-md"
                    {...register(`allowances.${index}.description`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  />
                </Field>
                <Field label="Amount" error={errors.allowances?.[index]?.amount?.message as string | undefined}>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="rounded-md"
                    {...register(`allowances.${index}.amount`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  />
                </Field>
                <Field label="Frequency" error={errors.allowances?.[index]?.frequency?.message}>
                  <select
                    className={selectClass}
                    {...register(`allowances.${index}.frequency`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  >
                    <option value="">Select…</option>
                    {ALLOWANCE_FREQUENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Start date" error={errors.allowances?.[index]?.startDate?.message}>
                  <Input
                    type="date"
                    className="rounded-md"
                    {...register(`allowances.${index}.startDate`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  />
                </Field>
                <Field label="End date" error={errors.allowances?.[index]?.endDate?.message}>
                  <Input
                    type="date"
                    className="rounded-md"
                    {...register(`allowances.${index}.endDate`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    className="size-4 rounded border border-input"
                    {...register(`allowances.${index}.taxable`, {
                      onChange: () => markAllowancesChanged(),
                    })}
                  />
                  Taxable
                </label>
                <div className="md:col-span-2 lg:col-span-2">
                  <Field label="Notes" error={errors.allowances?.[index]?.notes?.message}>
                    <Input
                      className="rounded-md"
                      {...register(`allowances.${index}.notes`, {
                        onChange: () => markAllowancesChanged(),
                      })}
                    />
                  </Field>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <input type="hidden" {...register("allowancesChanged")} />
        <Button
          type="submit"
          disabled={isSubmitting || (exceedsRetirementCutoff && (!retirementPolicy.allowOverride || missingRetirementOverrideDetails))}
        >
          Save Contract
        </Button>
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Cancel
        </Link>
      </div>
    </form>
  );
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}
