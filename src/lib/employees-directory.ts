import {
  calculateAge,
  formatEmployeeDateDisplay,
  formatResidentialAddressSingleLine,
  getFullName,
  type EmployeeRecord,
} from "@/lib/mock/employees";

export type EmployeeDirectoryRow = {
  id: string;
  fileNumber: string;
  fullName: string;
  phoneContact: string;
  age: number | null;
  dateOfBirth: string;
  residentialAddress: string;
  emailAddress: string;
  department: string;
  position: string;
  employmentStatus: string;
  workLocation: string;
  dateFirstEngaged: string;
  /** Placeholder for future contracts integration. */
  contractEndDate: string | null;
  /** Internal search text for /employees query matching. */
  searchText: string;
};

export type DirectoryFilters = {
  query: string;
  department: string;
  position: string;
  employmentStatus: string;
  workLocation: string;
  minAge: string;
  maxAge: string;
  engagedFrom: string;
  engagedTo: string;
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function phoneContactLine(e: EmployeeRecord): string {
  const m = e.mobileNumber?.trim();
  const h = e.homeNumber?.trim();
  if (m && h) return `${m} / ${h}`;
  return m || h || "—";
}

function resolveCurrentPosition(employee: EmployeeRecord): string {
  if (employee.position?.trim()) return employee.position.trim();
  const history = employee.positionHistory ?? [];
  if (history.length === 0) return "—";
  const latest = [...history].sort((a, b) => {
    const aDate = a.endDate || a.startDate;
    const bDate = b.endDate || b.startDate;
    return bDate.localeCompare(aDate);
  })[0];
  return latest?.position?.trim() || "—";
}

export function toDirectoryRow(employee: EmployeeRecord): EmployeeDirectoryRow {
  const dob = employee.dateOfBirth?.trim() || "";
  const age = dob ? calculateAge(dob) : null;
  const addressSearch = employee.residentialAddresses
    .map((address) =>
      [
        address.addressLine1,
        address.addressLine2,
        address.communityCity,
        address.regionMunicipality,
        address.country,
        address.postalCode,
      ]
        .filter(Boolean)
        .join(" "),
    )
    .join(" ");
  const idsSearch = employee.identifications
    .map((identification) => `${identification.idType} ${identification.idNumber ?? ""}`.trim())
    .join(" ");
  const searchText = [
    employee.fileNumber,
    getFullName(employee),
    employee.firstName,
    employee.lastName,
    phoneContactLine(employee),
    addressSearch,
    employee.personalEmail,
    employee.workEmail,
    resolveCurrentPosition(employee),
    employee.department,
    idsSearch,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return {
    id: employee.id,
    fileNumber: employee.fileNumber || "—",
    fullName: getFullName(employee),
    phoneContact: phoneContactLine(employee),
    age,
    dateOfBirth: dob,
    residentialAddress: formatResidentialAddressSingleLine(employee),
    emailAddress: employee.workEmail?.trim() || employee.personalEmail?.trim() || "—",
    department: employee.department || "—",
    position: resolveCurrentPosition(employee),
    employmentStatus: employee.employmentStatus || "—",
    workLocation: employee.workLocation || "—",
    dateFirstEngaged: employee.dateFirstEngaged || "",
    // Future: source from contracts table
    contractEndDate: null,
    searchText,
  };
}

function inDateRange(value: string, from: string, to: string): boolean {
  if (!value) return false;
  if (from && value < from) return false;
  if (to && value > to) return false;
  return true;
}

export function filterDirectoryRows(
  rows: EmployeeDirectoryRow[],
  filters: DirectoryFilters,
): EmployeeDirectoryRow[] {
  const query = normalize(filters.query);
  const minAge = filters.minAge ? Number(filters.minAge) : null;
  const maxAge = filters.maxAge ? Number(filters.maxAge) : null;

  return rows.filter((row) => {
    if (query) {
      const hay = [
        row.fileNumber,
        row.fullName,
        row.phoneContact,
        row.residentialAddress,
        row.emailAddress,
        row.position,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(query)) return false;
    }

    if (filters.department && row.department !== filters.department) return false;
    if (filters.position && row.position !== filters.position) return false;
    if (filters.employmentStatus && row.employmentStatus !== filters.employmentStatus) return false;
    if (filters.workLocation && row.workLocation !== filters.workLocation) return false;

    if (minAge !== null && row.age !== null && row.age < minAge) return false;
    if (maxAge !== null && row.age !== null && row.age > maxAge) return false;
    if ((minAge !== null || maxAge !== null) && row.age === null) return false;

    if (filters.engagedFrom || filters.engagedTo) {
      if (!inDateRange(row.dateFirstEngaged, filters.engagedFrom, filters.engagedTo)) return false;
    }

    return true;
  });
}

function escapeCsvCell(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

export function exportRowsToCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number | null>>,
) {
  const lines = [headers.map(escapeCsvCell).join(",")];
  rows.forEach((row) => {
    lines.push(
      row
        .map((value) => escapeCsvCell(value === null || value === undefined ? "" : String(value)))
        .join(","),
    );
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function formatDateOrDash(value: string | null | undefined): string {
  if (!value) return "—";
  return formatEmployeeDateDisplay(value);
}
