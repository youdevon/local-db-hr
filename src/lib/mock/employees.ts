import type { EmployeeIdType } from "@/lib/employee-constants";
import type { EmployeeFormValues } from "@/lib/validators/employee-form";

export type EmployeeIdentification = {
  sid: string;
  idType: EmployeeIdType;
  idNumber: string;
  issuingCountry: string;
  issueDate: string;
  expiryDate: string;
  isPrimary: boolean;
  notes: string;
};

export type EmployeeAddressRow = {
  aid: string;
  addressType: "Residential" | "Mailing";
  addressLine1: string;
  addressLine2: string;
  communityCity: string;
  regionMunicipality: string;
  country: string;
  postalCode: string;
  sameAsResidential?: boolean;
  isPrimary: boolean;
};

export type EmployeeEmergencyContactRow = {
  cid: string;
  contactType: "primary_emergency" | "secondary_emergency" | "next_of_kin";
  contactName: string;
  relationship: string;
  mobileNumber: string;
  alternativeNumber: string;
  email: string;
  address: string;
  isPrimary: boolean;
};

export type EmployeeDocumentRow = {
  did: string;
  documentName: string;
  documentType: string;
  issueDate: string;
  expiryDate: string | null;
  uploadedAt: string;
  status: string;
};

export type EmployeePositionHistoryRow = {
  pid: string;
  relatedContractId?: string | null;
  relatedMinuteNumber?: string | null;
  relatedContractStatus?: string | null;
  position: string;
  department: string;
  workLocation: string;
  startDate: string;
  endDate: string | null;
  durationDisplay: string;
  reasonNotes: string;
  relatedContractNumber: string | null;
};

export type EmployeeRecord = {
  id: string;
  fileNumber: string;
  firstName: string;
  middleName: string;
  lastName: string;
  preferredName: string;
  gender: string;
  dateOfBirth: string;
  nationality: string;
  maritalStatus: string;
  personalEmail: string;
  workEmail: string;
  mobileNumber: string;
  homeNumber: string;
  residentialAddresses: EmployeeAddressRow[];
  emergencyContacts: EmployeeEmergencyContactRow[];
  department: string;
  position: string;
  employeeCategory: string;
  employmentStatus: string;
  workLocation: string;
  dateFirstEngaged: string;
  photoUrl: string;
  identifications: EmployeeIdentification[];
  documents?: EmployeeDocumentRow[];
  rightToWork?: {
    workPermitRequired: boolean;
    workPermitNumber: string;
    workPermitExpiryDate: string;
    immigrationStatus: string;
    countryOfCitizenship: string;
    rightToWorkConfirmed: boolean;
  };
  notes?: string;
  positionHistory?: EmployeePositionHistoryRow[];
};

export const mockEmployees: EmployeeRecord[] = [];

export function getFullName(e: Pick<EmployeeRecord, "firstName" | "middleName" | "lastName">): string {
  const parts = [e.firstName, e.middleName?.trim(), e.lastName].filter(Boolean) as string[];
  return parts.join(" ");
}

export function calculateAge(dateOfBirth: string): number {
  if (!dateOfBirth) return 0;
  const d = new Date(`${dateOfBirth}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.max(0, Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000)));
}

export function getPrimaryResidentialAddress(e: EmployeeRecord): EmployeeAddressRow | undefined {
  const addresses = e.residentialAddresses.filter((a) => a.addressType === "Residential");
  return addresses.find((a) => a.isPrimary) ?? addresses[0];
}

export function getMailingAddress(e: EmployeeRecord): EmployeeAddressRow | undefined {
  return e.residentialAddresses.find((a) => a.addressType === "Mailing");
}

export function formatResidentialAddressSingleLine(e: EmployeeRecord): string {
  const address = getPrimaryResidentialAddress(e);
  if (!address) return "—";
  return [address.addressLine1?.trim(), address.communityCity?.trim()].filter(Boolean).join(", ") || "—";
}

export function formatResidentialAddressMultiLine(e: EmployeeRecord): string[] {
  const address = getPrimaryResidentialAddress(e);
  if (!address) return [];
  const line1 = [address.addressLine1?.trim(), address.addressLine2?.trim()].filter(Boolean).join(", ");
  const line2 = [address.communityCity?.trim(), address.regionMunicipality?.trim()].filter(Boolean).join(", ");
  const line3 = [address.country?.trim(), address.postalCode?.trim()].filter(Boolean).join(" ");
  return [line1, line2, line3].filter(Boolean);
}

export function getPrimaryEmergencyContact(e: EmployeeRecord): EmployeeEmergencyContactRow | undefined {
  return (
    e.emergencyContacts.find((c) => c.contactType === "primary_emergency") ??
    e.emergencyContacts.find((c) => c.isPrimary) ??
    e.emergencyContacts[0]
  );
}

export function getSecondaryEmergencyContact(e: EmployeeRecord): EmployeeEmergencyContactRow | undefined {
  return e.emergencyContacts.find((c) => c.contactType === "secondary_emergency");
}

export function getNextOfKinContact(e: EmployeeRecord): EmployeeEmergencyContactRow | undefined {
  return e.emergencyContacts.find((c) => c.contactType === "next_of_kin");
}

export function formatEmployeeDateDisplay(iso: string): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function employeeMatchesQuery(e: EmployeeRecord, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const ids = e.identifications.map((i) => `${i.idType} ${i.idNumber}`).join(" ");
  const phones = [e.mobileNumber, e.homeNumber].filter(Boolean).join(" ");
  const address = e.residentialAddresses
    .map((a) => [a.addressLine1, a.addressLine2, a.communityCity, a.regionMunicipality, a.country, a.postalCode].filter(Boolean).join(" "))
    .join(" ");
  const hay = [
    e.fileNumber,
    getFullName(e),
    e.firstName,
    e.lastName,
    address,
    phones,
    e.workEmail,
    e.personalEmail,
    e.position,
    ids,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(needle);
}

export function getEmployeeById(id: string): EmployeeRecord | undefined {
  return mockEmployees.find((e) => e.id === id);
}

export const defaultEmptyEmployeeForm: EmployeeFormValues = {
  fileNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  gender: "",
  dateOfBirth: "",
  nationality: "Trinidad and Tobago",
  maritalStatus: "",
  personalEmail: "",
  workEmail: "",
  mobileNumber: "",
  homeNumber: "",
  addressLine1: "",
  addressLine2: "",
  communityCity: "",
  regionMunicipality: "",
  country: "Trinidad and Tobago",
  postalCode: "",
  mailingSameAsResidential: true,
  mailingAddressLine1: "",
  mailingAddressLine2: "",
  mailingCommunityCity: "",
  mailingRegionMunicipality: "",
  mailingCountry: "Trinidad and Tobago",
  mailingPostalCode: "",
  emergencyContactName: "",
  emergencyContactRelationship: "",
  emergencyContactMobileNumber: "",
  emergencyContactAlternativeNumber: "",
  emergencyContactEmail: "",
  emergencyContactAddress: "",
  secondaryEmergencyContactName: "",
  secondaryEmergencyContactRelationship: "",
  secondaryEmergencyContactMobileNumber: "",
  secondaryEmergencyContactAlternativeNumber: "",
  secondaryEmergencyContactEmail: "",
  secondaryEmergencyContactAddress: "",
  nextOfKinFullName: "",
  nextOfKinRelationship: "",
  nextOfKinMobileNumber: "",
  nextOfKinAlternativeNumber: "",
  nextOfKinEmail: "",
  nextOfKinAddress: "",
  workPermitRequired: false,
  workPermitNumber: "",
  workPermitExpiryDate: "",
  immigrationStatus: "",
  countryOfCitizenship: "Trinidad and Tobago",
  rightToWorkConfirmed: false,
  department: "",
  position: "",
  employeeCategory: "",
  employmentStatus: "Active",
  workLocation: "",
  dateFirstEngaged: "",
  identifications: [],
  photoUrl: "",
};

export function employeeRecordToFormValues(e: EmployeeRecord): EmployeeFormValues {
  const residential = getPrimaryResidentialAddress(e);
  const mailing = getMailingAddress(e);
  const primary = getPrimaryEmergencyContact(e);
  const secondary = getSecondaryEmergencyContact(e);
  const kin = getNextOfKinContact(e);
  return {
    fileNumber: e.fileNumber ?? "",
    firstName: e.firstName ?? "",
    middleName: e.middleName ?? "",
    lastName: e.lastName ?? "",
    preferredName: e.preferredName ?? "",
    gender: e.gender ?? "",
    dateOfBirth: e.dateOfBirth ?? "",
    nationality: e.nationality ?? "",
    maritalStatus: e.maritalStatus ?? "",
    personalEmail: e.personalEmail ?? "",
    workEmail: e.workEmail ?? "",
    mobileNumber: e.mobileNumber ?? "",
    homeNumber: e.homeNumber ?? "",
    addressLine1: residential?.addressLine1 ?? "",
    addressLine2: residential?.addressLine2 ?? "",
    communityCity: residential?.communityCity ?? "",
    regionMunicipality: residential?.regionMunicipality ?? "",
    country: residential?.country || "Trinidad and Tobago",
    postalCode: residential?.postalCode ?? "",
    mailingSameAsResidential: !mailing || mailing.sameAsResidential === true,
    mailingAddressLine1: mailing?.addressLine1 ?? "",
    mailingAddressLine2: mailing?.addressLine2 ?? "",
    mailingCommunityCity: mailing?.communityCity ?? "",
    mailingRegionMunicipality: mailing?.regionMunicipality ?? "",
    mailingCountry: mailing?.country || "Trinidad and Tobago",
    mailingPostalCode: mailing?.postalCode ?? "",
    emergencyContactName: primary?.contactName ?? "",
    emergencyContactRelationship: primary?.relationship ?? "",
    emergencyContactMobileNumber: primary?.mobileNumber ?? "",
    emergencyContactAlternativeNumber: primary?.alternativeNumber ?? "",
    emergencyContactEmail: primary?.email ?? "",
    emergencyContactAddress: primary?.address ?? "",
    secondaryEmergencyContactName: secondary?.contactName ?? "",
    secondaryEmergencyContactRelationship: secondary?.relationship ?? "",
    secondaryEmergencyContactMobileNumber: secondary?.mobileNumber ?? "",
    secondaryEmergencyContactAlternativeNumber: secondary?.alternativeNumber ?? "",
    secondaryEmergencyContactEmail: secondary?.email ?? "",
    secondaryEmergencyContactAddress: secondary?.address ?? "",
    nextOfKinFullName: kin?.contactName ?? "",
    nextOfKinRelationship: kin?.relationship ?? "",
    nextOfKinMobileNumber: kin?.mobileNumber ?? "",
    nextOfKinAlternativeNumber: kin?.alternativeNumber ?? "",
    nextOfKinEmail: kin?.email ?? "",
    nextOfKinAddress: kin?.address ?? "",
    workPermitRequired: e.rightToWork?.workPermitRequired ?? false,
    workPermitNumber: e.rightToWork?.workPermitNumber ?? "",
    workPermitExpiryDate: e.rightToWork?.workPermitExpiryDate ?? "",
    immigrationStatus: e.rightToWork?.immigrationStatus ?? "",
    countryOfCitizenship: e.rightToWork?.countryOfCitizenship ?? "Trinidad and Tobago",
    rightToWorkConfirmed: e.rightToWork?.rightToWorkConfirmed ?? false,
    department: e.department ?? "",
    position: e.position ?? "",
    employeeCategory: e.employeeCategory ?? "",
    employmentStatus: e.employmentStatus ?? "Active",
    workLocation: e.workLocation ?? "",
    dateFirstEngaged: e.dateFirstEngaged ?? "",
    identifications: e.identifications ?? [],
    photoUrl: e.photoUrl ?? "",
  };
}
