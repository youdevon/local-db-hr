import type { StatusTone } from "@/components/status-badge";
import {
  formatNoteDropdownLabel,
  formatNoteStatusLabel,
  formatNoteTypeLabel,
  getNoteStatusTone,
} from "@/lib/note-monitor/constants";

function formatLegacyNoteLabel(note: NoteMonitorSnapshot): string {
  return formatNoteDropdownLabel({
    noteType: note.note_type,
    noteNumber: note.note_number,
    noteYear: note.note_year,
    details: note.details,
    status: note.status,
  });
}

type NoteMonitorSnapshot = {
  id: string;
  note_type: string;
  display_reference: string;
  details: string;
  status: string;
  note_number: number;
  note_year: number;
};

export type ContractAuthorityNoteInput = {
  authorityNoteType: string | null;
  authorityNoteMonitorRecordId: string | null;
  authorityNoteManualReference: string | null;
  authorityNoteMonitorRecord: NoteMonitorSnapshot | null;
  minuteNumber: string | null;
  executiveCouncilNoteId: string | null;
  secretaryNoteId: string | null;
  executiveCouncilNote: NoteMonitorSnapshot | null;
  secretaryNote: NoteMonitorSnapshot | null;
};

export type ContractAuthorityDisplay = {
  authorityTypeLabel: string | null;
  authorityReference: string | null;
  noteMonitorId: string | null;
  noteDetails: string | null;
  noteStatus: string | null;
  noteStatusLabel: string | null;
  noteStatusTone: StatusTone;
  sourceLabel: string | null;
};

export type ContractAuthorityLegacyInfo = {
  showSection: boolean;
  executiveCouncilNoteId: string | null;
  executiveCouncilNoteLabel: string | null;
  secretaryNoteId: string | null;
  secretaryNoteLabel: string | null;
  storedMinuteNumber: string | null;
};

function normalizeReference(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function referencesMatch(a: string | null, b: string | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return a.localeCompare(b, undefined, { sensitivity: "accent" }) === 0;
}

function legacyNoteDiffersFromAuthority(
  legacyNoteId: string | null,
  input: ContractAuthorityNoteInput,
): boolean {
  if (!legacyNoteId) return false;
  if (input.authorityNoteMonitorRecordId) {
    return legacyNoteId !== input.authorityNoteMonitorRecordId;
  }
  return true;
}

export function buildContractAuthorityDisplay(
  input: ContractAuthorityNoteInput,
): ContractAuthorityDisplay {
  const authorityType = normalizeReference(input.authorityNoteType);
  const manualReference = normalizeReference(input.authorityNoteManualReference);
  const monitor = input.authorityNoteMonitorRecord;

  if (authorityType) {
    const authorityTypeLabel = formatNoteTypeLabel(authorityType);
    if (input.authorityNoteMonitorRecordId && monitor) {
      return {
        authorityTypeLabel,
        authorityReference: monitor.display_reference,
        noteMonitorId: monitor.id,
        noteDetails: monitor.details.trim() || null,
        noteStatus: monitor.status,
        noteStatusLabel: formatNoteStatusLabel(monitor.status),
        noteStatusTone: getNoteStatusTone(monitor.status),
        sourceLabel: "Note Monitor",
      };
    }
    if (manualReference) {
      const hasLegacyNoteIds = Boolean(input.executiveCouncilNoteId || input.secretaryNoteId);
      const hasUnifiedMonitor = Boolean(input.authorityNoteMonitorRecordId);
      return {
        authorityTypeLabel,
        authorityReference: manualReference,
        noteMonitorId: null,
        noteDetails: null,
        noteStatus: null,
        noteStatusLabel: null,
        noteStatusTone: "default",
        sourceLabel: hasLegacyNoteIds && !hasUnifiedMonitor ? "Legacy Entry" : "Manual",
      };
    }
    return {
      authorityTypeLabel,
      authorityReference: null,
      noteMonitorId: null,
      noteDetails: null,
      noteStatus: null,
      noteStatusLabel: null,
      noteStatusTone: "default",
      sourceLabel: null,
    };
  }

  if (input.executiveCouncilNote) {
    const note = input.executiveCouncilNote;
    return {
      authorityTypeLabel: formatNoteTypeLabel(note.note_type),
      authorityReference: note.display_reference,
      noteMonitorId: note.id,
      noteDetails: note.details.trim() || null,
      noteStatus: note.status,
      noteStatusLabel: formatNoteStatusLabel(note.status),
      noteStatusTone: getNoteStatusTone(note.status),
      sourceLabel: "Note Monitor",
    };
  }

  if (input.secretaryNote) {
    const note = input.secretaryNote;
    return {
      authorityTypeLabel: formatNoteTypeLabel(note.note_type),
      authorityReference: note.display_reference,
      noteMonitorId: note.id,
      noteDetails: note.details.trim() || null,
      noteStatus: note.status,
      noteStatusLabel: formatNoteStatusLabel(note.status),
      noteStatusTone: getNoteStatusTone(note.status),
      sourceLabel: "Note Monitor",
    };
  }

  const minuteOnly = normalizeReference(input.minuteNumber);
  if (minuteOnly) {
    return {
      authorityTypeLabel: null,
      authorityReference: minuteOnly,
      noteMonitorId: null,
      noteDetails: null,
      noteStatus: null,
      noteStatusLabel: null,
      noteStatusTone: "default",
      sourceLabel: "Legacy Entry",
    };
  }

  return {
    authorityTypeLabel: null,
    authorityReference: null,
    noteMonitorId: null,
    noteDetails: null,
    noteStatus: null,
    noteStatusLabel: null,
    noteStatusTone: "default",
    sourceLabel: null,
  };
}

export function buildContractAuthorityLegacyInfo(
  input: ContractAuthorityNoteInput,
  authority: ContractAuthorityDisplay,
): ContractAuthorityLegacyInfo {
  const storedMinuteNumber = normalizeReference(input.minuteNumber);
  const currentReference = normalizeReference(authority.authorityReference);
  const legacyExecutiveDiffers = legacyNoteDiffersFromAuthority(input.executiveCouncilNoteId, input);
  const legacySecretaryDiffers = legacyNoteDiffersFromAuthority(input.secretaryNoteId, input);
  const bothLegacyNotes =
    Boolean(input.executiveCouncilNoteId) && Boolean(input.secretaryNoteId);
  const minuteMismatch =
    Boolean(storedMinuteNumber) && !referencesMatch(storedMinuteNumber, currentReference);

  const showExecutiveLegacy =
    Boolean(input.executiveCouncilNoteId) && (legacyExecutiveDiffers || bothLegacyNotes);
  const showSecretaryLegacy =
    Boolean(input.secretaryNoteId) && (legacySecretaryDiffers || bothLegacyNotes);
  const showSection =
    showExecutiveLegacy || showSecretaryLegacy || minuteMismatch;

  return {
    showSection,
    executiveCouncilNoteId: showExecutiveLegacy ? input.executiveCouncilNoteId : null,
    executiveCouncilNoteLabel:
      showExecutiveLegacy && input.executiveCouncilNote
        ? formatLegacyNoteLabel(input.executiveCouncilNote)
        : null,
    secretaryNoteId: showSecretaryLegacy ? input.secretaryNoteId : null,
    secretaryNoteLabel:
      showSecretaryLegacy && input.secretaryNote ? formatLegacyNoteLabel(input.secretaryNote) : null,
    storedMinuteNumber: minuteMismatch ? storedMinuteNumber : null,
  };
}

function noteSnapshotFromContractRecord(contract: {
  authorityNoteMonitorRecordId?: string | null;
  authorityNoteMonitorDisplayReference?: string | null;
  authorityNoteMonitorDetails?: string | null;
  authorityNoteMonitorStatus?: string | null;
  authorityNoteType?: string | null;
}): NoteMonitorSnapshot | null {
  if (!contract.authorityNoteMonitorRecordId) return null;
  return {
    id: contract.authorityNoteMonitorRecordId,
    note_type: contract.authorityNoteType ?? "",
    display_reference: contract.authorityNoteMonitorDisplayReference ?? "",
    details: contract.authorityNoteMonitorDetails ?? "",
    status: contract.authorityNoteMonitorStatus ?? "pending",
    note_number: 0,
    note_year: 0,
  };
}

function toNoteSnapshot(
  note:
    | NoteMonitorSnapshot
    | {
        id: string;
        noteType: string;
        displayReference: string;
        details: string;
        status: string;
        noteNumber: number;
        noteYear: number;
      }
    | null
    | undefined,
): NoteMonitorSnapshot | null {
  if (!note) return null;
  if ("note_type" in note) return note;
  return {
    id: note.id,
    note_type: note.noteType,
    display_reference: note.displayReference,
    details: note.details,
    status: note.status,
    note_number: note.noteNumber,
    note_year: note.noteYear,
  };
}

export function contractAuthorityNoteInputFromRecord(contract: {
  authorityNoteType?: string | null;
  authorityNoteMonitorRecordId?: string | null;
  authorityNoteManualReference?: string | null;
  authorityNoteMonitorRecord?: NoteMonitorSnapshot | null;
  authorityNoteMonitor?: {
    id: string;
    noteType: string;
    displayReference: string;
    details: string;
    status: string;
    noteNumber: number;
    noteYear: number;
  } | null;
  authorityNoteMonitorDisplayReference?: string | null;
  authorityNoteMonitorDetails?: string | null;
  authorityNoteMonitorStatus?: string | null;
  minuteNumber?: string | null;
  executiveCouncilNoteId?: string | null;
  secretaryNoteId?: string | null;
  executiveCouncilNote?: NoteMonitorSnapshot | { id: string; noteType: string; displayReference: string; details: string; status: string; noteNumber: number; noteYear: number } | null;
  secretaryNote?: NoteMonitorSnapshot | { id: string; noteType: string; displayReference: string; details: string; status: string; noteNumber: number; noteYear: number } | null;
}): ContractAuthorityNoteInput {
  const authorityNoteMonitorRecord =
    contract.authorityNoteMonitorRecord ??
    toNoteSnapshot(contract.authorityNoteMonitor) ??
    noteSnapshotFromContractRecord(contract);

  return {
    authorityNoteType: contract.authorityNoteType ?? null,
    authorityNoteMonitorRecordId: contract.authorityNoteMonitorRecordId ?? null,
    authorityNoteManualReference: contract.authorityNoteManualReference ?? null,
    authorityNoteMonitorRecord,
    minuteNumber: contract.minuteNumber ?? null,
    executiveCouncilNoteId: contract.executiveCouncilNote?.id ?? null,
    secretaryNoteId: contract.secretaryNote?.id ?? null,
    executiveCouncilNote: toNoteSnapshot(contract.executiveCouncilNote),
    secretaryNote: toNoteSnapshot(contract.secretaryNote),
  };
}
