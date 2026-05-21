import type { StatusTone } from "@/components/status-badge";

export const NOTE_TYPE_VALUES = [
  "executive_council_note",
  "secretary_note",
  "cabinet",
  "short_term",
] as const;

export type NoteTypeValue = (typeof NOTE_TYPE_VALUES)[number];

export const NOTE_TYPE_OPTIONS: Array<{ value: NoteTypeValue; label: string; shortLabel: string }> = [
  { value: "executive_council_note", label: "Executive Council Note", shortLabel: "ECM" },
  { value: "secretary_note", label: "Secretary Note", shortLabel: "SN" },
  { value: "cabinet", label: "Cabinet", shortLabel: "Cabinet" },
  { value: "short_term", label: "Short Term", shortLabel: "Short Term" },
];

export const NOTE_STATUS_VALUES = ["pending", "confirmed", "rejected", "resubmitted"] as const;

export type NoteStatusValue = (typeof NOTE_STATUS_VALUES)[number];

export const NOTE_STATUS_OPTIONS: Array<{ value: NoteStatusValue; label: string }> = [
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "rejected", label: "Rejected" },
  { value: "resubmitted", label: "Resubmitted" },
];

export function formatNoteDisplayReference(noteNumber: number, noteYear: number): string {
  return `${noteNumber} of ${noteYear}`;
}

export function formatNoteTypeLabel(noteType: string): string {
  return NOTE_TYPE_OPTIONS.find((option) => option.value === noteType)?.label ?? noteType;
}

export function formatNoteTypeShortLabel(noteType: string): string {
  return NOTE_TYPE_OPTIONS.find((option) => option.value === noteType)?.shortLabel ?? noteType;
}

export function formatNoteStatusLabel(status: string): string {
  return NOTE_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? status;
}

export function normalizeNoteStatus(status: string): NoteStatusValue {
  const normalized = status.trim().toLowerCase().replaceAll(" ", "_");
  if ((NOTE_STATUS_VALUES as readonly string[]).includes(normalized)) {
    return normalized as NoteStatusValue;
  }
  return "pending";
}

export function normalizeNoteType(noteType: string): NoteTypeValue | null {
  const normalized = noteType.trim().toLowerCase().replaceAll(" ", "_").replaceAll("-", "_");
  if ((NOTE_TYPE_VALUES as readonly string[]).includes(normalized)) {
    return normalized as NoteTypeValue;
  }
  return null;
}

export function getNoteStatusTone(status: string): StatusTone {
  switch (normalizeNoteStatus(status)) {
    case "confirmed":
      return "success";
    case "rejected":
      return "danger";
    case "resubmitted":
      return "default";
    case "pending":
    default:
      return "warning";
  }
}

export function formatNoteDropdownLabel(input: {
  noteType: string;
  noteNumber: number;
  noteYear: number;
  details: string;
  status: string;
}): string {
  const typeShort = formatNoteTypeShortLabel(input.noteType);
  const reference = formatNoteDisplayReference(input.noteNumber, input.noteYear);
  const details = input.details.trim().slice(0, 80);
  const status = formatNoteStatusLabel(input.status);
  return `${typeShort} ${reference} - ${details}${input.details.trim().length > 80 ? "…" : ""} - ${status}`;
}

export function parseNoteSearchQuery(query: string): {
  noteYear?: number;
  noteNumber?: number;
  text?: string;
} {
  const trimmed = query.trim();
  if (!trimmed) return {};

  const ofMatch = trimmed.match(/^(\d+)\s+of\s+(\d{4})$/i);
  if (ofMatch) {
    return {
      noteNumber: Number(ofMatch[1]),
      noteYear: Number(ofMatch[2]),
    };
  }

  const yearOnly = trimmed.match(/^(\d{4})$/);
  if (yearOnly) {
    return { noteYear: Number(yearOnly[1]) };
  }

  return { text: trimmed };
}
