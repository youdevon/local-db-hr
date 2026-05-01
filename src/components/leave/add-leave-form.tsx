"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";

import { createLeaveAction } from "@/actions/leave";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateLeaveRemaining } from "@/lib/leave-balances";
import {
  calculateInclusiveLeaveDays,
  formatDateLabel,
  formatContractPeriod,
  formatDays,
  getLeaveTypeLabel,
  LEAVE_TYPE_OPTIONS,
} from "@/lib/leave";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { LeaveEmployeeOption } from "@/lib/server/leave";
import { leaveFormSchema, type LeaveFormValues } from "@/lib/validators/leave-form";
import { cn } from "@/lib/utils";

const floatingCard =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function AddLeaveForm({
  employees,
  initialEmployeeId = "",
  initialContractId = "",
}: {
  employees: LeaveEmployeeOption[];
  initialEmployeeId?: string;
  initialContractId?: string;
}) {
  const router = useRouter();
  const [employeeQuery, setEmployeeQuery] = useState("");
  const [showEmployeeResults, setShowEmployeeResults] = useState(false);
const form = useForm<LeaveFormValues>({
  resolver: zodResolver(leaveFormSchema) as any,
    defaultValues: {
      employeeId: initialEmployeeId,
      contractId: initialContractId,
      leaveType: "vacation",
      startDate: "",
      endDate: "",
      returnToWorkDate: "",
      leaveDays: 0,
      notes: "",
    },
  });

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;

  const employeeId = watch("employeeId");
  const leaveType = watch("leaveType");
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const leaveDays = Number(watch("leaveDays") || 0);

  const selectedEmployee = useMemo(
    () => employees.find((employee) => employee.id === employeeId),
    [employees, employeeId],
  );
  const employeeOptions = useMemo(() => {
    const query = employeeQuery.trim().toLowerCase();
    if (query.length < 2) return [];
    return employees.filter((employee) => employee.searchText.includes(query));
  }, [employeeQuery, employees]);
  useEffect(() => {
    if (!initialEmployeeId) return;
    const employee = employees.find((row) => row.id === initialEmployeeId);
    if (employee) setEmployeeQuery(`${employee.fullName} · ${employee.fileNumber}`);
  }, [initialEmployeeId, employees]);
  const computedDays = useMemo(() => calculateInclusiveLeaveDays(startDate, endDate), [startDate, endDate]);
  const requestedDays = leaveDays > 0 ? leaveDays : computedDays;
  useEffect(() => {
    if (computedDays >= 1) {
      setValue("leaveDays", computedDays, { shouldValidate: true });
    }
  }, [computedDays, setValue]);

  const matchedContract = useMemo(() => {
    if (!selectedEmployee || !startDate || !endDate) return null;
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T23:59:59`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return null;

    const overlapping = selectedEmployee.contracts.filter((contract) => {
      const contractStart = new Date(`${contract.startDate}T00:00:00`);
      const contractEnd = new Date(`${contract.endDate}T23:59:59`);
      return contractStart <= end && contractEnd >= start;
    });
    const containing = overlapping.filter((contract) => {
      const contractStart = new Date(`${contract.startDate}T00:00:00`);
      const contractEnd = new Date(`${contract.endDate}T23:59:59`);
      return start >= contractStart && end <= contractEnd;
    });
    if (containing.length === 0) {
      return {
        kind: overlapping.length > 0 ? ("crosses_contracts" as const) : ("no_match" as const),
        contract: null,
      };
    }
    const contract = [...containing].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    return { kind: "matched" as const, contract };
  }, [selectedEmployee, startDate, endDate]);

  const matchedContractYear = useMemo(() => {
    if (!matchedContract || matchedContract.kind !== "matched" || !startDate) return null;
    const start = new Date(`${matchedContract.contract.startDate}T00:00:00`);
    const end = new Date(`${matchedContract.contract.endDate}T00:00:00`);
    let cursor = new Date(start.getTime());
    let yearNumber = 1;
    while (cursor <= end) {
      const nextYearEnd = new Date(cursor.getTime());
      nextYearEnd.setFullYear(nextYearEnd.getFullYear() + 1);
      nextYearEnd.setDate(nextYearEnd.getDate() - 1);
      const yearEnd = nextYearEnd <= end ? nextYearEnd : end;
      const target = new Date(`${startDate}T12:00:00`);
      if (target >= cursor && target <= new Date(`${yearEnd.toISOString().slice(0, 10)}T23:59:59`)) {
        return {
          yearNumber,
          startDate: cursor.toISOString().slice(0, 10),
          endDate: yearEnd.toISOString().slice(0, 10),
        };
      }
      cursor = new Date(yearEnd.getTime());
      cursor.setDate(cursor.getDate() + 1);
      yearNumber += 1;
    }
    return null;
  }, [matchedContract, startDate]);

  const entitlement = useMemo(() => {
    if (!matchedContract || matchedContract.kind !== "matched") return 0;
    if (leaveType === "vacation") return matchedContract.contract.vacationLeaveEntitlement;
    if (leaveType === "sick") return matchedContract.contract.sickLeaveEntitlement;
    return 0;
  }, [matchedContract, leaveType]);

  const used =
  matchedContract?.kind === "matched" && matchedContract.contract.id === selectedEmployee?.currentContract?.id
    ? (selectedEmployee?.usedByLeaveType[
        leaveType as keyof typeof selectedEmployee.usedByLeaveType
      ] ?? 0)
    : 0;
  const remaining = calculateLeaveRemaining(entitlement, used);
  const projectedRemaining = calculateLeaveRemaining(entitlement, used + requestedDays);
  const enforcesBalance = leaveType === "vacation" || leaveType === "sick";
  const insufficient =
    enforcesBalance && matchedContract?.kind === "matched" && projectedRemaining < 0;

  async function onSubmit(values: LeaveFormValues) {
    if (!values.employeeId) return notifyError("Please select an employee.");
    if (!values.leaveType) return notifyError("Please select a leave type.");
    if (values.endDate < values.startDate) return notifyError("Leave end date must be on or after the start date.");
    if (values.returnToWorkDate <= values.endDate) {
      return notifyError("Return to work date must be after the leave end date.");
    }
    if (computedDays < 1) return notifyError("Leave period must be at least one day.");
    if (matchedContract?.kind === "crosses_contracts") {
      return notifyError("This leave period crosses more than one contract. Please split it into separate leave records.");
    }
    if (matchedContract?.kind === "no_match") {
      return notifyError("No matching contract period was found for this leave date range.");
    }
    if (insufficient) return notifyError("Requested leave exceeds the remaining balance for this contract period.");

    const finalValues = {
      ...values,
      leaveDays: Math.round(Number(values.leaveDays || computedDays)),
      contractId: matchedContract?.kind === "matched" ? matchedContract.contract.id : "",
    };
    try {
      const result = await createLeaveAction(finalValues);
      if (!result.success) {
        notifyError(result.message || "Failed to create leave record. Please try again.");
        return;
      }
      notifySuccess("Leave record created successfully.");
      router.push("/leave");
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Failed to create leave record. Please try again.";
      notifyError(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Employee Selection</h2>
        <div className="space-y-3">
          <Field label="Employee" required error={errors.employeeId?.message}>
            <Input
              className="h-10 rounded-md"
              placeholder="Search by first name, last name, full name, file #, mobile, email, or ID number"
              value={employeeQuery}
              onChange={(event) => {
                setEmployeeQuery(event.target.value);
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
                  className="hover:bg-muted/50 flex w-full items-start justify-between gap-2 border-b border-border px-3 py-2 text-left last:border-b-0"
                  onClick={() => {
                    setValue("employeeId", employee.id, { shouldValidate: true });
                    setValue("contractId", employee.currentContract?.id ?? "", { shouldValidate: true });
                    setEmployeeQuery(`${employee.fullName} · ${employee.fileNumber}`);
                    setShowEmployeeResults(false);
                  }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{employee.fullName}</p>
                    <p className="text-muted-foreground truncate text-xs">
                      {employee.fileNumber} · {employee.position} · {employee.department}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedEmployee ? (
          <div className="space-y-1 rounded-xl border border-border bg-muted/20 p-4 text-sm">
            <p className="font-medium">{selectedEmployee.fullName}</p>
            <p className="text-muted-foreground">File #: {selectedEmployee.fileNumber}</p>
            <p className="text-muted-foreground">
              Current/latest contract:{" "}
              {selectedEmployee.currentContract
                ? formatContractPeriod(
                    selectedEmployee.currentContract.startDate,
                    selectedEmployee.currentContract.endDate,
                  )
                : "—"}
            </p>
            <p className="text-muted-foreground">Current position: {selectedEmployee.position || "—"}</p>
          </div>
        ) : null}
        <input type="hidden" {...register("employeeId")} />
        <input type="hidden" {...register("contractId")} />
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Leave Type</h2>
        <Field label="Leave Type" required error={errors.leaveType?.message}>
          <select className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm" {...register("leaveType")}>
            {LEAVE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Leave Period</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Start Date" required error={errors.startDate?.message}>
            <Input type="date" className="h-10 rounded-md" {...register("startDate")} />
          </Field>
          <Field label="End Date" required error={errors.endDate?.message}>
            <Input type="date" className="h-10 rounded-md" {...register("endDate")} />
          </Field>
          <Field label="Return to Work Date" required error={errors.returnToWorkDate?.message}>
            <Input type="date" className="h-10 rounded-md" {...register("returnToWorkDate")} />
            <p className="text-muted-foreground text-xs">Return to Work Date is the date the employee is expected to resume duties.</p>
          </Field>
          <Field label="Number of Leave Days" required error={errors.leaveDays?.message as string | undefined}>
            <Input
              type="number"
              min="1"
              step="1"
              className="h-10 rounded-md"
              {...register("leaveDays", {
                valueAsNumber: true,
                onBlur: (event) => {
                  if (!event.target.value && computedDays > 0) setValue("leaveDays", computedDays);
                },
              })}
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes" error={errors.notes?.message}>
              <textarea
                className="border-input bg-background min-h-24 w-full rounded-md border p-3 text-sm"
                {...register("notes")}
              />
            </Field>
          </div>
        </div>
      </section>

      <section className={cn(floatingCard, "space-y-4")}>
        <h2 className="text-base font-semibold">Contract Period / Balance Preview</h2>
        {selectedEmployee?.currentContract ? (
          <div className="grid gap-2 text-sm md:grid-cols-2">
            <p>Contract #: {selectedEmployee.currentContract.contractNumber || "—"}</p>
            <p>Minute #: {selectedEmployee.currentContract.minuteNumber || "—"}</p>
            <p>Contract Start Date: {selectedEmployee.currentContract.startDate || "—"}</p>
            <p>Contract End Date: {selectedEmployee.currentContract.endDate || "—"}</p>
            <p>Leave Type: {getLeaveTypeLabel(leaveType)}</p>
            <p>Available: {enforcesBalance ? formatDays(entitlement) : "—"}</p>
            <p>Used: {enforcesBalance ? formatDays(used) : "—"}</p>
            <p>Remaining: {enforcesBalance ? formatDays(remaining) : "—"}</p>
            <p>Requested Days: {formatDays(requestedDays)}</p>
            <p>Projected Remaining: {enforcesBalance ? formatDays(projectedRemaining) : "—"}</p>
            <p>
              Matched Contract:{" "}
              {matchedContract?.kind === "matched"
                ? `${matchedContract.contract.minuteNumber || "—"} / ${matchedContract.contract.contractNumber || "No assigned contract #"}`
                : "—"}
            </p>
            <p>
              Matched Contract Period:{" "}
              {matchedContract?.kind === "matched"
                ? formatContractPeriod(matchedContract.contract.startDate, matchedContract.contract.endDate)
                : "—"}
            </p>
            <p>
              Matched Contract Year:{" "}
              {matchedContractYear
                ? `Year ${matchedContractYear.yearNumber}: ${formatDateLabel(matchedContractYear.startDate)} – ${formatDateLabel(matchedContractYear.endDate)}`
                : "—"}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Select an employee to view contract balance preview.</p>
        )}
        {matchedContract?.kind === "matched" &&
        new Date(`${matchedContract.contract.endDate}T23:59:59`) < new Date() ? (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
            This leave will be recorded against a historical contract period.
          </div>
        ) : null}
        {matchedContract?.kind === "matched" && matchedContractYear ? (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            This leave will be applied to Contract Year {matchedContractYear.yearNumber} of the selected employee&apos;s contract period.
          </div>
        ) : null}
        {matchedContract?.kind === "no_match" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            No matching contract period was found for the selected leave dates.
          </div>
        ) : null}
        {matchedContract?.kind === "crosses_contracts" ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            This leave period crosses more than one contract. Please split it into separate leave records.
          </div>
        ) : null}
        {insufficient ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            Requested leave exceeds the remaining balance for this contract period.
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          className="h-10 rounded-md text-sm font-medium"
          disabled={
            isSubmitting ||
            insufficient ||
            matchedContract?.kind === "no_match" ||
            matchedContract?.kind === "crosses_contracts"
          }
        >
          Save Leave
        </Button>
        <Link href="/leave" className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}>
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
  children: React.ReactNode;
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
