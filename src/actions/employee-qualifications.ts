"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";
import { getEmployeeAuditTargetLabel } from "@/lib/audit-employee-target";
import {
  diffQualificationSnapshots,
  qualificationRowToSnapshot,
  truncateAuditText,
} from "@/lib/audit-qualification";
import { requirePermission } from "@/lib/auth-server";
import { CXC_CSEC_GRADE_OPTIONS, CXC_CSEC_SUBJECT_SET } from "@/lib/cxc-csec-subjects";
import { prisma } from "@/lib/prisma";
import {
  createEvidenceSchema,
  cxcCsecBatchQualificationsSaveSchema,
  DEGREE_TYPES,
  groupIdSchema,
  normalizeStandaloneQualificationInput,
  qualificationGroupSaveSchema,
  qualificationIdSchema,
  standaloneQualificationSaveSchema,
} from "@/lib/validators/employee-qualifications";

function standaloneQualificationTypeFromInput(input: unknown): string | undefined {
  if (!input || typeof input !== "object") return undefined;
  const r = input as Record<string, unknown>;
  const t = r.qualificationType ?? r.degreeType ?? r.type ?? r.qualification_type;
  return typeof t === "string" ? t.trim() : undefined;
}

function degreeIncompleteAfterNormalize(normalized: unknown): boolean {
  if (normalized == null || typeof normalized !== "object") return false;
  const n = normalized as Record<string, unknown>;
  const qt = String(n.qualificationType ?? "").trim();
  if (!DEGREE_TYPES.has(qt)) return false;
  const field = String(n.fieldOfStudy ?? "").trim();
  const inst = String(n.institution ?? "").trim();
  const da = typeof n.dateAwarded === "string" ? n.dateAwarded.trim() : "";
  const hasIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(da);
  return !field || !inst || !hasIsoDate;
}

export type QualificationActionResult =
  | { success: true; message: string }
  | { success: false; message: string };

function revalidateEmployee(employeeId: string) {
  revalidatePath(`/employees/${employeeId}`);
}

async function requireEmployeesEdit(): Promise<
  { ok: true; userId: string } | { ok: false; message: string }
> {
  const auth = await requirePermission("employees.edit");
  if (!auth?.userId) {
    return { ok: false, message: "You do not have permission to edit employee records." };
  }
  return { ok: true, userId: auth.userId };
}

export async function saveStandaloneQualificationAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) {
    return { success: false, message: "You do not have permission to add qualifications." };
  }

  const normalizedInput = normalizeStandaloneQualificationInput(input);

  const parsed = standaloneQualificationSaveSchema.safeParse(normalizedInput);
  if (!parsed.success) {
    const qt = standaloneQualificationTypeFromInput(normalizedInput);
    const first = parsed.error.issues[0];
    const empBad =
      first?.path?.length === 1 && first.path[0] === "employeeId";
    const structural =
      first?.code === "invalid_type" ||
      (typeof first?.message === "string" &&
        (first.message.includes("undefined") ||
          first.message.includes("nonoptional") ||
          first.message.includes("Expected")));

    if (qt && DEGREE_TYPES.has(qt)) {
      if (degreeIncompleteAfterNormalize(normalizedInput)) {
        return {
          success: false,
          message:
            "Please complete Degree Type, Field / Area of Study, Institution, and Year.",
        };
      }
      if (!empBad && structural) {
        return {
          success: false,
          message:
            "Please complete Degree Type, Field / Area of Study, Institution, and Year.",
        };
      }
      return {
        success: false,
        message:
          first?.message ??
          "Failed to save qualification. Please check the required fields.",
      };
    }

    return {
      success: false,
      message:
        first?.message ??
        "Failed to save qualification. Please check the required fields.",
    };
  }

  const d = parsed.data;
  const emp = await prisma.employees.findUnique({ where: { id: d.employeeId }, select: { id: true } });
  if (!emp) return { success: false, message: "Employee not found." };

  const dateAwarded = d.dateAwarded ? new Date(`${d.dateAwarded}T12:00:00`) : null;
  const expiryDate =
    d.hasExpiry && d.expiryDate ? new Date(`${d.expiryDate}T12:00:00`) : null;
  const awardingBodyResolved =
    d.awardingBody?.trim() || d.institution?.trim() || null;

  let snapshotBefore: ReturnType<typeof qualificationRowToSnapshot> | null = null;
  if (d.id) {
    const existingRow = await prisma.employee_qualifications.findFirst({
      where: { id: d.id, employee_id: d.employeeId },
    });
    if (!existingRow) return { success: false, message: "Qualification not found." };
    snapshotBefore = qualificationRowToSnapshot(existingRow);
  }

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    let savedQualificationId: string;
    if (d.id) {
      await prisma.employee_qualifications.update({
        where: { id: d.id },
        data: {
          category: d.category,
          qualification_type: d.qualificationType,
          qualification_title: d.qualificationTitle,
          title: d.qualificationTitle.trim(),
          institution: d.institution?.trim() || null,
          awarding_body: awardingBodyResolved,
          field_of_study: d.fieldOfStudy?.trim() || null,
          grade_result: d.gradeResult?.trim() || null,
          qualification_level: d.qualificationLevel?.trim() || null,
          date_awarded: dateAwarded,
          expiry_date: expiryDate,
          has_expiry: d.hasExpiry,
          verification_status: d.verificationStatus,
          status: d.status,
          notes: d.notes?.trim() || null,
          document_id: d.documentId ?? null,
          updated_at: new Date(),
          updated_by: gate.userId,
        },
      });
      savedQualificationId = d.id;
    } else {
      const created = await prisma.employee_qualifications.create({
        data: {
          employee_id: d.employeeId,
          category: d.category,
          qualification_type: d.qualificationType,
          qualification_title: d.qualificationTitle,
          title: d.qualificationTitle.trim(),
          institution: d.institution?.trim() || null,
          awarding_body: awardingBodyResolved,
          field_of_study: d.fieldOfStudy?.trim() || null,
          grade_result: d.gradeResult?.trim() || null,
          qualification_level: d.qualificationLevel?.trim() || null,
          date_awarded: dateAwarded,
          expiry_date: expiryDate,
          has_expiry: d.hasExpiry,
          verification_status: d.verificationStatus,
          status: d.status,
          notes: d.notes?.trim() || null,
          document_id: d.documentId ?? null,
          created_by: gate.userId,
          updated_by: gate.userId,
        },
      });
      savedQualificationId = created.id;
    }

    const savedRow = await prisma.employee_qualifications.findUnique({
      where: { id: savedQualificationId },
    });
    if (savedRow) {
      const afterSnap = qualificationRowToSnapshot(savedRow);
      const changes = diffQualificationSnapshots(snapshotBefore, afterSnap);
      const titleForSummary =
        savedRow.title?.trim() || savedRow.qualification_title?.trim() || "Qualification";
      const summary = d.id
        ? `Updated qualification: ${truncateAuditText(titleForSummary, 160)}`
        : `Added qualification: ${truncateAuditText(titleForSummary, 160)}`;
      await createSystemAuditLog({
        actorUserId: gate.userId,
        module: "qualifications",
        action: d.id ? "qualification_updated" : "qualification_created",
        targetType: "employee",
        targetId: d.employeeId,
        targetLabel: await getEmployeeAuditTargetLabel(d.employeeId),
        success: true,
        metadata: {
          summary,
          qualificationId: savedRow.id,
          qualificationTitle: titleForSummary,
          changes,
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    }

    revalidateEmployee(d.employeeId);
    return {
      success: true,
      message: d.id ? "Qualification saved." : "Qualification added successfully.",
    };
  } catch (e) {
    console.error("[saveStandaloneQualificationAction] failed", {
      employeeId: d.employeeId,
      qualificationType: d.qualificationType,
      fieldOfStudy: d.fieldOfStudy,
      institution: d.institution,
      year: d.dateAwarded?.slice(0, 4),
      message: e instanceof Error ? e.message : String(e),
    });
    return {
      success: false,
      message: "Failed to save qualification. Please check the required fields.",
    };
  }
}

function normalizeCxcCsecBatchRow(raw: unknown): { subject: string; grade: string } {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const subject = String(
    row.subject ?? row.subjectName ?? row.subject_name ?? row.title ?? row.qualificationTitle ?? "",
  ).trim();
  const grade = String(row.grade ?? row.gradeResult ?? row.grade_result ?? "").trim();
  return { subject, grade };
}

export async function saveCxcCsecQualificationsBatchAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) {
    return { success: false, message: "You do not have permission to add qualifications." };
  }

  const parsed = cxcCsecBatchQualificationsSaveSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Failed to save qualifications. Please check the required fields.",
    };
  }

  const { employeeId, qualificationType, rows } = parsed.data;
  const emp = await prisma.employees.findUnique({ where: { id: employeeId }, select: { id: true } });
  if (!emp) return { success: false, message: "Employee not found." };

  const normalizedRows = rows.map((row) => normalizeCxcCsecBatchRow(row));

  for (const row of normalizedRows) {
    if (
      !row.subject ||
      !row.grade ||
      !CXC_CSEC_GRADE_OPTIONS.includes(row.grade as (typeof CXC_CSEC_GRADE_OPTIONS)[number])
    ) {
      return { success: false, message: "Please select a subject and grade for each row." };
    }
    if (!CXC_CSEC_SUBJECT_SET.has(row.subject)) {
      return { success: false, message: "Please select a subject and grade for each row." };
    }
  }

  const subjects = normalizedRows.map((r) => r.subject);
  const seen = new Set<string>();
  for (const s of subjects) {
    if (seen.has(s)) {
      return {
        success: false,
        message: "Duplicate subjects are not allowed in the same qualification entry.",
      };
    }
    seen.add(s);
  }

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    await prisma.$transaction(
      normalizedRows.map((row) =>
        prisma.employee_qualifications.create({
          data: {
            employee_id: employeeId,
            category: "academic",
            qualification_type: qualificationType,
            qualification_title: row.subject,
            title: row.subject,
            grade_result: row.grade,
            awarding_body: "CXC",
            has_expiry: false,
            status: "active",
            verification_status: "not_required",
            institution: null,
            field_of_study: null,
            qualification_level: null,
            date_awarded: null,
            expiry_date: null,
            notes: null,
            document_id: null,
            created_by: gate.userId,
            updated_by: gate.userId,
          },
        }),
      ),
    );

    const kindLabel = qualificationType === "csec" ? "CSEC" : "CXC";
    const parts = normalizedRows.map((r) => `${r.subject} (${r.grade})`);
    const summary = `Added ${normalizedRows.length} ${kindLabel} qualifications: ${parts.join(", ")}`;
    await createSystemAuditLog({
      actorUserId: gate.userId,
      module: "qualifications",
      action: "qualification_batch_created",
      targetType: "employee",
      targetId: employeeId,
      targetLabel: await getEmployeeAuditTargetLabel(employeeId),
      success: true,
      metadata: {
        summary,
        qualificationType,
        batchSize: normalizedRows.length,
        subjects: normalizedRows.map((r) => ({ subject: r.subject, grade: r.grade })),
      },
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });

    revalidateEmployee(employeeId);
    return { success: true, message: "Qualifications added successfully." };
  } catch (e) {
    console.error("[saveCxcCsecQualificationsBatchAction] failed", {
      employeeId,
      qualificationType,
      rowCount: rows.length,
      message: e instanceof Error ? e.message : String(e),
    });
    return {
      success: false,
      message: "Failed to save qualifications. Please check the required fields.",
    };
  }
}

export async function deleteStandaloneQualificationAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) return { success: false, message: gate.message };

  const parsed = qualificationIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Invalid request." };

  const { employeeId, qualificationId } = parsed.data;
  const row = await prisma.employee_qualifications.findFirst({
    where: { id: qualificationId, employee_id: employeeId },
  });
  if (!row) return { success: false, message: "Qualification not found." };

  const title =
    row.title?.trim() || row.qualification_title?.trim() || "Qualification";
  const snapshot = qualificationRowToSnapshot(row);
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    await prisma.employee_qualifications.delete({ where: { id: qualificationId } });
    await createSystemAuditLog({
      actorUserId: gate.userId,
      module: "qualifications",
      action: "qualification_deleted",
      targetType: "employee",
      targetId: employeeId,
      targetLabel: await getEmployeeAuditTargetLabel(employeeId),
      success: true,
      metadata: {
        summary: `Removed qualification: ${truncateAuditText(title, 160)}`,
        qualificationId,
        qualificationTitle: title,
        snapshot,
      },
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
    });
    revalidateEmployee(employeeId);
    return { success: true, message: "Qualification removed." };
  } catch (e) {
    console.error("[deleteStandaloneQualificationAction]", e);
    return { success: false, message: "Could not remove qualification." };
  }
}

export async function saveQualificationGroupAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) return { success: false, message: gate.message };

  const parsed = qualificationGroupSaveSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const d = parsed.data;
  const emp = await prisma.employees.findUnique({ where: { id: d.employeeId }, select: { id: true } });
  if (!emp) return { success: false, message: "Employee not found." };

  try {
    if (d.id) {
      const g = await prisma.employee_qualification_groups.findFirst({
        where: { id: d.id, employee_id: d.employeeId },
      });
      if (!g) return { success: false, message: "Exam sitting not found." };

      await prisma.$transaction(async (tx) => {
        await tx.employee_qualification_subjects.deleteMany({ where: { group_id: d.id! } });
        await tx.employee_qualification_groups.update({
          where: { id: d.id },
          data: {
            qualification_system: d.qualificationSystem,
            sitting_year: d.sittingYear,
            institution: d.institution?.trim() || null,
            awarding_body: d.awardingBody?.trim() || null,
            level: d.level?.trim() || null,
            notes: d.notes?.trim() || null,
            document_id: d.documentId ?? null,
            updated_at: new Date(),
            updated_by: gate.userId,
          },
        });
        await tx.employee_qualification_subjects.createMany({
          data: d.subjects.map((s) => ({
            group_id: d.id!,
            subject_name: s.subjectName.trim(),
            level_or_unit: s.levelOrUnit?.trim() || null,
            grade_result: s.gradeResult?.trim() || null,
            remarks: s.remarks?.trim() || null,
          })),
        });
      });
    } else {
      await prisma.$transaction(async (tx) => {
        const created = await tx.employee_qualification_groups.create({
          data: {
            employee_id: d.employeeId,
            qualification_system: d.qualificationSystem,
            sitting_year: d.sittingYear,
            institution: d.institution?.trim() || null,
            awarding_body: d.awardingBody?.trim() || null,
            level: d.level?.trim() || null,
            notes: d.notes?.trim() || null,
            document_id: d.documentId ?? null,
            created_by: gate.userId,
            updated_by: gate.userId,
          },
        });
        await tx.employee_qualification_subjects.createMany({
          data: d.subjects.map((s) => ({
            group_id: created.id,
            subject_name: s.subjectName.trim(),
            level_or_unit: s.levelOrUnit?.trim() || null,
            grade_result: s.gradeResult?.trim() || null,
            remarks: s.remarks?.trim() || null,
          })),
        });
      });
    }

    revalidateEmployee(d.employeeId);
    return { success: true, message: "Exam sitting saved." };
  } catch (e) {
    console.error("[saveQualificationGroupAction]", e);
    return { success: false, message: "Could not save exam sitting." };
  }
}

export async function deleteQualificationGroupAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) return { success: false, message: gate.message };

  const parsed = groupIdSchema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Invalid request." };

  const { employeeId, groupId } = parsed.data;
  const row = await prisma.employee_qualification_groups.findFirst({
    where: { id: groupId, employee_id: employeeId },
  });
  if (!row) return { success: false, message: "Exam sitting not found." };

  try {
    await prisma.employee_qualification_groups.delete({ where: { id: groupId } });
    revalidateEmployee(employeeId);
    return { success: true, message: "Exam sitting removed." };
  } catch (e) {
    console.error("[deleteQualificationGroupAction]", e);
    return { success: false, message: "Could not remove exam sitting." };
  }
}

export async function linkQualificationEvidenceAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) return { success: false, message: gate.message };

  const schema = z.object({
    employeeId: z.string().uuid(),
    qualificationId: z.string().uuid().optional(),
    groupId: z.string().uuid().optional(),
    documentId: z.string().uuid().nullable(),
  });

  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, message: "Invalid request." };

  const { employeeId, qualificationId, groupId, documentId } = parsed.data;
  if ((qualificationId && groupId) || (!qualificationId && !groupId)) {
    return { success: false, message: "Specify either qualification or exam sitting." };
  }

  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    if (qualificationId) {
      const row = await prisma.employee_qualifications.findFirst({
        where: { id: qualificationId, employee_id: employeeId },
      });
      if (!row) return { success: false, message: "Qualification not found." };
      if (documentId) {
        const doc = await prisma.employee_documents.findFirst({
          where: { id: documentId, employee_id: employeeId },
        });
        if (!doc) return { success: false, message: "Document not found for this employee." };
      }
      await prisma.employee_qualifications.update({
        where: { id: qualificationId },
        data: { document_id: documentId, updated_at: new Date(), updated_by: gate.userId },
      });
      const qt =
        row.title?.trim() || row.qualification_title?.trim() || "Qualification";
      const summary = documentId
        ? `Attached evidence document to qualification: ${truncateAuditText(qt, 140)}`
        : `Removed evidence document from qualification: ${truncateAuditText(qt, 140)}`;
      await createSystemAuditLog({
        actorUserId: gate.userId,
        module: "qualifications",
        action: documentId ? "qualification_evidence_attached" : "qualification_evidence_removed",
        targetType: "employee",
        targetId: employeeId,
        targetLabel: await getEmployeeAuditTargetLabel(employeeId),
        success: true,
        metadata: {
          summary,
          qualificationId,
          documentId,
          qualificationTitle: qt,
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    } else if (groupId) {
      const row = await prisma.employee_qualification_groups.findFirst({
        where: { id: groupId, employee_id: employeeId },
      });
      if (!row) return { success: false, message: "Exam sitting not found." };
      if (documentId) {
        const doc = await prisma.employee_documents.findFirst({
          where: { id: documentId, employee_id: employeeId },
        });
        if (!doc) return { success: false, message: "Document not found for this employee." };
      }
      await prisma.employee_qualification_groups.update({
        where: { id: groupId },
        data: { document_id: documentId, updated_at: new Date(), updated_by: gate.userId },
      });
      const summary = documentId
        ? `Attached evidence document to exam sitting (${row.qualification_system} ${row.sitting_year})`
        : `Removed evidence document from exam sitting (${row.qualification_system} ${row.sitting_year})`;
      await createSystemAuditLog({
        actorUserId: gate.userId,
        module: "qualifications",
        action: documentId ? "qualification_evidence_attached" : "qualification_evidence_removed",
        targetType: "employee",
        targetId: employeeId,
        targetLabel: await getEmployeeAuditTargetLabel(employeeId),
        success: true,
        metadata: {
          summary,
          groupId,
          documentId,
          qualificationSystem: row.qualification_system,
          sittingYear: row.sitting_year,
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    }

    revalidateEmployee(employeeId);
    return { success: true, message: "Evidence link updated." };
  } catch (e) {
    console.error("[linkQualificationEvidenceAction]", e);
    return { success: false, message: "Could not update evidence link." };
  }
}

export async function createQualificationEvidenceDocumentAction(input: unknown): Promise<QualificationActionResult> {
  const gate = await requireEmployeesEdit();
  if (!gate.ok) return { success: false, message: gate.message };

  const parsed = createEvidenceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid request." };
  }

  const d = parsed.data;
  const fileUrl = d.fileUrl?.trim() || null;
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();

  try {
    const doc = await prisma.employee_documents.create({
      data: {
        employee_id: d.employeeId,
        document_name: d.documentName.trim(),
        document_type: d.documentType.trim() || "Qualification Evidence",
        file_url: fileUrl,
        uploaded_by: gate.userId,
      },
    });

    if (d.linkTo === "standalone" && d.qualificationId) {
      await prisma.employee_qualifications.updateMany({
        where: { id: d.qualificationId, employee_id: d.employeeId },
        data: {
          document_id: doc.id,
          updated_at: new Date(),
          updated_by: gate.userId,
        },
      });
    } else if (d.linkTo === "group" && d.groupId) {
      await prisma.employee_qualification_groups.updateMany({
        where: { id: d.groupId, employee_id: d.employeeId },
        data: {
          document_id: doc.id,
          updated_at: new Date(),
          updated_by: gate.userId,
        },
      });
    }

    if (d.linkTo === "standalone" && d.qualificationId) {
      const qRow = await prisma.employee_qualifications.findFirst({
        where: { id: d.qualificationId, employee_id: d.employeeId },
      });
      const qt =
        qRow?.title?.trim() || qRow?.qualification_title?.trim() || "Qualification";
      await createSystemAuditLog({
        actorUserId: gate.userId,
        module: "qualifications",
        action: "qualification_evidence_attached",
        targetType: "employee",
        targetId: d.employeeId,
        targetLabel: await getEmployeeAuditTargetLabel(d.employeeId),
        success: true,
        metadata: {
          summary: `Uploaded and attached evidence "${truncateAuditText(d.documentName, 100)}" to qualification: ${truncateAuditText(qt, 120)}`,
          qualificationId: d.qualificationId,
          documentId: doc.id,
          documentName: d.documentName.trim(),
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    } else if (d.linkTo === "group" && d.groupId) {
      const gRow = await prisma.employee_qualification_groups.findFirst({
        where: { id: d.groupId, employee_id: d.employeeId },
      });
      await createSystemAuditLog({
        actorUserId: gate.userId,
        module: "qualifications",
        action: "qualification_evidence_attached",
        targetType: "employee",
        targetId: d.employeeId,
        targetLabel: await getEmployeeAuditTargetLabel(d.employeeId),
        success: true,
        metadata: {
          summary: `Uploaded and attached evidence "${truncateAuditText(d.documentName, 100)}" to exam sitting (${gRow?.qualification_system ?? "?"} ${gRow?.sitting_year ?? ""})`,
          groupId: d.groupId,
          documentId: doc.id,
          documentName: d.documentName.trim(),
        },
        ipAddress: ip,
        deviceName: deviceLabel,
        userAgent,
      });
    }

    revalidateEmployee(d.employeeId);
    return { success: true, message: "Evidence document created and linked." };
  } catch (e) {
    console.error("[createQualificationEvidenceDocumentAction]", e);
    return { success: false, message: "Could not create evidence document." };
  }
}
