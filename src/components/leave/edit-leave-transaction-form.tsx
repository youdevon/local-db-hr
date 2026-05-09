"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { updateLeaveTransactionAction } from "@/actions/leave";
import { LeaveDateRangeStrip } from "@/components/leave/leave-date-range-strip";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculateWorkingLeaveDays } from "@/lib/leave-days";
import { LEAVE_TYPE_OPTIONS } from "@/lib/leave";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { LeaveTransactionEditData } from "@/lib/server/leave";
import {
  leaveTransactionEditSchema,
  type LeaveTransactionEditValues,
} from "@/lib/validators/leave-form";

const LEAVE_STATUS_OPTIONS: Array<LeaveTransactionEditData["status"]> = [
  "recorded",
  "approved",
  "cancelled",
  "rejected",
  "adjusted",
];

function formatStatusLabel(value: string): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

export function EditLeaveTransactionForm({
  transaction,
}: {
  transaction: LeaveTransactionEditData;
}) {
  const router = useRouter();
  const form = useForm<LeaveTransactionEditValues>({
    resolver: zodResolver(leaveTransactionEditSchema) as any,
    defaultValues: {
      id: transaction.id,
      employeeId: transaction.employeeId,
      contractId: transaction.contractId ?? "",
      leaveType: transaction.leaveType as LeaveTransactionEditValues["leaveType"],
      startDate: transaction.startDate,
      endDate: transaction.endDate,
      returnToWorkDate: transaction.returnToWorkDate,
      leaveDays: Math.max(1, Math.round(transaction.leaveDays || 1)),
      leaveDaysAdjustmentReason: "",
      status: transaction.status,
      notes: transaction.notes || "",
    },
  });

  const {
    register,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = form;
  const startDate = watch("startDate");
  const endDate = watch("endDate");
  const leaveType = watch("leaveType");
  const leaveDays = Number(watch("leaveDays") || 0);

  const [holidayMap, setHolidayMap] = useState<Record<string, string>>({});
  const manualDaysLockedRef = useRef(true);
  const [showRecalculateHint, setShowRecalculateHint] = useState(false);

  const holidayDateSet = useMemo(() => new Set(Object.keys(holidayMap)), [holidayMap]);
  const computedDays = useMemo(
    () => calculateWorkingLeaveDays(startDate, endDate, holidayDateSet),
    [startDate, endDate, holidayDateSet],
  );

  const datesChangedFromSaved = useMemo(
    () => startDate !== transaction.startDate || endDate !== transaction.endDate,
    [startDate, endDate, transaction.startDate, transaction.endDate],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!startDate || !endDate || endDate < startDate) {
        if (!cancelled) setHolidayMap({});
        return;
      }
      try {
        const res = await fetch(
          `/api/public-holidays?from=${encodeURIComponent(startDate)}&to=${encodeURIComponent(endDate)}`,
          { credentials: "include" },
        );
        const data = (await res.json()) as { holidays?: Record<string, string> };
        if (!cancelled && data.holidays) setHolidayMap(data.holidays);
      } catch {
        if (!cancelled) setHolidayMap({});
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate) return;
    if (manualDaysLockedRef.current) {
      setShowRecalculateHint(datesChangedFromSaved);
      return;
    }
    setShowRecalculateHint(false);
    const next = computedDays >= 1 ? computedDays : 1;
    setValue("leaveDays", next, { shouldValidate: true });
  }, [computedDays, startDate, endDate, setValue, datesChangedFromSaved]);

  async function onSubmit(values: LeaveTransactionEditValues) {
    if (values.endDate < values.startDate) {
      return notifyError("Leave end date must be on or after the start date.");
    }
    if (values.returnToWorkDate <= values.endDate) {
      return notifyError("Return to work date must be after the leave end date.");
    }
    if (Math.round(Number(values.leaveDays || 0)) < 1) {
      return notifyError("Number of Leave Days must be at least 1.");
    }

    try {
      const result = await updateLeaveTransactionAction({
        ...values,
        leaveDays: Math.round(Number(values.leaveDays)),
        contractId: values.contractId || undefined,
      });
      if (!result.success) {
        notifyError(result.message || "Failed to update leave record. Please try again.");
        return;
      }
      notifySuccess(result.message);
      router.refresh();
      router.push(`/leave/transactions?employeeId=${encodeURIComponent(transaction.employeeId)}`);
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Failed to update leave record. Please try again.";
      notifyError(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      <section className="rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
        <h2 className="font-heading text-base font-bold tracking-tight">Employee & Contract</h2>
        <div className="mt-4 grid gap-2 text-sm md:grid-cols-2">
          <p>Employee: {transaction.employeeName}</p>
          <p>File #: {transaction.fileNumber}</p>
          <p>Position: {transaction.position}</p>
          <p>Contract period: {transaction.contractPeriod}</p>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]">
        <h2 className="font-heading text-base font-bold tracking-tight">Edit Leave Details</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Field label="Leave Type" required error={errors.leaveType?.message}>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              {...register("leaveType")}
            >
              {LEAVE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Status" required error={errors.status?.message}>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              {...register("status")}
            >
              {LEAVE_STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {formatStatusLabel(status)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Start Date" required error={errors.startDate?.message}>
            <Input
              type="date"
              className="h-10 rounded-md"
              {...register("startDate", {
                onChange: () => {
                  manualDaysLockedRef.current = true;
                },
              })}
            />
          </Field>
          <Field label="End Date" required error={errors.endDate?.message}>
            <Input
              type="date"
              className="h-10 rounded-md"
              {...register("endDate", {
                onChange: () => {
                  manualDaysLockedRef.current = true;
                },
              })}
            />
          </Field>
          {startDate && endDate && endDate >= startDate ? (
            <div className="md:col-span-2">
              <LeaveDateRangeStrip startDate={startDate} endDate={endDate} holidays={holidayMap} />
            </div>
          ) : null}
          <Field label="Return to Work Date" required error={errors.returnToWorkDate?.message}>
            <Input type="date" className="h-10 rounded-md" {...register("returnToWorkDate")} />
          </Field>
          <Field label="Number of Leave Days" required error={errors.leaveDays?.message as string | undefined}>
            <Input
              type="number"
              min="1"
              step="1"
              className="h-10 rounded-md"
              {...register("leaveDays", {
                valueAsNumber: true,
                onChange: () => {
                  manualDaysLockedRef.current = true;
                },
                onBlur: (event) => {
                  if (!event.target.value && computedDays > 0) {
                    setValue("leaveDays", computedDays, { shouldValidate: true });
                  }
                },
              })}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Leave days are automatically calculated using working days only, excluding weekends and Trinidad and Tobago
              public holidays. You may manually adjust the count if required. Auto-calculated working days (Mon–Fri,
              excluding weekends and TT public holidays): <strong className="text-foreground">{computedDays}</strong>.
              Stored value is preserved until you choose “Use calculated” or change dates.
            </p>
            {leaveType === "sick" ? (
              <p className="text-muted-foreground mt-1 text-xs">
                For sick leave spanning a weekend, HR may manually adjust the leave day count where applicable.
              </p>
            ) : null}
            {showRecalculateHint ? (
              <div className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-100">
                Dates changed — verify leave days. Calculated working days are now <strong>{computedDays}</strong>.
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-0 mt-2 h-8 sm:ml-2 sm:mt-0"
                  onClick={() => {
                    manualDaysLockedRef.current = false;
                    setShowRecalculateHint(false);
                    setValue("leaveDays", computedDays >= 1 ? computedDays : 1, { shouldValidate: true });
                  }}
                >
                  Use calculated ({computedDays})
                </Button>
              </div>
            ) : (
              <div className="mt-2 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    manualDaysLockedRef.current = false;
                    setShowRecalculateHint(false);
                    setValue("leaveDays", computedDays >= 1 ? computedDays : 1, { shouldValidate: true });
                  }}
                >
                  Use calculated ({computedDays})
                </Button>
              </div>
            )}
          </Field>
          {Math.round(leaveDays) !== computedDays ? (
            <div className="md:col-span-2">
              <Field label="Adjustment reason (optional)" error={errors.leaveDaysAdjustmentReason?.message}>
                <textarea
                  className="border-input bg-background min-h-[72px] w-full rounded-md border p-3 text-sm"
                  placeholder="Explain why leave days differ from the automatic working-day count"
                  {...register("leaveDaysAdjustmentReason")}
                />
              </Field>
            </div>
          ) : null}
          <div className="md:col-span-2">
            <Field label="Notes" error={errors.notes?.message}>
              <textarea
                className="border-input bg-background min-h-24 w-full rounded-md border p-3 text-sm"
                {...register("notes")}
              />
            </Field>
          </div>
        </div>

        <input type="hidden" {...register("id")} />
        <input type="hidden" {...register("employeeId")} />
        <input type="hidden" {...register("contractId")} />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="h-10 rounded-md text-sm font-medium" disabled={isSubmitting}>
          Save Changes
        </Button>
        <Link
          href={`/leave/transactions?employeeId=${encodeURIComponent(transaction.employeeId)}`}
          className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}
        >
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
