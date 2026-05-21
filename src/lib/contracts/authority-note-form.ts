import type { AuthorityReferenceMode, ContractRecord } from "@/lib/mock/contracts";
import { NOTE_TYPE_VALUES, type NoteTypeValue } from "@/lib/note-monitor/constants";
import type { ContractFormValues } from "@/lib/validators/contract-form";

export type AuthorityNoteFormSlice = Pick<
  ContractFormValues,
  | "authorityNoteType"
  | "authorityReferenceMode"
  | "authorityNoteMonitorRecordId"
  | "authorityNoteManualReference"
>;

export function emptyAuthorityNoteFormValues(): AuthorityNoteFormSlice {
  return {
    authorityNoteType: "",
    authorityReferenceMode: "",
    authorityNoteMonitorRecordId: "",
    authorityNoteManualReference: "",
  };
}

export function contractAuthorityNoteDefaults(contract?: ContractRecord): AuthorityNoteFormSlice {
  if (!contract) return emptyAuthorityNoteFormValues();

  if (contract.authorityNoteType && (NOTE_TYPE_VALUES as readonly string[]).includes(contract.authorityNoteType)) {
    const referenceMode: AuthorityReferenceMode | "" =
      contract.authorityReferenceMode ??
      (contract.authorityNoteMonitorRecordId ? "note_monitor" : contract.authorityNoteManualReference ? "manual" : "");

    return {
      authorityNoteType: contract.authorityNoteType as NoteTypeValue,
      authorityReferenceMode: referenceMode,
      authorityNoteMonitorRecordId: contract.authorityNoteMonitorRecordId ?? "",
      authorityNoteManualReference:
        contract.authorityNoteManualReference?.trim() ||
        (referenceMode === "manual" ? contract.minuteNumber?.trim() || "" : ""),
    };
  }

  if (contract.executiveCouncilNote?.id) {
    return {
      authorityNoteType: "executive_council_note",
      authorityReferenceMode: "note_monitor",
      authorityNoteMonitorRecordId: contract.executiveCouncilNote.id,
      authorityNoteManualReference: "",
    };
  }

  if (contract.secretaryNote?.id) {
    return {
      authorityNoteType: "secretary_note",
      authorityReferenceMode: "note_monitor",
      authorityNoteMonitorRecordId: contract.secretaryNote.id,
      authorityNoteManualReference: "",
    };
  }

  if (contract.minuteNumber?.trim()) {
    return {
      authorityNoteType: "executive_council_note",
      authorityReferenceMode: "manual",
      authorityNoteMonitorRecordId: "",
      authorityNoteManualReference: contract.minuteNumber.trim(),
    };
  }

  return emptyAuthorityNoteFormValues();
}
