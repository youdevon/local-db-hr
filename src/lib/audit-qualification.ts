import "server-only";

/** Matches MetadataChange shape used by system audit detail UI */
export type QualificationAuditMetadataChange = {
  field: string;
  label?: string;
  type: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
  format?: "text" | "date";
};

export type QualificationAuditSnapshot = Record<string, string | null>;

export function isoDateOnly(d: Date | null | undefined): string | null {
  if (!d || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function qualificationRowToSnapshot(row: {
  qualification_type: string;
  qualification_title: string;
  title: string;
  institution: string | null;
  awarding_body: string | null;
  field_of_study: string | null;
  grade_result: string | null;
  qualification_level: string | null;
  date_awarded: Date | null;
  expiry_date: Date | null;
  verification_status: string;
  status: string;
  notes: string | null;
}): QualificationAuditSnapshot {
  return {
    qualification_type: row.qualification_type,
    qualification_title: row.qualification_title,
    title: row.title,
    institution: row.institution ?? null,
    awarding_body: row.awarding_body ?? null,
    field_of_study: row.field_of_study ?? null,
    grade_result: row.grade_result ?? null,
    qualification_level: row.qualification_level ?? null,
    date_awarded: isoDateOnly(row.date_awarded),
    expiry_date: isoDateOnly(row.expiry_date),
    verification_status: row.verification_status,
    status: row.status,
    notes: row.notes ?? null,
  };
}

const QUAL_FIELD_LABELS: Record<string, string> = {
  qualification_type: "Qualification type",
  qualification_title: "Qualification title",
  title: "Title",
  institution: "Institution",
  awarding_body: "Awarding body",
  field_of_study: "Field of study",
  grade_result: "Grade / result",
  qualification_level: "Qualification level",
  date_awarded: "Date awarded",
  expiry_date: "Expiry date",
  verification_status: "Verification status",
  status: "Status",
  notes: "Notes",
};

export function diffQualificationSnapshots(
  before: QualificationAuditSnapshot | null,
  after: QualificationAuditSnapshot,
): QualificationAuditMetadataChange[] {
  if (!before) return [];
  const changes: QualificationAuditMetadataChange[] = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const b = before[key] ?? null;
    const a = after[key] ?? null;
    const bs = b ?? "";
    const as = a ?? "";
    if (bs === as) continue;
    changes.push({
      field: key,
      label: QUAL_FIELD_LABELS[key] ?? key.replace(/_/g, " "),
      type: "changed",
      before: b ?? "—",
      after: a ?? "—",
      format: key === "date_awarded" || key === "expiry_date" ? "date" : "text",
    });
  }
  return changes;
}

export function truncateAuditText(value: string | null | undefined, max = 240): string {
  const s = (value ?? "").trim();
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
