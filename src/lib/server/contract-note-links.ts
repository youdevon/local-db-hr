import "server-only";

import { formatNoteDropdownLabel, formatNoteTypeLabel } from "@/lib/note-monitor/constants";
import type { NoteTypeValue } from "@/lib/note-monitor/constants";
import { getNoteMonitorRecordSummaryById } from "@/lib/server/note-monitor";
import { prisma } from "@/lib/prisma";

export type AuthorityReferenceMode = "note_monitor" | "manual";

export type ResolvedAuthorityNoteReference = {
  authorityNoteType: NoteTypeValue;
  authorityNoteMonitorRecordId: string | null;
  authorityNoteManualReference: string | null;
  minuteNumber: string | null;
  executiveCouncilNoteId: string | null;
  secretaryNoteId: string | null;
  monitorAuditLabel: string | null;
};

export async function resolveAuthorityNoteReference(input: {
  authorityNoteType: string;
  authorityReferenceMode: AuthorityReferenceMode;
  authorityNoteMonitorRecordId?: string | null;
  authorityNoteManualReference?: string | null;
}): Promise<{ ok: true; data: ResolvedAuthorityNoteReference } | { ok: false; message: string }> {
  const authorityNoteType = input.authorityNoteType.trim() as NoteTypeValue;
  const monitorId = input.authorityNoteMonitorRecordId?.trim() || null;
  const manualRef = input.authorityNoteManualReference?.trim() || null;

  if (input.authorityReferenceMode === "note_monitor") {
    if (!monitorId) {
      return { ok: false, message: "Select a note from Note Monitor." };
    }
    if (manualRef) {
      return { ok: false, message: "Use either a Note Monitor record or a manual reference, not both." };
    }

    const note = await getNoteMonitorRecordSummaryById(monitorId);
    if (!note) {
      return { ok: false, message: "Selected authority note was not found in Note Monitor." };
    }
    if (note.note_type !== authorityNoteType) {
      return {
        ok: false,
        message: `The selected note must be a ${formatNoteTypeLabel(authorityNoteType)} record.`,
      };
    }

    return {
      ok: true,
      data: {
        authorityNoteType,
        authorityNoteMonitorRecordId: monitorId,
        authorityNoteManualReference: null,
        minuteNumber: note.display_reference,
        executiveCouncilNoteId: authorityNoteType === "executive_council_note" ? monitorId : null,
        secretaryNoteId: authorityNoteType === "secretary_note" ? monitorId : null,
        monitorAuditLabel: formatContractNoteLabel(note),
      },
    };
  }

  if (!manualRef) {
    return { ok: false, message: "Enter a manual authority reference." };
  }
  if (monitorId) {
    return { ok: false, message: "Use either a Note Monitor record or a manual reference, not both." };
  }

  return {
    ok: true,
    data: {
      authorityNoteType,
      authorityNoteMonitorRecordId: null,
      authorityNoteManualReference: manualRef,
      minuteNumber: manualRef,
      executiveCouncilNoteId: null,
      secretaryNoteId: null,
      monitorAuditLabel: null,
    },
  };
}

export function formatContractNoteLabel(note: {
  note_type: string;
  note_number: number;
  note_year: number;
  details: string;
  status: string;
}): string {
  return formatNoteDropdownLabel({
    noteType: note.note_type,
    noteNumber: note.note_number,
    noteYear: note.note_year,
    details: note.details,
    status: note.status,
  });
}

export function formatAuthorityReferenceForAudit(input: {
  authorityNoteMonitorRecordId?: string | null;
  authorityNoteManualReference?: string | null;
  monitorLabel?: string | null;
}): string | null {
  if (input.authorityNoteManualReference?.trim()) {
    return `Manual Reference "${input.authorityNoteManualReference.trim()}"`;
  }
  if (input.monitorLabel?.trim()) {
    return `Note Monitor "${input.monitorLabel.trim()}"`;
  }
  return null;
}

export function formatAuthorityReferenceAuditLabel(input: {
  authorityNoteType: string | null;
  authorityNoteMonitorRecordId?: string | null;
  authorityNoteManualReference?: string | null;
  monitorLabel?: string | null;
}): string | null {
  const typeLabel = input.authorityNoteType ? formatNoteTypeLabel(input.authorityNoteType) : null;
  if (input.authorityNoteManualReference?.trim()) {
    return typeLabel
      ? `${typeLabel}: ${input.authorityNoteManualReference.trim()}`
      : input.authorityNoteManualReference.trim();
  }
  if (input.monitorLabel?.trim()) {
    return typeLabel ? `${typeLabel}: ${input.monitorLabel.trim()}` : input.monitorLabel.trim();
  }
  if (input.authorityNoteMonitorRecordId) {
    return typeLabel ? `${typeLabel} (monitor record)` : "Note Monitor record";
  }
  return null;
}

export async function getLegacyContractNoteLabels(input: {
  executiveCouncilNoteId?: string | null;
  secretaryNoteId?: string | null;
}) {
  const [executiveCouncilNote, secretaryNote] = await Promise.all([
    input.executiveCouncilNoteId
      ? prisma.note_monitor_records.findUnique({ where: { id: input.executiveCouncilNoteId } })
      : Promise.resolve(null),
    input.secretaryNoteId
      ? prisma.note_monitor_records.findUnique({ where: { id: input.secretaryNoteId } })
      : Promise.resolve(null),
  ]);

  return {
    executiveCouncilNoteLabel: executiveCouncilNote ? formatContractNoteLabel(executiveCouncilNote) : null,
    secretaryNoteLabel: secretaryNote ? formatContractNoteLabel(secretaryNote) : null,
  };
}
