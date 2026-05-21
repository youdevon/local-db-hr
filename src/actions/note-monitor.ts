"use server";

import { revalidatePath } from "next/cache";

import {
  assertViewerCannotMutateOrThrow,
  getSessionUserId,
  requirePermission,
} from "@/lib/auth-server";
import { getSession } from "@/lib/get-session";
import {
  MUTATION_NOT_PERMITTED_MESSAGE,
  canPerformAction,
  normalizeUserRole,
} from "@/lib/roles";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import {
  formatNoteStatusLabel,
  formatNoteTypeLabel,
  normalizeNoteStatus,
  normalizeNoteType,
  type NoteStatusValue,
} from "@/lib/note-monitor/constants";
import { allocateNextNoteNumber } from "@/lib/server/note-monitor-numbering";
import {
  countLinkedContractsForNoteMonitorRecord,
  getNoteMonitorRecordById,
} from "@/lib/server/note-monitor";
import { prisma } from "@/lib/prisma";
import { noteMonitorFormSchema, type NoteMonitorFormValues } from "@/lib/validators/note-monitor-form";

export type NoteMonitorActionResult =
  | { success: true; message: string; recordId: string }
  | { success: false; message: string };

type AuditChange = {
  field: string;
  label: string;
  type: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
  format?: "text" | "date";
};

function parseDateOrNull(value?: string): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(`${value.trim()}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateValue(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

async function getActorName(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { full_name: true } } },
  });
  return user?.profile?.full_name ?? user?.email ?? null;
}

async function appendNoteHistory(input: {
  recordId: string;
  action: string;
  fieldName?: string | null;
  fieldLabel?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  editedBy: string | null;
  editedByName: string | null;
}) {
  await prisma.note_monitor_history.create({
    data: {
      note_monitor_record_id: input.recordId,
      action: input.action,
      field_name: input.fieldName ?? null,
      field_label: input.fieldLabel ?? null,
      old_value: input.oldValue ?? null,
      new_value: input.newValue ?? null,
      edited_by: input.editedBy,
      edited_by_name: input.editedByName,
    },
  });
}

function buildFieldChanges(
  before: {
    note_preparation_date: Date;
    details: string;
    date_returned_from_secretary: Date | null;
    date_sent_to_executive_council: Date | null;
    date_received_from_executive_council: Date | null;
    due_date: Date | null;
    status: string;
  },
  after: {
    notePreparationDate: Date;
    details: string;
    dateReturnedFromSecretary: Date | null;
    dateSentToExecutiveCouncil: Date | null;
    dateReceivedFromExecutiveCouncil: Date | null;
    dueDate: Date | null;
    status: NoteStatusValue;
  },
): AuditChange[] {
  const changes: AuditChange[] = [];
  const pairs: Array<{
    field: string;
    label: string;
    before: string | null;
    after: string | null;
    format?: "date";
  }> = [
    {
      field: "note_preparation_date",
      label: "Note Preparation Date",
      before: formatDateValue(before.note_preparation_date),
      after: formatDateValue(after.notePreparationDate),
      format: "date",
    },
    {
      field: "details",
      label: "Details",
      before: before.details,
      after: after.details,
    },
    {
      field: "date_returned_from_secretary",
      label: "Date Returned from Secretary",
      before: formatDateValue(before.date_returned_from_secretary),
      after: formatDateValue(after.dateReturnedFromSecretary),
      format: "date",
    },
    {
      field: "date_sent_to_executive_council",
      label: "Date Sent to Executive Council",
      before: formatDateValue(before.date_sent_to_executive_council),
      after: formatDateValue(after.dateSentToExecutiveCouncil),
      format: "date",
    },
    {
      field: "date_received_from_executive_council",
      label: "Date Received from Executive Council",
      before: formatDateValue(before.date_received_from_executive_council),
      after: formatDateValue(after.dateReceivedFromExecutiveCouncil),
      format: "date",
    },
    {
      field: "due_date",
      label: "Due Date",
      before: formatDateValue(before.due_date),
      after: formatDateValue(after.dueDate),
      format: "date",
    },
    {
      field: "status",
      label: "Note Status",
      before: formatNoteStatusLabel(before.status),
      after: formatNoteStatusLabel(after.status),
    },
  ];

  for (const pair of pairs) {
    if ((pair.before ?? null) !== (pair.after ?? null)) {
      changes.push({
        field: pair.field,
        label: pair.label,
        type: "changed",
        before: pair.before,
        after: pair.after,
        format: pair.format,
      });
    }
  }

  return changes;
}

function actionLabelForField(field: string): string {
  switch (field) {
    case "details":
      return "Details Edited";
    case "status":
      return "Status Updated";
    case "due_date":
      return "Due Date Changed";
    case "date_returned_from_secretary":
      return "Date Returned from Secretary Updated";
    case "date_sent_to_executive_council":
      return "Date Sent to Executive Council Updated";
    case "date_received_from_executive_council":
      return "Date Received from Executive Council Updated";
    case "note_preparation_date":
      return "Note Preparation Date Updated";
    default:
      return "Field Updated";
  }
}

export async function createNoteMonitorRecordAction(
  input: NoteMonitorFormValues,
): Promise<NoteMonitorActionResult> {
  const auth = await requirePermission("noteMonitor.create");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  await assertViewerCannotMutateOrThrow();

  const parsed = noteMonitorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid note data." };
  }

  const data = parsed.data;
  const noteType = normalizeNoteType(data.noteType);
  if (!noteType) return { success: false, message: "Invalid note type." };

  const preparationDate = parseDateOrNull(data.notePreparationDate);
  if (!preparationDate) return { success: false, message: "Enter a valid note preparation date." };

  const actorUserId = await getSessionUserId();
  const actorName = await getActorName(actorUserId);
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const noteYear = preparationDate.getFullYear();
  const status = normalizeNoteStatus(data.status);

  try {
    const created = await prisma.$transaction(async (tx) => {
      const allocation = await allocateNextNoteNumber(tx, noteYear);

      const record = await tx.note_monitor_records.create({
        data: {
          note_year: noteYear,
          note_number: allocation.noteNumber,
          note_type: noteType,
          display_reference: allocation.displayReference,
          note_preparation_date: preparationDate,
          details: data.details.trim(),
          date_returned_from_secretary: parseDateOrNull(data.dateReturnedFromSecretary),
          date_sent_to_executive_council: parseDateOrNull(data.dateSentToExecutiveCouncil),
          date_received_from_executive_council: parseDateOrNull(data.dateReceivedFromExecutiveCouncil),
          due_date: parseDateOrNull(data.dueDate),
          status,
          created_by: actorUserId,
          updated_by: actorUserId,
        },
      });

      await tx.note_monitor_history.create({
        data: {
          note_monitor_record_id: record.id,
          action: allocation.reused ? "Note Created (Reused Number)" : "Note Created",
          field_label: "Note Number",
          new_value: allocation.displayReference,
          edited_by: actorUserId,
          edited_by_name: actorName,
        },
      });

      return { record, allocation };
    });

    const targetLabel = `${formatNoteTypeLabel(noteType)} ${created.allocation.displayReference}`;

    await createSystemAuditLog({
      actorUserId,
      module: "Note Monitor",
      action: "created_note",
      targetType: "note_monitor_record",
      targetId: created.record.id,
      targetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        noteType,
        noteYear,
        noteNumber: created.allocation.noteNumber,
        displayReference: created.allocation.displayReference,
        status: formatNoteStatusLabel(status),
        reused: created.allocation.reused,
        ...(created.allocation.reused
          ? {
              note: `Created ${formatNoteTypeLabel(noteType)} using available reused number ${created.allocation.displayReference}`,
            }
          : {}),
      },
    });

    revalidatePath("/note-monitor");
    revalidatePath("/settings/note-numbering");
    return {
      success: true,
      message: `Note number ${created.allocation.displayReference} created.`,
      recordId: created.record.id,
    };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Unique constraint")) {
      return { success: false, message: "Could not allocate a unique note number. Please try again." };
    }
    return { success: false, message: "Could not create note record." };
  }
}

export async function updateNoteMonitorRecordAction(
  recordId: string,
  input: NoteMonitorFormValues,
): Promise<NoteMonitorActionResult> {
  const auth = await requirePermission("noteMonitor.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  await assertViewerCannotMutateOrThrow();

  const parsed = noteMonitorFormSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid note data." };
  }

  const existing = await prisma.note_monitor_records.findFirst({
    where: { id: recordId, deleted_at: null },
  });
  if (!existing) return { success: false, message: "Note record not found." };

  const data = parsed.data;
  const preparationDate = parseDateOrNull(data.notePreparationDate);
  if (!preparationDate) return { success: false, message: "Enter a valid note preparation date." };

  const actorUserId = await getSessionUserId();
  const actorName = await getActorName(actorUserId);
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const status = normalizeNoteStatus(data.status);

  const nextValues = {
    notePreparationDate: preparationDate,
    details: data.details.trim(),
    dateReturnedFromSecretary: parseDateOrNull(data.dateReturnedFromSecretary),
    dateSentToExecutiveCouncil: parseDateOrNull(data.dateSentToExecutiveCouncil),
    dateReceivedFromExecutiveCouncil: parseDateOrNull(data.dateReceivedFromExecutiveCouncil),
    dueDate: parseDateOrNull(data.dueDate),
    status,
  };

  const changes = buildFieldChanges(existing, nextValues);

  try {
    await prisma.note_monitor_records.update({
      where: { id: recordId },
      data: {
        note_preparation_date: nextValues.notePreparationDate,
        details: nextValues.details,
        date_returned_from_secretary: nextValues.dateReturnedFromSecretary,
        date_sent_to_executive_council: nextValues.dateSentToExecutiveCouncil,
        date_received_from_executive_council: nextValues.dateReceivedFromExecutiveCouncil,
        due_date: nextValues.dueDate,
        status: nextValues.status,
        updated_by: actorUserId,
        updated_at: new Date(),
      },
    });

    for (const change of changes) {
      await appendNoteHistory({
        recordId,
        action: actionLabelForField(change.field),
        fieldName: change.field,
        fieldLabel: change.label,
        oldValue: change.before == null ? null : String(change.before),
        newValue: change.after == null ? null : String(change.after),
        editedBy: actorUserId,
        editedByName: actorName,
      });
    }

    const targetLabel = `${formatNoteTypeLabel(existing.note_type)} ${existing.display_reference}`;

    await createSystemAuditLog({
      actorUserId,
      module: "Note Monitor",
      action: "updated_note",
      targetType: "note_monitor_record",
      targetId: recordId,
      targetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: { changes },
    });

    revalidatePath("/note-monitor");
    revalidatePath(`/note-monitor/${recordId}`);
    return { success: true, message: "Note record updated.", recordId };
  } catch {
    return { success: false, message: "Could not update note record." };
  }
}

export async function getNoteMonitorRecordAction(recordId: string) {
  const auth = await requirePermission("noteMonitor.view");
  if (!auth) return null;
  return getNoteMonitorRecordById(recordId);
}

async function requireNoteMonitorDeletePermission(): Promise<{ userId: string } | null> {
  const session = await getSession();
  const userId = session.user?.userId ?? null;
  const role = normalizeUserRole(session.user?.role ?? null);
  if (!userId) return null;
  if (!canPerformAction(role, "noteMonitor.delete") && !canPerformAction(role, "noteMonitor.edit")) {
    return null;
  }
  return { userId };
}

export async function deleteNoteMonitorRecordAction(
  recordId: string,
): Promise<NoteMonitorActionResult> {
  const auth = await requireNoteMonitorDeletePermission();
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };
  await assertViewerCannotMutateOrThrow();

  const existing = await prisma.note_monitor_records.findFirst({
    where: { id: recordId, deleted_at: null },
  });
  if (!existing) return { success: false, message: "Note record not found." };

  const linkedContractCount = await countLinkedContractsForNoteMonitorRecord(recordId);
  if (linkedContractCount > 0) {
    return {
      success: false,
      message: "This note cannot be deleted because it is linked to one or more contracts.",
    };
  }

  const actorUserId = await getSessionUserId();
  const actorName = await getActorName(actorUserId);
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const targetLabel = `${formatNoteTypeLabel(existing.note_type)} ${existing.display_reference}`;
  const deletedAt = new Date();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.note_monitor_records.update({
        where: { id: recordId },
        data: {
          deleted_at: deletedAt,
          deleted_by: actorUserId,
          updated_by: actorUserId,
          updated_at: deletedAt,
        },
      });

      await tx.note_monitor_history.create({
        data: {
          note_monitor_record_id: recordId,
          action: "Note Deleted",
          field_label: "Note Number",
          old_value: existing.display_reference,
          new_value: "Available for reuse",
          edited_by: actorUserId,
          edited_by_name: actorName,
        },
      });
    });

    await createSystemAuditLog({
      actorUserId,
      module: "Note Monitor",
      action: "deleted_note",
      targetType: "note_monitor_record",
      targetId: recordId,
      targetLabel,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        noteType: existing.note_type,
        noteYear: existing.note_year,
        noteNumber: existing.note_number,
        displayReference: existing.display_reference,
        note: `Deleted ${targetLabel}. Number ${existing.display_reference} is now available for reuse in ${existing.note_year}.`,
      },
    });

    revalidatePath("/note-monitor");
    revalidatePath(`/note-monitor/${recordId}`);
    revalidatePath("/settings/note-numbering");
    return {
      success: true,
      message: `Note ${existing.display_reference} deleted. The number is available for reuse in ${existing.note_year}.`,
      recordId,
    };
  } catch {
    return { success: false, message: "Could not delete note record." };
  }
}
