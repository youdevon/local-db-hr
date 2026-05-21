"use server";

import { revalidatePath } from "next/cache";

import { requirePermission } from "@/lib/auth-server";
import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { MUTATION_NOT_PERMITTED_MESSAGE } from "@/lib/roles";
import {
  getHighestUsedNoteNumberForYear,
  setNoteNumberSequenceNextNumber,
} from "@/lib/server/note-monitor-numbering";
import {
  noteNumberSequenceUpdateSchema,
  type NoteNumberSequenceUpdateValues,
} from "@/lib/validators/note-monitor-form";
import { getSessionUserId } from "@/lib/auth-server";

export type NoteNumberingActionResult = { success: true; message: string } | { success: false; message: string };

const NEXT_NUMBER_TOO_LOW_MESSAGE =
  "The next note number cannot be lower than the highest note number already used for this year.";

function validateNextNumber(noteYear: number, nextNumber: number, highestUsed: number): string | null {
  const minimumNext = highestUsed + 1;
  if (nextNumber < minimumNext) {
    return NEXT_NUMBER_TOO_LOW_MESSAGE;
  }
  return null;
}

export async function updateNoteNumberSequenceAction(
  input: NoteNumberSequenceUpdateValues,
): Promise<NoteNumberingActionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const parsed = noteNumberSequenceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid numbering settings." };
  }

  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  const { noteYear, nextNumber } = parsed.data;

  const highestUsed = await getHighestUsedNoteNumberForYear(noteYear);
  const validationError = validateNextNumber(noteYear, nextNumber, highestUsed);
  if (validationError) {
    return { success: false, message: validationError };
  }

  try {
    const result = await setNoteNumberSequenceNextNumber({
      noteYear,
      nextNumber,
      updatedByUserId: actorUserId,
    });

    const previousLabel = result.previousNextNumber ?? "unset";

    await createSystemAuditLog({
      actorUserId,
      module: "Global Settings",
      action: "updated_note_numbering",
      targetType: "settings",
      targetLabel: `Note Numbering: ${noteYear}`,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        changes: [
          {
            field: "next_number",
            label: "Next Number",
            type: "changed",
            before: result.previousNextNumber,
            after: nextNumber,
            format: "number",
          },
        ],
        noteYear,
        highestUsedNoteNumber: highestUsed,
        actionType: "Numbering Setting Updated",
      },
    });

    revalidatePath("/settings/note-numbering");
    revalidatePath("/note-monitor");
    return {
      success: true,
      message: `Note numbering next number changed from ${previousLabel} to ${nextNumber} for ${noteYear}.`,
    };
  } catch {
    return { success: false, message: "Could not update note numbering settings." };
  }
}

export async function resetNoteNumberSequenceAction(input: {
  noteYear: number;
}): Promise<NoteNumberingActionResult> {
  const auth = await requirePermission("settings.edit");
  if (!auth) return { success: false, message: MUTATION_NOT_PERMITTED_MESSAGE };

  const noteYear = input.noteYear;
  if (!Number.isInteger(noteYear) || noteYear < 2000 || noteYear > 2100) {
    return { success: false, message: "Invalid year." };
  }

  const highestUsed = await getHighestUsedNoteNumberForYear(noteYear);
  const validationError = validateNextNumber(noteYear, 1, highestUsed);
  if (validationError) {
    return { success: false, message: validationError };
  }

  const actorUserId = await getSessionUserId();
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    const result = await setNoteNumberSequenceNextNumber({
      noteYear,
      nextNumber: 1,
      updatedByUserId: actorUserId,
    });

    await createSystemAuditLog({
      actorUserId,
      module: "Global Settings",
      action: "reset_note_numbering",
      targetType: "settings",
      targetLabel: `Note Numbering: ${noteYear}`,
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        changes: [
          {
            field: "next_number",
            label: "Next Number",
            type: "changed",
            before: result.previousNextNumber,
            after: 1,
            format: "number",
          },
        ],
        noteYear,
        highestUsedNoteNumber: highestUsed,
        actionType: "Numbering Reset",
      },
    });

    revalidatePath("/settings/note-numbering");
    revalidatePath("/note-monitor");
    return {
      success: true,
      message: `Note numbering reset for ${noteYear}.`,
    };
  } catch {
    return { success: false, message: "Could not reset note numbering settings." };
  }
}
