import "server-only";

import { prisma } from "@/lib/prisma";
import {
  QUALIFICATION_SYSTEM_LABEL,
  QUALIFICATION_TYPE_RANK,
  labelForQualificationType,
} from "@/lib/qualifications-constants";

export type QualificationSubjectRow = {
  id: string;
  subjectName: string;
  levelOrUnit: string | null;
  gradeResult: string | null;
  remarks: string | null;
};

export type QualificationGroupRow = {
  id: string;
  qualificationSystem: string;
  qualificationSystemLabel: string;
  sittingYear: number;
  institution: string | null;
  awardingBody: string | null;
  level: string | null;
  notes: string | null;
  documentId: string | null;
  subjects: QualificationSubjectRow[];
};

export type StandaloneQualificationRow = {
  id: string;
  category: string;
  qualificationType: string;
  qualificationTypeLabel: string;
  title: string;
  institution: string | null;
  awardingBody: string | null;
  fieldOfStudy: string | null;
  gradeResult: string | null;
  dateAwarded: string | null;
  expiryDate: string | null;
  hasExpiry: boolean;
  verificationStatus: string;
  status: string;
  notes: string | null;
  documentId: string | null;
  /** Legacy level column mapped for display */
  qualificationLevel: string | null;
};

export type DocumentRef = {
  id: string;
  documentName: string;
  fileUrl: string | null;
};

export type QualificationsSummary = {
  highestQualificationLabel: string;
  academicRecordsCount: number;
  certificationsCount: number;
  expiringSoonCount: number;
};

export type EmployeeQualificationsBundle = {
  employeeId: string;
  standalone: StandaloneQualificationRow[];
  groups: QualificationGroupRow[];
  summary: QualificationsSummary;
  documents: DocumentRef[];
};

/** Safe UI bundle when the employee has no rows or when DB reads fail (missing migration, drift, etc.). */
export function emptyQualificationsBundle(
  employeeId: string,
): EmployeeQualificationsBundle {
  return {
    employeeId,
    standalone: [],
    groups: [],
    summary: {
      highestQualificationLabel: "—",
      academicRecordsCount: 0,
      certificationsCount: 0,
      expiringSoonCount: 0,
    },
    documents: [],
  };
}

function logQualificationsLoadError(part: string, err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[employee qualifications] ${part}: ${message}`);
}

function isoDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toISOString().slice(0, 10);
}

function daysUntil(date: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  return Math.floor((t.getTime() - today.getTime()) / (86400 * 1000));
}

function highestQualificationLabel(
  standalone: { qualificationType: string }[],
  groupCount: number,
): string {
  let best = 0;
  let bestLabel = "—";
  for (const s of standalone) {
    const r = QUALIFICATION_TYPE_RANK[s.qualificationType] ?? 0;
    if (r > best) {
      best = r;
      bestLabel = labelForQualificationType(s.qualificationType);
    }
  }
  if (groupCount > 0) {
    const gRank = 42;
    if (gRank > best) {
      best = gRank;
      bestLabel = "Academic exam sitting (CXC / GCE / CAPE)";
    }
  }
  if (best === 0 && (standalone.length > 0 || groupCount > 0)) {
    return "Other / see list";
  }
  return bestLabel;
}

function isExpiringSoon(expiry: Date | null, hasExpiry: boolean): boolean {
  if (!hasExpiry || !expiry || Number.isNaN(expiry.getTime())) return false;
  const d = daysUntil(expiry);
  if (Number.isNaN(d)) return false;
  return d >= 0 && d <= 90;
}

async function loadQualificationGroups(employeeId: string) {
  try {
    return await prisma.employee_qualification_groups.findMany({
      where: { employee_id: employeeId },
      include: {
        subjects: { orderBy: { subject_name: "asc" } },
      },
      orderBy: [{ sitting_year: "desc" }, { qualification_system: "asc" }],
    });
  } catch (e) {
    logQualificationsLoadError("findMany employee_qualification_groups", e);
    return [];
  }
}

async function loadStandaloneQualifications(employeeId: string) {
  try {
    return await prisma.employee_qualifications.findMany({
      where: { employee_id: employeeId },
      orderBy: [{ date_awarded: "desc" }, { created_at: "desc" }],
    });
  } catch (e) {
    logQualificationsLoadError("findMany employee_qualifications", e);
    return [];
  }
}

async function loadEmployeeDocumentsForQualifications(employeeId: string) {
  try {
    return await prisma.employee_documents.findMany({
      where: { employee_id: employeeId },
      select: { id: true, document_name: true, file_url: true },
      orderBy: { uploaded_at: "desc" },
    });
  } catch (e) {
    logQualificationsLoadError("findMany employee_documents", e);
    return [];
  }
}

export async function getEmployeeQualificationsBundle(
  employeeId: string,
): Promise<EmployeeQualificationsBundle> {
  try {
    const [rawGroups, rawStandalone, docRows] = await Promise.all([
      loadQualificationGroups(employeeId),
      loadStandaloneQualifications(employeeId),
      loadEmployeeDocumentsForQualifications(employeeId),
    ]);

    const groups: QualificationGroupRow[] = rawGroups.map((g) => {
      const sys = g.qualification_system?.trim() || "unknown";
      return {
        id: g.id,
        qualificationSystem: sys,
        qualificationSystemLabel:
          QUALIFICATION_SYSTEM_LABEL[
            sys as keyof typeof QUALIFICATION_SYSTEM_LABEL
          ] ?? sys,
        sittingYear:
          typeof g.sitting_year === "number" && !Number.isNaN(g.sitting_year)
            ? g.sitting_year
            : 0,
        institution: g.institution ?? null,
        awardingBody: g.awarding_body ?? null,
        level: g.level ?? null,
        notes: g.notes ?? null,
        documentId: g.document_id ?? null,
        subjects: (g.subjects ?? []).map((s) => ({
          id: s.id,
          subjectName: s.subject_name?.trim() || "—",
          levelOrUnit: s.level_or_unit ?? null,
          gradeResult: s.grade_result ?? null,
          remarks: s.remarks ?? null,
        })),
      };
    });

    const standalone: StandaloneQualificationRow[] = rawStandalone.map((q) => {
      const qType = q.qualification_type?.trim() || "other";
      const cat = q.category?.trim() || "custom_other";
      return {
        id: q.id,
        category: cat,
        qualificationType: qType,
        qualificationTypeLabel: labelForQualificationType(qType),
        title: q.title?.trim() || q.qualification_title?.trim() || "—",
        institution: q.institution ?? null,
        awardingBody: q.awarding_body ?? null,
        fieldOfStudy: q.field_of_study ?? null,
        gradeResult: q.grade_result ?? q.qualification_level ?? null,
        dateAwarded: isoDate(q.date_awarded),
        expiryDate: isoDate(q.expiry_date),
        hasExpiry: Boolean(q.has_expiry),
        verificationStatus: q.verification_status?.trim() || "not_required",
        status: q.status?.trim() || "active",
        notes: q.notes ?? null,
        documentId: q.document_id ?? null,
        qualificationLevel: q.qualification_level ?? null,
      };
    });

    const academicStandalone = standalone.filter(
      (s) => s.category === "academic",
    ).length;
    const academicRecordsCount = groups.length + academicStandalone;

    const certificationsCount = standalone.filter((s) =>
      ["professional", "vocational", "compliance"].includes(s.category),
    ).length;

    let expiringSoonCount = 0;
    for (const s of standalone) {
      if (!s.expiryDate || !s.hasExpiry) continue;
      const exp = new Date(`${s.expiryDate}T12:00:00`);
      if (Number.isNaN(exp.getTime())) continue;
      if (isExpiringSoon(exp, true)) expiringSoonCount += 1;
    }

    const summary: QualificationsSummary = {
      highestQualificationLabel: highestQualificationLabel(
        standalone.map((s) => ({ qualificationType: s.qualificationType })),
        groups.length,
      ),
      academicRecordsCount,
      certificationsCount,
      expiringSoonCount,
    };

    return {
      employeeId,
      standalone,
      groups,
      summary,
      documents: docRows.map((d) => ({
        id: d.id,
        documentName: d.document_name?.trim() || "Document",
        fileUrl: d.file_url ?? null,
      })),
    };
  } catch (e) {
    logQualificationsLoadError("getEmployeeQualificationsBundle", e);
    return emptyQualificationsBundle(employeeId);
  }
}
