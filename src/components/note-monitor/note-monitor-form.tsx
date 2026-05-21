"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { useForm } from "react-hook-form";

import { createNoteMonitorRecordAction, updateNoteMonitorRecordAction } from "@/actions/note-monitor";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NOTE_STATUS_OPTIONS,
  NOTE_TYPE_OPTIONS,
  type NoteStatusValue,
} from "@/lib/note-monitor/constants";
import type { NoteMonitorDetailRecord } from "@/lib/server/note-monitor";
import { notifyError, notifySuccess } from "@/lib/notify";
import { noteMonitorFormSchema, type NoteMonitorFormValues } from "@/lib/validators/note-monitor-form";
import { cn } from "@/lib/utils";

const floatingCard =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";
const selectClass =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
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
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

type NoteMonitorFormProps =
  | {
      mode: "create";
      record?: undefined;
      canEdit: boolean;
    }
  | {
      mode: "edit";
      record: NoteMonitorDetailRecord;
      canEdit: boolean;
    };

export function NoteMonitorForm({ mode, record, canEdit }: NoteMonitorFormProps) {
  const router = useRouter();
  const defaultValues = useMemo<NoteMonitorFormValues>(
    () => ({
      noteType: record?.noteType ?? "executive_council_note",
      notePreparationDate: record?.notePreparationDate ?? todayIsoDate(),
      details: record?.details ?? "",
      dateReturnedFromSecretary: record?.dateReturnedFromSecretary ?? "",
      dateSentToExecutiveCouncil: record?.dateSentToExecutiveCouncil ?? "",
      dateReceivedFromExecutiveCouncil: record?.dateReceivedFromExecutiveCouncil ?? "",
      dueDate: record?.dueDate ?? "",
      status: (record?.status ?? "pending") as NoteStatusValue,
    }),
    [record],
  );

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NoteMonitorFormValues>({
    resolver: zodResolver(noteMonitorFormSchema),
    defaultValues,
  });

  async function onSubmit(values: NoteMonitorFormValues) {
    const result =
      mode === "create"
        ? await createNoteMonitorRecordAction(values)
        : await updateNoteMonitorRecordAction(record.id, values);

    if (!result.success) {
      notifyError(result.message);
      return;
    }

    notifySuccess(result.message);
    router.push(`/note-monitor/${result.recordId}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
      {mode === "edit" && record ? (
        <section className={cn(floatingCard, "grid gap-4 md:grid-cols-3")}>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Note Year</p>
            <p className="text-foreground font-medium">{record.noteYear}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Note Number</p>
            <p className="text-foreground font-medium">{record.displayReference}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs uppercase tracking-wide">Note Type</p>
            <p className="text-foreground font-medium">{record.noteTypeLabel}</p>
          </div>
        </section>
      ) : null}

      <section className={cn(floatingCard, "space-y-6")}>
        <h2 className="font-heading text-base font-bold tracking-tight">
          {mode === "create" ? "New Note Number" : "Edit Note Record"}
        </h2>

        <div className="grid gap-4 md:grid-cols-2">
          {mode === "create" ? (
            <Field label="Type" required error={errors.noteType?.message}>
              <select className={selectClass} disabled={!canEdit} {...register("noteType")}>
                {NOTE_TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-muted-foreground text-xs">
                The next available note number is shared across all note types for the selected year.
              </p>
            </Field>
          ) : null}

          <Field label="Note Preparation Date" required error={errors.notePreparationDate?.message}>
            <Input type="date" className="rounded-md" disabled={!canEdit} {...register("notePreparationDate")} />
          </Field>

          <Field label="Status" required error={errors.status?.message}>
            <select className={selectClass} disabled={!canEdit} {...register("status")}>
              {NOTE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Due Date" error={errors.dueDate?.message}>
            <Input type="date" className="rounded-md" disabled={!canEdit} {...register("dueDate")} />
          </Field>
        </div>

        <Field label="Details" required error={errors.details?.message}>
          <textarea
            className="border-input bg-background min-h-32 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30"
            disabled={!canEdit}
            placeholder="Enter the subject or details of this note"
            {...register("details")}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Date Returned from Secretary" error={errors.dateReturnedFromSecretary?.message}>
            <Input type="date" className="rounded-md" disabled={!canEdit} {...register("dateReturnedFromSecretary")} />
          </Field>
          <Field label="Date Sent to Executive Council" error={errors.dateSentToExecutiveCouncil?.message}>
            <Input type="date" className="rounded-md" disabled={!canEdit} {...register("dateSentToExecutiveCouncil")} />
          </Field>
          <Field label="Date Received from Executive Council" error={errors.dateReceivedFromExecutiveCouncil?.message}>
            <Input
              type="date"
              className="rounded-md"
              disabled={!canEdit}
              {...register("dateReceivedFromExecutiveCouncil")}
            />
          </Field>
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        {canEdit ? (
          <Button type="submit" className="h-10 rounded-md" disabled={isSubmitting}>
            {mode === "create" ? "Create Note Number" : "Save Changes"}
          </Button>
        ) : null}
        <Link
          href={mode === "edit" && record ? `/note-monitor/${record.id}` : "/note-monitor"}
          className={buttonVariants({ variant: "outline", className: "h-10 rounded-md" })}
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
