import "server-only";

import { Prisma } from "@prisma/client";

import {
  formatNoteDisplayReference,
  formatNoteStatusLabel,
  formatNoteTypeLabel,
  parseNoteSearchQuery,
  type NoteStatusValue,
  type NoteTypeValue,
} from "@/lib/note-monitor/constants";
import { prisma } from "@/lib/prisma";

const ACTIVE_NOTE_MONITOR_WHERE = { deleted_at: null } satisfies Prisma.note_monitor_recordsWhereInput;

function toIsoDate(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

export type NoteMonitorListRow = {
  id: string;
  noteYear: number;
  noteNumber: number;
  noteType: NoteTypeValue;
  noteTypeLabel: string;
  displayReference: string;
  notePreparationDate: string;
  details: string;
  status: NoteStatusValue;
  statusLabel: string;
  dueDate: string | null;
  linkedContractCount: number;
};

export type NoteMonitorDetailRecord = NoteMonitorListRow & {
  dateReturnedFromSecretary: string | null;
  dateSentToExecutiveCouncil: string | null;
  dateReceivedFromExecutiveCouncil: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string | null;
  updatedByName: string | null;
  linkedContracts: Array<{
    id: string;
    contractNumber: string;
    employeeName: string;
    fileNumber: string;
    status: string;
    role: "executive_council" | "secretary" | "authority";
  }>;
};

export type NoteMonitorHistoryRow = {
  id: string;
  action: string;
  fieldLabel: string | null;
  oldValue: string | null;
  newValue: string | null;
  editedByName: string | null;
  editedAt: string;
};

export type NoteMonitorDropdownOption = {
  value: string;
  label: string;
  searchText: string;
  noteType: NoteTypeValue;
  status: NoteStatusValue;
  noteYear: number;
  noteNumber: number;
  details: string;
};

export type NoteMonitorSearchFilters = {
  year?: number;
  noteType?: NoteTypeValue | "";
  status?: NoteStatusValue | "";
  query?: string;
};

function mapListRow(
  row: {
    id: string;
    note_year: number;
    note_number: number;
    note_type: string;
    display_reference: string;
    note_preparation_date: Date;
    details: string;
    status: string;
    due_date: Date | null;
    _count?: {
      contracts_executive_council: number;
      contracts_secretary: number;
      contracts_authority_note: number;
    };
  },
): NoteMonitorListRow {
  const linkedContractCount =
    (row._count?.contracts_executive_council ?? 0) +
    (row._count?.contracts_secretary ?? 0) +
    (row._count?.contracts_authority_note ?? 0);
  return {
    id: row.id,
    noteYear: row.note_year,
    noteNumber: row.note_number,
    noteType: row.note_type as NoteTypeValue,
    noteTypeLabel: formatNoteTypeLabel(row.note_type),
    displayReference: row.display_reference,
    notePreparationDate: toIsoDate(row.note_preparation_date) ?? "",
    details: row.details,
    status: row.status as NoteStatusValue,
    statusLabel: formatNoteStatusLabel(row.status),
    dueDate: toIsoDate(row.due_date),
    linkedContractCount,
  };
}

export async function listNoteMonitorRecords(filters: NoteMonitorSearchFilters = {}): Promise<NoteMonitorListRow[]> {
  const parsed = parseNoteSearchQuery(filters.query ?? "");
  const year = parsed.noteYear ?? filters.year;
  const noteNumber = parsed.noteNumber;
  const text = parsed.text?.trim();

  const where: Prisma.note_monitor_recordsWhereInput = {
    ...ACTIVE_NOTE_MONITOR_WHERE,
  };

  if (year) where.note_year = year;
  if (filters.noteType) where.note_type = filters.noteType;
  if (filters.status) where.status = filters.status;
  if (noteNumber) where.note_number = noteNumber;
  if (text) {
    where.OR = [
      { details: { contains: text, mode: "insensitive" } },
      { display_reference: { contains: text, mode: "insensitive" } },
      { note_type: { contains: text.replaceAll(" ", "_"), mode: "insensitive" } },
    ];
  }

  try {
    const rows = await prisma.note_monitor_records.findMany({
      where,
      orderBy: [{ note_year: "desc" }, { note_number: "desc" }, { created_at: "desc" }],
      include: {
        _count: {
          select: {
            contracts_executive_council: true,
            contracts_secretary: true,
            contracts_authority_note: true,
          },
        },
      },
    });
    return rows.map(mapListRow);
  } catch {
    return [];
  }
}

export async function getNoteMonitorRecordById(id: string): Promise<NoteMonitorDetailRecord | null> {
  try {
    const row = await prisma.note_monitor_records.findFirst({
      where: { id, ...ACTIVE_NOTE_MONITOR_WHERE },
      include: {
        created_by_user: { select: { profile: { select: { full_name: true } }, email: true } },
        updated_by_user: { select: { profile: { select: { full_name: true } }, email: true } },
        contracts_executive_council: {
          include: { employees: { select: { first_name: true, last_name: true, file_number: true } } },
        },
        contracts_secretary: {
          include: { employees: { select: { first_name: true, last_name: true, file_number: true } } },
        },
        contracts_authority_note: {
          include: { employees: { select: { first_name: true, last_name: true, file_number: true } } },
        },
        _count: {
          select: {
            contracts_executive_council: true,
            contracts_secretary: true,
            contracts_authority_note: true,
          },
        },
      },
    });
    if (!row) return null;

    const linkedContracts = [
      ...row.contracts_executive_council.map((contract) => ({
        id: contract.id,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        status: contract.status,
        role: "executive_council" as const,
      })),
      ...row.contracts_secretary.map((contract) => ({
        id: contract.id,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        status: contract.status,
        role: "secretary" as const,
      })),
      ...row.contracts_authority_note.map((contract) => ({
        id: contract.id,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        status: contract.status,
        role: "authority" as const,
      })),
    ];

    const base = mapListRow(row);
    return {
      ...base,
      dateReturnedFromSecretary: toIsoDate(row.date_returned_from_secretary),
      dateSentToExecutiveCouncil: toIsoDate(row.date_sent_to_executive_council),
      dateReceivedFromExecutiveCouncil: toIsoDate(row.date_received_from_executive_council),
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
      createdByName: row.created_by_user?.profile?.full_name ?? row.created_by_user?.email ?? null,
      updatedByName: row.updated_by_user?.profile?.full_name ?? row.updated_by_user?.email ?? null,
      linkedContracts,
    };
  } catch {
    return null;
  }
}

export async function getNoteMonitorHistory(recordId: string): Promise<NoteMonitorHistoryRow[]> {
  try {
    const rows = await prisma.note_monitor_history.findMany({
      where: { note_monitor_record_id: recordId },
      orderBy: [{ edited_at: "desc" }],
    });
    return rows.map((row) => ({
      id: row.id,
      action: row.action,
      fieldLabel: row.field_label,
      oldValue: row.old_value,
      newValue: row.new_value,
      editedByName: row.edited_by_name,
      editedAt: row.edited_at.toISOString(),
    }));
  } catch {
    return [];
  }
}

export async function listNoteMonitorOptionsForContracts(input?: {
  noteType?: NoteTypeValue;
  includeNonConfirmed?: boolean;
}): Promise<NoteMonitorDropdownOption[]> {
  const where: Prisma.note_monitor_recordsWhereInput = {
    ...ACTIVE_NOTE_MONITOR_WHERE,
  };
  if (input?.noteType) where.note_type = input.noteType;
  if (input?.includeNonConfirmed === false) where.status = "confirmed";

  try {
    const rows = await prisma.note_monitor_records.findMany({
      where,
      orderBy: [{ note_year: "desc" }, { note_number: "desc" }],
      take: 500,
    });

    return rows.map((row) => {
      const noteType = row.note_type as NoteTypeValue;
      const status = row.status as NoteStatusValue;
      const label = `${formatNoteTypeLabel(noteType)} ${formatNoteDisplayReference(row.note_number, row.note_year)} - ${row.details.trim().slice(0, 80)}${row.details.trim().length > 80 ? "…" : ""} - ${formatNoteStatusLabel(status)}`;
      return {
        value: row.id,
        label,
        searchText: [
          row.display_reference,
          formatNoteTypeLabel(noteType),
          row.details,
          formatNoteStatusLabel(status),
          String(row.note_number),
          String(row.note_year),
        ]
          .join(" ")
          .toLowerCase(),
        noteType,
        status,
        noteYear: row.note_year,
        noteNumber: row.note_number,
        details: row.details,
      };
    });
  } catch {
    return [];
  }
}

export async function getNoteMonitorRecordSummaryById(id: string) {
  try {
    return await prisma.note_monitor_records.findFirst({
      where: { id, ...ACTIVE_NOTE_MONITOR_WHERE },
      select: {
        id: true,
        note_year: true,
        note_number: true,
        note_type: true,
        display_reference: true,
        status: true,
        details: true,
      },
    });
  } catch {
    return null;
  }
}

export async function countLinkedContractsForNoteMonitorRecord(recordId: string): Promise<number> {
  return prisma.contracts.count({
    where: {
      OR: [
        { executive_council_note_id: recordId },
        { secretary_note_id: recordId },
        { authority_note_monitor_record_id: recordId },
      ],
    },
  });
}
