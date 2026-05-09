/** Controlled vocabulary for employee qualifications (stored lowercase/snake in DB). */

export const QUALIFICATION_CATEGORIES = [
  "academic",
  "professional",
  "vocational",
  "training",
  "participation_attendance",
  "compliance",
  "custom_other",
] as const;

export type QualificationCategory = (typeof QUALIFICATION_CATEGORIES)[number];

export const QUALIFICATION_CATEGORY_LABEL: Record<QualificationCategory, string> = {
  academic: "Academic",
  professional: "Professional",
  vocational: "Vocational",
  training: "Training",
  participation_attendance: "Participation / Attendance",
  compliance: "Compliance",
  custom_other: "Custom / Other",
};

export const QUALIFICATION_TYPES = [
  // Academic
  "cxc_csec",
  "cxc",
  "csec",
  "gce",
  "cape",
  "certificate",
  "diploma",
  "associate_degree",
  "cxc_associate_degree",
  "bachelors_degree",
  "masters_degree",
  "doctorate_phd",
  // Professional / vocational
  "professional_certification",
  "vocational_certification",
  "trade_certificate",
  "licence",
  "nvq",
  "cvq",
  // Training
  "short_course",
  "workshop",
  "seminar",
  "internal_training",
  "external_training",
  // Participation
  "attendance_certificate",
  "participation_certificate",
  "conference_attendance",
  "event_participation",
  // Compliance
  "first_aid",
  "hse",
  "fire_safety",
  "defensive_driving",
  "food_handling",
  "other_compliance_certificate",
  // Custom
  "custom_qualification",
  "other",
] as const;

export type QualificationTypeSlug = (typeof QUALIFICATION_TYPES)[number];

export const QUALIFICATION_TYPE_LABEL: Record<string, string> = {
  cxc_csec: "CXC / CSEC",
  cxc: "CXC",
  csec: "CSEC",
  gce: "GCE",
  cape: "CAPE",
  certificate: "Certificate",
  diploma: "Diploma",
  associate_degree: "Associate Degree",
  cxc_associate_degree: "CXC Associate Degree",
  bachelors_degree: "Bachelor’s Degree",
  masters_degree: "Master’s Degree",
  doctorate_phd: "Doctorate / PhD",
  professional_certification: "Professional Certification",
  vocational_certification: "Vocational Certification",
  trade_certificate: "Trade Certificate",
  licence: "Licence",
  nvq: "NVQ",
  cvq: "CVQ",
  short_course: "Short Course",
  workshop: "Workshop",
  seminar: "Seminar",
  internal_training: "Internal Training",
  external_training: "External Training",
  attendance_certificate: "Attendance Certificate",
  participation_certificate: "Participation Certificate",
  conference_attendance: "Conference Attendance",
  event_participation: "Event Participation",
  first_aid: "First Aid",
  hse: "HSE",
  fire_safety: "Fire Safety",
  defensive_driving: "Defensive Driving",
  food_handling: "Food Handling",
  other_compliance_certificate: "Other Compliance Certificate",
  custom_qualification: "Custom Qualification",
  other: "Other",
};

/** Exam sitting systems for grouped records */
export const QUALIFICATION_SYSTEMS = ["CXC_CSEC", "GCE", "CAPE"] as const;
export type QualificationSystemCode = (typeof QUALIFICATION_SYSTEMS)[number];

export const QUALIFICATION_SYSTEM_LABEL: Record<QualificationSystemCode, string> = {
  CXC_CSEC: "CXC / CSEC",
  GCE: "GCE",
  CAPE: "CAPE",
};

export const GCE_LEVELS = ["O_LEVEL", "A_LEVEL", "AS_LEVEL"] as const;
export const GCE_LEVEL_LABEL: Record<(typeof GCE_LEVELS)[number], string> = {
  O_LEVEL: "O Level",
  A_LEVEL: "A Level",
  AS_LEVEL: "AS Level",
};

export const RECORD_STATUS_VALUES = [
  "active",
  "no_expiry",
  "expired",
  "expiring_soon",
  "pending_verification",
  "verified",
  "archived",
] as const;

export const RECORD_STATUS_LABEL: Record<(typeof RECORD_STATUS_VALUES)[number], string> = {
  active: "Active",
  no_expiry: "No Expiry",
  expired: "Expired",
  expiring_soon: "Expiring Soon",
  pending_verification: "Pending Verification",
  verified: "Verified",
  archived: "Archived",
};

export const VERIFICATION_STATUS_VALUES = [
  "pending_verification",
  "verified",
  "rejected",
  "not_required",
] as const;

export const VERIFICATION_STATUS_LABEL: Record<(typeof VERIFICATION_STATUS_VALUES)[number], string> = {
  pending_verification: "Pending Verification",
  verified: "Verified",
  rejected: "Rejected",
  not_required: "Not Required",
};

/** Higher number = higher academic/professional standing for “highest qualification” summary */
export const QUALIFICATION_TYPE_RANK: Record<string, number> = {
  doctorate_phd: 100,
  masters_degree: 90,
  bachelors_degree: 80,
  associate_degree: 70,
  cxc_associate_degree: 72,
  diploma: 60,
  certificate: 50,
  cape: 45,
  gce: 40,
  cxc_csec: 35,
  cxc: 35,
  csec: 35,
  professional_certification: 42,
  vocational_certification: 41,
  trade_certificate: 40,
  licence: 38,
  nvq: 37,
  cvq: 36,
  short_course: 25,
  workshop: 24,
  seminar: 23,
  internal_training: 22,
  external_training: 21,
  attendance_certificate: 15,
  participation_certificate: 15,
  conference_attendance: 14,
  event_participation: 14,
  first_aid: 20,
  hse: 20,
  fire_safety: 20,
  defensive_driving: 20,
  food_handling: 20,
  other_compliance_certificate: 20,
  custom_qualification: 10,
  other: 5,
};

export function labelForQualificationType(slug: string | null | undefined): string {
  if (slug == null || slug === "") return "—";
  return QUALIFICATION_TYPE_LABEL[slug] ?? slug.replace(/_/g, " ");
}

export function categoryLabel(cat: string): string {
  return QUALIFICATION_CATEGORY_LABEL[cat as QualificationCategory] ?? cat;
}
