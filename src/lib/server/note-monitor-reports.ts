import "server-only";

import { Prisma } from "@prisma/client";

import {
  formatNoteStatusLabel,
  formatNoteTypeLabel,
  normalizeNoteStatus,
  normalizeNoteType,
  parseNoteSearchQuery,
  type NoteStatusValue,
  type NoteTypeValue,
} from "@/lib/note-monitor/constants";
import { prisma } from "@/lib/prisma";

const ACTIVE_NOTE_MONITOR_WHERE = { deleted_at: null } satisfies Prisma.note_monitor_recordsWhereInput;

export type NoteMonitorLinkedContractFilter = "all" | "linked" | "not_linked";

export type NoteMonitorReportFilters = {
  year?: number;
  fromDate?: string;
  toDate?: string;
  noteType?: NoteTypeValue | "";
  status?: NoteStatusValue | "";
  search?: string;
  createdBy?: string;
  linkedToContract?: NoteMonitorLinkedContractFilter;
  dueDateFrom?: string;
  dueDateTo?: string;
};

export type NoteMonitorReportRow = {
  noteYear: number;
  noteNumber: number;
  displayReference: string;
  noteType: string;
  notePreparationDate: string;
  details: string;
  dateReturnedFromSecretary: string;
  dateSentToExecutiveCouncil: string;
  dateReceivedFromExecutiveCouncil: string;
  dueDate: string;
  status: string;
  linkedContracts: string;
  createdBy: string;
  createdDate: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
};

export type NoteMonitorIndividualExportRecord = {
  displayReference: string;
  noteType: string;
  noteYear: number;
  noteNumber: number;
  notePreparationDate: string;
  details: string;
  dateReturnedFromSecretary: string;
  dateSentToExecutiveCouncil: string;
  dateReceivedFromExecutiveCouncil: string;
  dueDate: string;
  status: string;
  createdBy: string;
  createdDate: string;
  lastUpdatedBy: string;
  lastUpdatedDate: string;
  linkedContracts: Array<{
    employeeName: string;
    fileNumber: string;
    contractNumber: string;
    role: string;
    status: string;
  }>;
  history: Array<{
    editedAt: string;
    editedBy: string;
    action: string;
    field: string;
    previousValue: string;
    newValue: string;
  }>;
};

export type NoteMonitorCreatorOption = {
  value: string;
  label: string;
};

function toIsoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

function toDisplayDateTime(value: Date): string {
  return value.toLocaleString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function linkedContractRoleLabel(role: "executive_council" | "secretary" | "authority"): string {
  switch (role) {
    case "executive_council":
      return "Executive Council Note";
    case "secretary":
      return "Secretary Note";
    case "authority":
      return "Authority Note";
  }
}

function formatLinkedContractSummary(input: {
  employeeName: string;
  fileNumber: string;
  contractNumber: string;
  role: "executive_council" | "secretary" | "authority";
  status: string;
}): string {
  return `${input.employeeName} · File #${input.fileNumber} · Contract #${input.contractNumber} (${linkedContractRoleLabel(input.role)}) · ${input.status.replaceAll("_", " ")}`;
}

function buildLinkedContractsFromRow(row: {
  contracts_executive_council: Array<{
    contract_number: string | null;
    status: string;
    employees: { first_name: string; last_name: string; file_number: string };
  }>;
  contracts_secretary: Array<{
    contract_number: string | null;
    status: string;
    employees: { first_name: string; last_name: string; file_number: string };
  }>;
  contracts_authority_note: Array<{
    contract_number: string | null;
    status: string;
    employees: { first_name: string; last_name: string; file_number: string };
  }>;
}): string {
  const linked = [
    ...row.contracts_executive_council.map((contract) =>
      formatLinkedContractSummary({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: "executive_council",
        status: contract.status,
      }),
    ),
    ...row.contracts_secretary.map((contract) =>
      formatLinkedContractSummary({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: "secretary",
        status: contract.status,
      }),
    ),
    ...row.contracts_authority_note.map((contract) =>
      formatLinkedContractSummary({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: "authority",
        status: contract.status,
      }),
    ),
  ];
  return linked.join("; ");
}

function buildWhereClause(filters: NoteMonitorReportFilters): Prisma.note_monitor_recordsWhereInput {
  const parsedSearch = parseNoteSearchQuery(filters.search ?? "");
  const year = parsedSearch.noteYear ?? filters.year ?? new Date().getFullYear();
  const conditions: Prisma.note_monitor_recordsWhereInput[] = [ACTIVE_NOTE_MONITOR_WHERE, { note_year: year }];

  if (filters.noteType) conditions.push({ note_type: filters.noteType });
  if (filters.status) conditions.push({ status: filters.status });
  if (parsedSearch.noteNumber) conditions.push({ note_number: parsedSearch.noteNumber });
  if (filters.createdBy) conditions.push({ created_by: filters.createdBy });

  const text = parsedSearch.text?.trim();
  if (text) {
    conditions.push({
      OR: [
        { details: { contains: text, mode: "insensitive" } },
        { display_reference: { contains: text, mode: "insensitive" } },
        { note_type: { contains: text.replaceAll(" ", "_"), mode: "insensitive" } },
      ],
    });
  }

  if (filters.fromDate || filters.toDate) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (filters.fromDate) dateFilter.gte = new Date(`${filters.fromDate}T00:00:00`);
    if (filters.toDate) dateFilter.lte = new Date(`${filters.toDate}T00:00:00`);
    conditions.push({ note_preparation_date: dateFilter });
  }

  if (filters.dueDateFrom || filters.dueDateTo) {
    const dueFilter: Prisma.DateTimeFilter = {};
    if (filters.dueDateFrom) dueFilter.gte = new Date(`${filters.dueDateFrom}T00:00:00`);
    if (filters.dueDateTo) dueFilter.lte = new Date(`${filters.dueDateTo}T00:00:00`);
    conditions.push({ due_date: dueFilter });
  }

  if (filters.linkedToContract === "linked") {
    conditions.push({
      OR: [
        { contracts_executive_council: { some: {} } },
        { contracts_secretary: { some: {} } },
        { contracts_authority_note: { some: {} } },
      ],
    });
  } else if (filters.linkedToContract === "not_linked") {
    conditions.push(
      { contracts_executive_council: { none: {} } },
      { contracts_secretary: { none: {} } },
      { contracts_authority_note: { none: {} } },
    );
  }

  return { AND: conditions };
}

const reportInclude = {
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
} satisfies Prisma.note_monitor_recordsInclude;

function mapReportRow(row: Prisma.note_monitor_recordsGetPayload<{ include: typeof reportInclude }>): NoteMonitorReportRow {
  return {
    noteYear: row.note_year,
    noteNumber: row.note_number,
    displayReference: row.display_reference,
    noteType: formatNoteTypeLabel(row.note_type),
    notePreparationDate: toIsoDate(row.note_preparation_date),
    details: row.details,
    dateReturnedFromSecretary: toIsoDate(row.date_returned_from_secretary),
    dateSentToExecutiveCouncil: toIsoDate(row.date_sent_to_executive_council),
    dateReceivedFromExecutiveCouncil: toIsoDate(row.date_received_from_executive_council),
    dueDate: toIsoDate(row.due_date),
    status: formatNoteStatusLabel(row.status),
    linkedContracts: buildLinkedContractsFromRow(row),
    createdBy: row.created_by_user?.profile?.full_name ?? row.created_by_user?.email ?? "",
    createdDate: toDisplayDateTime(row.created_at),
    lastUpdatedBy: row.updated_by_user?.profile?.full_name ?? row.updated_by_user?.email ?? "",
    lastUpdatedDate: toDisplayDateTime(row.updated_at),
  };
}

export function normalizeNoteMonitorReportFilters(input: Partial<NoteMonitorReportFilters>): NoteMonitorReportFilters {
  const noteType = input.noteType ? normalizeNoteType(String(input.noteType)) : null;
  const status = input.status ? normalizeNoteStatus(String(input.status)) : null;
  const linked = input.linkedToContract ?? "all";
  const year = input.year ? Number(input.year) : new Date().getFullYear();

  return {
    year: Number.isFinite(year) ? year : new Date().getFullYear(),
    fromDate: input.fromDate?.trim() || undefined,
    toDate: input.toDate?.trim() || undefined,
    noteType: noteType ?? "",
    status: status ?? "",
    search: input.search?.trim() || undefined,
    createdBy: input.createdBy?.trim() || undefined,
    linkedToContract: linked === "linked" || linked === "not_linked" ? linked : "all",
    dueDateFrom: input.dueDateFrom?.trim() || undefined,
    dueDateTo: input.dueDateTo?.trim() || undefined,
  };
}

export function validateNoteMonitorReportFilters(filters: NoteMonitorReportFilters): string | null {
  if (filters.fromDate && filters.toDate && filters.fromDate > filters.toDate) {
    return "From Date cannot be after To Date.";
  }
  if (filters.dueDateFrom && filters.dueDateTo && filters.dueDateFrom > filters.dueDateTo) {
    return "Due Date From cannot be after Due Date To.";
  }
  return null;
}

export async function queryNoteMonitorReportRecords(
  filtersInput: Partial<NoteMonitorReportFilters>,
  options?: { limit?: number },
): Promise<{ rows: NoteMonitorReportRow[]; totalCount: number; filters: NoteMonitorReportFilters }> {
  const filters = normalizeNoteMonitorReportFilters(filtersInput);
  const where = buildWhereClause(filters);

  const activeWhere: Prisma.note_monitor_recordsWhereInput = {
    AND: [ACTIVE_NOTE_MONITOR_WHERE, where],
  };

  const [rows, totalCount] = await Promise.all([
    prisma.note_monitor_records.findMany({
      where: activeWhere,
      orderBy: [{ note_year: "desc" }, { note_number: "desc" }, { created_at: "desc" }],
      include: reportInclude,
      ...(options?.limit ? { take: options.limit } : {}),
    }),
    prisma.note_monitor_records.count({ where: activeWhere }),
  ]);

  return {
    rows: rows.map(mapReportRow),
    totalCount,
    filters,
  };
}

export async function getNoteMonitorReportRecordForExport(id: string): Promise<NoteMonitorIndividualExportRecord | null> {
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
        note_monitor_history: {
          orderBy: [{ edited_at: "desc" }],
        },
      },
    });
    if (!row) return null;

    const linkedContracts = [
      ...row.contracts_executive_council.map((contract) => ({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: linkedContractRoleLabel("executive_council"),
        status: contract.status.replaceAll("_", " "),
      })),
      ...row.contracts_secretary.map((contract) => ({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: linkedContractRoleLabel("secretary"),
        status: contract.status.replaceAll("_", " "),
      })),
      ...row.contracts_authority_note.map((contract) => ({
        employeeName: `${contract.employees.first_name} ${contract.employees.last_name}`.trim(),
        fileNumber: contract.employees.file_number,
        contractNumber: contract.contract_number?.trim() || "No assigned number",
        role: linkedContractRoleLabel("authority"),
        status: contract.status.replaceAll("_", " "),
      })),
    ];

    return {
      displayReference: row.display_reference,
      noteType: formatNoteTypeLabel(row.note_type),
      noteYear: row.note_year,
      noteNumber: row.note_number,
      notePreparationDate: toIsoDate(row.note_preparation_date),
      details: row.details,
      dateReturnedFromSecretary: toIsoDate(row.date_returned_from_secretary),
      dateSentToExecutiveCouncil: toIsoDate(row.date_sent_to_executive_council),
      dateReceivedFromExecutiveCouncil: toIsoDate(row.date_received_from_executive_council),
      dueDate: toIsoDate(row.due_date),
      status: formatNoteStatusLabel(row.status),
      createdBy: row.created_by_user?.profile?.full_name ?? row.created_by_user?.email ?? "",
      createdDate: toDisplayDateTime(row.created_at),
      lastUpdatedBy: row.updated_by_user?.profile?.full_name ?? row.updated_by_user?.email ?? "",
      lastUpdatedDate: toDisplayDateTime(row.updated_at),
      linkedContracts,
      history: row.note_monitor_history.map((entry) => ({
        editedAt: toDisplayDateTime(entry.edited_at),
        editedBy: entry.edited_by_name ?? "",
        action: entry.action,
        field: entry.field_label ?? "",
        previousValue: entry.old_value ?? "",
        newValue: entry.new_value ?? "",
      })),
    };
  } catch {
    return null;
  }
}

export async function listNoteMonitorCreatorOptions(): Promise<NoteMonitorCreatorOption[]> {
  try {
    const rows = await prisma.note_monitor_records.findMany({
      where: { ...ACTIVE_NOTE_MONITOR_WHERE, created_by: { not: null } },
      distinct: ["created_by"],
      select: {
        created_by: true,
        created_by_user: { select: { profile: { select: { full_name: true } }, email: true } },
      },
      orderBy: [{ created_at: "desc" }],
    });

    return rows
      .filter((row): row is typeof row & { created_by: string } => Boolean(row.created_by))
      .map((row) => ({
        value: row.created_by,
        label: row.created_by_user?.profile?.full_name ?? row.created_by_user?.email ?? "Unknown user",
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  } catch {
    return [];
  }
}

export function buildNoteMonitorReportFileName(filters: NoteMonitorReportFilters): string {
  const from = filters.fromDate?.trim();
  const to = filters.toDate?.trim();
  if (from && to) return `note-monitor-report-${from}-to-${to}.xlsx`;
  return `note-monitor-report-${filters.year ?? new Date().getFullYear()}.xlsx`;
}

export function buildNoteMonitorIndividualFileName(displayReference: string): string {
  const slug = displayReference.toLowerCase().replaceAll(" ", "-");
  return `note-monitor-${slug}.xlsx`;
}

export function buildNoteMonitorExportAuditDescription(filters: NoteMonitorReportFilters): string {
  const from = filters.fromDate?.trim();
  const to = filters.toDate?.trim();
  if (from && to) return `Exported Note Monitor report from ${from} to ${to}`;
  return `Exported Note Monitor report for year ${filters.year ?? new Date().getFullYear()}`;
}

export function buildNoteMonitorIndividualExportAuditDescription(displayReference: string): string {
  return `Exported individual note record: ${displayReference}`;
}

export function formatNoteMonitorFiltersForDisplay(filters: NoteMonitorReportFilters): Record<string, string> {
  const output: Record<string, string> = {
    Year: String(filters.year ?? new Date().getFullYear()),
  };
  if (filters.fromDate) output["From Date"] = filters.fromDate;
  if (filters.toDate) output["To Date"] = filters.toDate;
  if (filters.noteType) output["Note Type"] = formatNoteTypeLabel(filters.noteType);
  if (filters.status) output["Status"] = formatNoteStatusLabel(filters.status);
  if (filters.search) output["Search"] = filters.search;
  if (filters.createdBy) output["Created By"] = filters.createdBy;
  if (filters.linkedToContract && filters.linkedToContract !== "all") {
    output["Linked to Contract"] = filters.linkedToContract === "linked" ? "Linked" : "Not Linked";
  }
  if (filters.dueDateFrom) output["Due Date From"] = filters.dueDateFrom;
  if (filters.dueDateTo) output["Due Date To"] = filters.dueDateTo;
  return output;
}
