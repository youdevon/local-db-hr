import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  assertEmployeesTableReady,
  DatabaseSetupError,
  isMissingEmployeesTableError,
} from "@/lib/server/database-setup";
import type {
  EmployeeAddressRow,
  EmployeeDocumentRow,
  EmployeeEmergencyContactRow,
  EmployeeIdentification,
  EmployeePositionHistoryRow,
  EmployeeRecord,
} from "@/lib/mock/employees";
import type { ContractListRow, ContractNoteMonitorSnapshot, ContractRecord } from "@/lib/mock/contracts";
import { formatCurrencyTTD } from "@/lib/mock/contracts";
import { getFullName } from "@/lib/mock/employees";
import { formatContractNoteLabel } from "@/lib/server/contract-note-links";

function toIsoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

type EmployeeWithRelations = Prisma.employeesGetPayload<{
  include: {
    employee_addresses: true;
    employee_emergency_contacts: true;
    employee_identifications: true;
    employee_documents: true;
    employee_position_history: true;
    employee_right_to_work: true;
    contracts: true;
  };
}>;

type ContractWithEmployee = Prisma.contractsGetPayload<{
  include: { employees: true };
}>;

type ContractWithAllowances = Prisma.contractsGetPayload<{
  include: {
    contract_allowances: true;
    executive_council_note: true;
    secretary_note: true;
    authority_note_monitor_record: true;
  };
}>;

function mapNoteMonitorSnapshot(
  note: {
    id: string;
    note_type: string;
    display_reference: string;
    details: string;
    status: string;
    note_number: number;
    note_year: number;
  } | null | undefined,
): ContractNoteMonitorSnapshot | null {
  if (!note) return null;
  return {
    id: note.id,
    noteType: note.note_type,
    displayReference: note.display_reference,
    details: note.details,
    status: note.status,
    noteNumber: note.note_number,
    noteYear: note.note_year,
  };
}

function mapContractRecord(row: ContractWithAllowances): ContractRecord {
  const legacyExecutiveCouncilNoteLabel = row.executive_council_note
    ? formatContractNoteLabel(row.executive_council_note)
    : null;
  const legacySecretaryNoteLabel = row.secretary_note ? formatContractNoteLabel(row.secretary_note) : null;
  const authorityNoteMonitorRecordLabel = row.authority_note_monitor_record
    ? formatContractNoteLabel(row.authority_note_monitor_record)
    : null;

  return {
    id: row.id,
    employeeId: row.employee_id,
    minuteNumber: row.minute_number?.trim() || null,
    authorityNoteType: (row.authority_note_type as ContractRecord["authorityNoteType"]) ?? null,
    authorityReferenceMode: row.authority_note_monitor_record_id
      ? "note_monitor"
      : row.authority_note_manual_reference?.trim()
        ? "manual"
        : null,
    authorityNoteMonitorRecordId: row.authority_note_monitor_record_id ?? null,
    authorityNoteManualReference: row.authority_note_manual_reference?.trim() || null,
    authorityNoteMonitorRecordLabel,
    authorityNoteMonitorDisplayReference: row.authority_note_monitor_record?.display_reference ?? null,
    authorityNoteMonitorDetails: row.authority_note_monitor_record?.details ?? null,
    authorityNoteMonitorStatus: row.authority_note_monitor_record?.status ?? null,
    authorityNoteMonitor: mapNoteMonitorSnapshot(row.authority_note_monitor_record),
    executiveCouncilNote: mapNoteMonitorSnapshot(row.executive_council_note),
    secretaryNote: mapNoteMonitorSnapshot(row.secretary_note),
    legacyExecutiveCouncilNoteLabel,
    legacySecretaryNoteLabel,
    contractNumber: row.contract_number ?? null,
    startDate: toIsoDate(row.start_date),
    endDate: toIsoDate(row.end_date),
    dateReceived: toIsoDate(row.date_received),
    dateSigned: toIsoDate(row.date_signed),
    salary: Number(row.salary),
    gratuity: Number(row.gratuity),
    vacationLeaveEntitlement: Number(row.vacation_leave_entitlement),
    sickLeaveEntitlement: Number(row.sick_leave_entitlement),
    vacationRolloverAllowed: row.vacation_rollover_allowed,
    sickRolloverAllowed: row.sick_rollover_allowed,
    status: (row.status ?? "draft").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) as ContractRecord["status"],
    notes: row.notes ?? "",
    retirementOverrideRequired: row.retirement_override_required ?? false,
    retirementOverrideReason: row.retirement_override_reason ?? null,
    retirementOverrideApprovalReference: row.retirement_override_approval_reference ?? null,
    retirementCutoffDate: row.retirement_cutoff_date ? toIsoDate(row.retirement_cutoff_date) : null,
    createdAt: toIsoDate(row.created_at),
    updatedAt: toIsoDate(row.updated_at),
    allowances: row.contract_allowances.map((a) => ({
      aid: a.id,
      allowanceType: (a.allowance_type ?? "") as ContractRecord["allowances"][number]["allowanceType"],
      description: a.description ?? "",
      amount: Number(a.amount),
      frequency: (a.frequency ?? "") as ContractRecord["allowances"][number]["frequency"],
      startDate: toIsoDate(a.start_date),
      endDate: toIsoDate(a.end_date),
      taxable: a.taxable,
      notes: a.notes ?? "",
    })),
  };
}

function mapAddress(row: {
  id: string;
  address_type: string;
  address_line_1: string;
  address_line_2: string | null;
  community_city: string;
  region_municipality: string | null;
  country: string;
  postal_code: string | null;
  same_as_residential: boolean;
  is_primary: boolean;
}): EmployeeAddressRow {
  return {
    aid: row.id,
    addressType: row.address_type === "mailing" ? "Mailing" : "Residential",
    addressLine1: row.address_line_1 ?? "",
    addressLine2: row.address_line_2 ?? "",
    communityCity: row.community_city ?? "",
    regionMunicipality: row.region_municipality ?? "",
    country: row.country ?? "",
    postalCode: row.postal_code ?? "",
    sameAsResidential: row.same_as_residential ?? false,
    isPrimary: row.is_primary ?? false,
  };
}

function mapEmployee(row: EmployeeWithRelations): EmployeeRecord {
  const emergencyContacts: EmployeeEmergencyContactRow[] = row.employee_emergency_contacts.map((contact) => ({
    cid: contact.id,
    contactType:
      contact.contact_type === "secondary_emergency"
        ? "secondary_emergency"
        : contact.contact_type === "next_of_kin"
          ? "next_of_kin"
          : "primary_emergency",
    contactName: contact.contact_name ?? "",
    relationship: contact.relationship ?? "",
    mobileNumber: contact.mobile_number ?? "",
    alternativeNumber: contact.alternative_number ?? "",
    email: contact.email ?? "",
    address: contact.address ?? "",
    isPrimary: contact.is_primary ?? false,
  }));

  const identifications: EmployeeIdentification[] = row.employee_identifications.map((id) => ({
    sid: id.id,
    idType: (id.id_type ?? "") as EmployeeIdentification["idType"],
    idNumber: id.id_number ?? "",
    issuingCountry: id.issuing_country ?? "",
    issueDate: toIsoDate(id.issue_date),
    expiryDate: toIsoDate(id.expiry_date),
    isPrimary: id.is_primary ?? false,
    notes: id.notes ?? "",
  }));

  const documents: EmployeeDocumentRow[] = row.employee_documents.map((doc) => ({
    did: doc.id,
    documentName: doc.document_name ?? "",
    documentType: doc.document_type ?? "",
    issueDate: toIsoDate(doc.issue_date),
    expiryDate: doc.expiry_date ? toIsoDate(doc.expiry_date) : null,
    uploadedAt: toIsoDate(doc.uploaded_at),
    status: doc.status ?? "",
  }));

  const positionHistory: EmployeePositionHistoryRow[] = row.employee_position_history.map((item) => ({
    pid: item.id,
    relatedContractId:
      row.contracts.find((contract) => contract.contract_number?.trim() === item.related_contract_number?.trim())
        ?.id ?? null,
    relatedMinuteNumber:
      row.contracts.find((contract) => contract.contract_number?.trim() === item.related_contract_number?.trim())
        ?.minute_number?.trim() || null,
    relatedContractStatus:
      row.contracts.find((contract) => contract.contract_number?.trim() === item.related_contract_number?.trim())
        ?.status ?? null,
    position: item.position ?? "",
    department: item.department ?? "",
    workLocation: item.work_location ?? "",
    startDate: toIsoDate(item.start_date),
    endDate: item.end_date ? toIsoDate(item.end_date) : null,
    durationDisplay: "—",
    reasonNotes: item.reason_notes ?? "",
    relatedContractNumber: item.related_contract_number ?? null,
  }));

  const contractBackfilledHistory: EmployeePositionHistoryRow[] = row.contracts
    .filter((contract) => {
      const contractNumber = contract.contract_number?.trim() || null;
      if (!contractNumber) return true;
      return !positionHistory.some((entry) => entry.relatedContractNumber === contractNumber);
    })
    .map((contract) => {
      const contractNumber = contract.contract_number?.trim() || null;
      const matchingPosition = contractNumber
        ? positionHistory.find((entry) => entry.relatedContractNumber === contractNumber)
        : undefined;

      return {
        pid: `contract-${contract.id}`,
        relatedContractId: contract.id,
        relatedMinuteNumber: contract.minute_number?.trim() || null,
        relatedContractStatus: contract.status ?? null,
        position: matchingPosition?.position || row.position || "",
        department: matchingPosition?.department || row.department || "",
        workLocation: matchingPosition?.workLocation || row.work_location || "",
        startDate: toIsoDate(contract.start_date),
        endDate: contract.end_date ? toIsoDate(contract.end_date) : null,
        durationDisplay: "—",
        reasonNotes: "",
        relatedContractNumber: contractNumber,
      };
    });

  return {
    id: row.id,
    fileNumber: row.file_number ?? "",
    firstName: row.first_name ?? "",
    middleName: row.middle_name ?? "",
    lastName: row.last_name ?? "",
    preferredName: row.preferred_name ?? "",
    gender: row.gender ?? "",
    dateOfBirth: toIsoDate(row.date_of_birth),
    nationality: row.nationality ?? "",
    maritalStatus: row.marital_status ?? "",
    personalEmail: row.personal_email ?? "",
    workEmail: row.work_email ?? "",
    mobileNumber: row.mobile_number ?? "",
    homeNumber: row.home_number ?? "",
    residentialAddresses: row.employee_addresses.map(mapAddress),
    emergencyContacts,
    department: row.department ?? "",
    position: row.position ?? "",
    employeeCategory: row.employee_category ?? "",
    employmentStatus: row.employment_status ?? "",
    workLocation: row.work_location ?? "",
    dateFirstEngaged: toIsoDate(row.date_first_engaged),
    photoUrl: row.photo_url ?? "",
    identifications,
    documents,
    rightToWork: row.employee_right_to_work
      ? {
          workPermitRequired: row.employee_right_to_work.work_permit_required ?? false,
          workPermitNumber: row.employee_right_to_work.work_permit_number ?? "",
          workPermitExpiryDate: toIsoDate(row.employee_right_to_work.work_permit_expiry_date),
          immigrationStatus: row.employee_right_to_work.immigration_status ?? "",
          countryOfCitizenship: row.employee_right_to_work.country_of_citizenship ?? "",
          rightToWorkConfirmed: row.employee_right_to_work.right_to_work_confirmed ?? false,
        }
      : undefined,
    notes: "",
    positionHistory: [...positionHistory, ...contractBackfilledHistory],
  };
}

export async function getEmployeesForUi(): Promise<EmployeeRecord[]> {
  try {
    await assertEmployeesTableReady();
    const rows = await prisma.employees.findMany({
      include: {
        employee_addresses: true,
        employee_emergency_contacts: true,
        employee_identifications: true,
        employee_documents: true,
        employee_position_history: true,
        employee_right_to_work: true,
        contracts: true,
      },
      orderBy: [{ created_at: "desc" }, { updated_at: "desc" }, { last_name: "asc" }, { first_name: "asc" }],
    });
    return rows.map((row) => mapEmployee(row));
  } catch (error) {
    if (error instanceof DatabaseSetupError || isMissingEmployeesTableError(error)) {
      throw error instanceof DatabaseSetupError
        ? error
        : new DatabaseSetupError(
            "The HR database schema is not ready. Run database migrations and restore a backup before using the application.",
          );
    }
    return [];
  }
}

export async function getEmployeeForUiById(id: string): Promise<EmployeeRecord | null> {
  try {
    const row = await prisma.employees.findUnique({
      where: { id },
      include: {
        employee_addresses: true,
        employee_emergency_contacts: true,
        employee_identifications: true,
        employee_documents: true,
        employee_position_history: true,
        employee_right_to_work: true,
        contracts: true,
      },
    });
    if (!row) return null;
    return mapEmployee(row);
  } catch {
    return null;
  }
}

export async function getContractRowsForUi(): Promise<ContractListRow[]> {
  let rows: ContractWithEmployee[];
  try {
    rows = await prisma.contracts.findMany({
      include: {
        employees: true,
      },
      orderBy: [{ created_at: "desc" }, { updated_at: "desc" }, { end_date: "desc" }],
    });
  } catch {
    return [];
  }

  return rows.map((row) => {
    const employeeName = row.employees ? `${row.employees.first_name} ${row.employees.last_name}`.trim() : "—";
    const endIso = toIsoDate(row.end_date);
    const now = new Date();
    const daysToExpiry = endIso ? Math.ceil((new Date(`${endIso}T12:00:00`).getTime() - now.getTime()) / 86400000) : null;
    return {
      id: row.id,
      minuteNumber: row.minute_number?.trim() || "—",
      contractNumber: row.contract_number?.trim() ? row.contract_number : "No assigned number",
      employeeName,
      fileNumber: row.employees?.file_number ?? "—",
      position: row.employees?.position ?? "—",
      department: row.employees?.department ?? "—",
      startDate: toIsoDate(row.start_date),
      endDate: endIso,
      salary: formatCurrencyTTD(Number(row.salary)),
      gratuity: formatCurrencyTTD(Number(row.gratuity)),
      status: (row.status ?? "draft").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase()) as ContractListRow["status"],
      daysToExpiry,
    };
  });
}

export async function getContractForUiById(id: string): Promise<ContractRecord | null> {
  let row: ContractWithAllowances | null;
  try {
    row = await prisma.contracts.findUnique({
      where: { id },
      include: {
        contract_allowances: true,
        executive_council_note: true,
        secretary_note: true,
        authority_note_monitor_record: true,
      },
    });
  } catch {
    return null;
  }
  if (!row) return null;
  return mapContractRecord(row);
}

export async function getContractsForUi(): Promise<ContractRecord[]> {
  let rows: ContractWithAllowances[];
  try {
    rows = await prisma.contracts.findMany({
      include: {
        contract_allowances: true,
        executive_council_note: true,
        secretary_note: true,
        authority_note_monitor_record: true,
      },
      orderBy: [{ created_at: "desc" }, { updated_at: "desc" }, { start_date: "desc" }],
    });
  } catch {
    return [];
  }
  return rows.map((row) => mapContractRecord(row));
}

export async function getDashboardCounts() {
  const now = new Date();
  const in30 = new Date(now);
  in30.setDate(in30.getDate() + 30);

  let totalEmployees = 0;
  let activeContracts = 0;
  let expiredContracts = 0;
  let expiringSoon = 0;
  let recentAudit: Awaited<ReturnType<typeof prisma.loginAuditLog.findMany>> = [];
  try {
    [totalEmployees, activeContracts, expiredContracts, expiringSoon, recentAudit] = await Promise.all([
      prisma.employees.count(),
      prisma.contracts.count({ where: { status: { in: ["active", "Active"] } } }),
      prisma.contracts.count({ where: { end_date: { lt: now } } }),
      prisma.contracts.count({ where: { end_date: { gte: now, lte: in30 } } }),
      prisma.loginAuditLog.findMany({ take: 5, orderBy: { created_at: "desc" } }),
    ]);
  } catch {
    // Fall back to zero/empty until DB is reachable.
  }

  return {
    totalEmployees,
    activeContracts,
    expiredContracts,
    expiringSoon,
    recentAudit: recentAudit.map((row) => ({
      id: row.id,
      label: row.success ? "Successful login" : "Failed login attempt",
      meta: row.email_attempted || "—",
      time: row.created_at.toLocaleString(),
    })),
  };
}

export async function getContractEmployeeNameById(employeeId: string): Promise<string> {
  try {
    const employee = await prisma.employees.findUnique({ where: { id: employeeId } });
    if (!employee) return "—";
    return getFullName({
      firstName: employee.first_name,
      middleName: employee.middle_name ?? "",
      lastName: employee.last_name,
    });
  } catch {
    return "—";
  }
}

type EmployeeContractLookup = {
  id: string;
  contractNumber: string | null;
  status: string | null;
  startDate: string;
  endDate: string;
};

function isCurrentActiveContract(contract: EmployeeContractLookup, now: Date): boolean {
  const status = (contract.status ?? "").trim().toLowerCase();
  if (status !== "active") return false;

  const start = new Date(`${contract.startDate}T00:00:00`);
  const end = new Date(`${contract.endDate}T23:59:59`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

  return now >= start && now <= end;
}

export async function getEmployeeCurrentOrLatestContract(employeeId: string): Promise<EmployeeContractLookup | null> {
  try {
    const rows = await prisma.contracts.findMany({
      where: { employee_id: employeeId },
      select: {
        id: true,
        contract_number: true,
        status: true,
        start_date: true,
        end_date: true,
      },
      orderBy: [{ end_date: "desc" }],
    });

    if (rows.length === 0) return null;

    const contracts: EmployeeContractLookup[] = rows.map((row) => ({
      id: row.id,
      contractNumber: row.contract_number,
      status: row.status,
      startDate: toIsoDate(row.start_date),
      endDate: toIsoDate(row.end_date),
    }));

    const now = new Date();
    const currentActive = contracts.find((contract) => isCurrentActiveContract(contract, now));
    return currentActive ?? contracts[0];
  } catch {
    return null;
  }
}

export type EmployeeContractHistoryEmployee = {
  id: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  department: string;
  position: string;
};

export type EmployeeContractHistoryContract = {
  id: string;
  createdAt: string;
  minuteNumber: string | null;
  contractNumber: string | null;
  startDate: string;
  endDate: string;
  dateSigned: string;
  position: string;
  status: string;
};

export type ExpiredContractNoNewRow = {
  contractId: string;
  contractNumber: string;
  fileNumber: string;
  firstName: string;
  lastName: string;
  position: string;
  startDate: string;
  endDate: string;
  salary: string;
  gratuity: string;
  daysExpired: number;
  statusLabel: "Expired - No New Contract";
};

export async function getEmployeeContractHistoryForUi(employeeId: string): Promise<{
  employee: EmployeeContractHistoryEmployee | null;
  contracts: EmployeeContractHistoryContract[];
}> {
  try {
    const [employee, contracts] = await Promise.all([
      prisma.employees.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          file_number: true,
          first_name: true,
          last_name: true,
          department: true,
          position: true,
          employee_position_history: {
            select: {
              related_contract_number: true,
              position: true,
            },
          },
        },
      }),
      prisma.contracts.findMany({
        where: { employee_id: employeeId },
        select: {
          id: true,
          created_at: true,
          minute_number: true,
          contract_number: true,
          start_date: true,
          end_date: true,
          date_signed: true,
          salary: true,
          gratuity: true,
          status: true,
        },
      }),
    ]);

    const mappedContracts: EmployeeContractHistoryContract[] = contracts
      .map((contract) => ({
        id: contract.id,
        minuteNumber: contract.minute_number?.trim() || null,
        contractNumber: contract.contract_number ?? null,
        startDate: toIsoDate(contract.start_date),
        endDate: toIsoDate(contract.end_date),
        dateSigned: toIsoDate(contract.date_signed),
        position:
          employee?.employee_position_history.find(
            (row) => row.related_contract_number?.trim() === contract.contract_number?.trim(),
          )?.position ??
          employee?.position ??
          "",
        status: contract.status ?? "draft",
        createdAt: toIsoDate(contract.created_at),
      }))
      .sort((a, b) => {
        const nowIso = new Date().toISOString().slice(0, 10);
        const aCurrent = Boolean(a.startDate && a.endDate && a.startDate <= nowIso && a.endDate >= nowIso);
        const bCurrent = Boolean(b.startDate && b.endDate && b.startDate <= nowIso && b.endDate >= nowIso);
        if (aCurrent !== bCurrent) return aCurrent ? -1 : 1;
        if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
        const aNoEnd = !a.endDate;
        const bNoEnd = !b.endDate;
        if (aNoEnd && !bNoEnd) return -1;
        if (!aNoEnd && bNoEnd) return 1;
        if (a.endDate !== b.endDate) return b.endDate.localeCompare(a.endDate);
        return b.startDate.localeCompare(a.startDate);
      });

    return {
      employee: employee
        ? {
            id: employee.id,
            fileNumber: employee.file_number ?? "",
            firstName: employee.first_name ?? "",
            lastName: employee.last_name ?? "",
            department: employee.department ?? "",
            position: employee.position ?? "",
          }
        : null,
      contracts: mappedContracts,
    };
  } catch {
    return { employee: null, contracts: [] };
  }
}

export async function getExpiredContractsNoNewForUi(): Promise<ExpiredContractNoNewRow[]> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        contract_id: string;
        contract_number: string | null;
        file_number: string;
        first_name: string;
        last_name: string;
        position: string | null;
        start_date: Date;
        end_date: Date;
        salary: number;
        gratuity: number;
        days_expired: number;
      }>
    >(Prisma.sql`
      WITH latest_expired AS (
        SELECT DISTINCT ON (c.employee_id)
          c.id::text AS contract_id,
          c.employee_id::text AS employee_id,
          c.contract_number,
          c.start_date,
          c.end_date,
          c.salary::numeric::float8 AS salary,
          c.gratuity::numeric::float8 AS gratuity
        FROM public.contracts c
        WHERE c.end_date < CURRENT_DATE
        ORDER BY c.employee_id, c.end_date DESC, c.start_date DESC, c.created_at DESC
      )
      SELECT
        le.contract_id,
        le.contract_number,
        e.file_number,
        e.first_name,
        e.last_name,
        e.position,
        le.start_date,
        le.end_date,
        le.salary,
        le.gratuity,
        (CURRENT_DATE - le.end_date)::int AS days_expired
      FROM latest_expired le
      JOIN public.employees e
        ON e.id::text = le.employee_id
      WHERE NOT EXISTS (
        SELECT 1
        FROM public.contracts newer
        WHERE newer.employee_id::text = le.employee_id
          AND (
            (CURRENT_DATE BETWEEN newer.start_date AND newer.end_date)
            OR newer.start_date > CURRENT_DATE
            OR newer.end_date >= CURRENT_DATE
          )
      )
      ORDER BY le.end_date ASC, e.last_name ASC, e.first_name ASC
    `);

    return rows.map((row) => ({
      contractId: row.contract_id,
      contractNumber: row.contract_number?.trim() || "No assigned number",
      fileNumber: row.file_number || "—",
      firstName: row.first_name,
      lastName: row.last_name,
      position: row.position?.trim() || "—",
      startDate: toIsoDate(row.start_date),
      endDate: toIsoDate(row.end_date),
      salary: formatCurrencyTTD(Number(row.salary)),
      gratuity: formatCurrencyTTD(Number(row.gratuity)),
      daysExpired: Math.max(0, Number(row.days_expired ?? 0)),
      statusLabel: "Expired - No New Contract",
    }));
  } catch {
    return [];
  }
}
