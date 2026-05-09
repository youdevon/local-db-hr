import { z } from "zod";

const uuid = z.string().uuid();

/** CXC/CSEC batch envelope only — row shape + validation handled in saveCxcCsecQualificationsBatchAction */
export const cxcCsecBatchQualificationsSaveSchema = z.object({
  employeeId: uuid,
  qualificationType: z.enum(["cxc", "csec"]),
  rows: z.array(z.any()).min(1, "Please select a subject and grade for each row."),
});

/** Accepts missing keys, null (Flight serialization), and empty string → undefined */
const optionalIsoDate = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v == null) return undefined;
    const t = String(v).trim();
    return t.length ? t : undefined;
  })
  .refine((v) => v === undefined || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "Please enter a valid year.",
  });

const CXC_CSEC_TYPES = new Set(["cxc", "csec"]);

/** Exported for standalone save action checks */
export const DEGREE_TYPES = new Set([
  "associate_degree",
  "bachelors_degree",
  "masters_degree",
  "doctorate_phd",
]);

/** Title prefix — match UI labels (Unicode apostrophe). */
const DEGREE_TITLE_PREFIX: Record<string, string> = {
  associate_degree: "Associate Degree",
  bachelors_degree: "Bachelor’s Degree",
  masters_degree: "Master’s Degree",
  doctorate_phd: "PhD / Doctorate",
};

function awardedYearFromIso(iso: string | undefined): number | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const y = Number(iso.slice(0, 4));
  return Number.isFinite(y) ? y : null;
}

/** Shared by normalizeStandaloneQualificationInput and preprocessStandaloneQualification. */
function resolveFourDigitYear(o: Record<string, unknown>): string | undefined {
  const candidates = [o.year, o.awardYear, o.completionYear, o.dateAwardedYear];
  for (const c of candidates) {
    if (c === undefined || c === null) continue;
    if (typeof c === "bigint") {
      const n = Number(c);
      if (Number.isFinite(n)) {
        const t = Math.trunc(n);
        if (t >= 1000 && t <= 9999) return String(t).padStart(4, "0");
      }
      continue;
    }
    if (typeof c === "number" && Number.isFinite(c)) {
      const n = Math.trunc(c);
      if (n >= 1000 && n <= 9999) return String(n).padStart(4, "0");
      continue;
    }
    const s = String(c).trim();
    if (/^\d{4}$/.test(s)) return s;
    const digitsOnly = s.replace(/\D/g, "");
    if (digitsOnly.length >= 4) {
      const head = digitsOnly.slice(0, 4);
      if (/^\d{4}$/.test(head)) return head;
    }
  }

  const existing = o.dateAwarded ?? o.date_awarded;
  if (existing instanceof Date && !Number.isNaN(existing.getTime())) {
    const y = existing.getUTCFullYear();
    if (y >= 1000 && y <= 9999) return String(y).padStart(4, "0");
  }
  if (typeof existing === "string") {
    const d = existing.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d.slice(0, 4);
    if (/^\d{4}$/.test(d)) return d;
  }
  return undefined;
}

/** Display labels → DB qualification_type (ASCII apostrophe variants normalized). */
const DEGREE_LABEL_TO_TYPE: Record<string, string> = {
  "associate degree": "associate_degree",
  "bachelor's degree": "bachelors_degree",
  "master's degree": "masters_degree",
  "phd / doctorate": "doctorate_phd",
};

function mapHumanDegreeTypeToSlug(qt: string): string {
  const trimmed = qt.trim();
  if (DEGREE_TYPES.has(trimmed)) return trimmed;
  const key = trimmed.toLowerCase().replace(/\u2019/g, "'");
  return DEGREE_LABEL_TO_TYPE[key] ?? trimmed;
}

/**
 * Normalize standalone qualification payloads **before** Zod — merges aliases onto schema camelCase keys
 * and fills degree defaults required by standaloneQualificationSaveSchema.
 */
export function normalizeStandaloneQualificationInput(input: unknown): unknown {
  if (input == null || typeof input !== "object") return input;
  const raw = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...raw };

  let qualificationType = String(
    out.qualificationType ??
      out.degreeType ??
      out.type ??
      out.qualification_type ??
      "",
  ).trim();

  qualificationType = mapHumanDegreeTypeToSlug(qualificationType);
  if (qualificationType) {
    out.qualificationType = qualificationType;
  }

  const fieldOfStudy = String(
    out.fieldOfStudy ??
      out.areaOfStudy ??
      out.field ??
      out.studyArea ??
      out.field_of_study ??
      "",
  ).trim();
  out.fieldOfStudy = fieldOfStudy.length ? fieldOfStudy : undefined;

  const institution = String(
    out.institution ?? out.school ?? out.university ?? "",
  ).trim();
  out.institution = institution.length ? institution : undefined;

  const notesTrimmed = String(out.notes ?? "").trim();
  out.notes = notesTrimmed;

  const yearStr = resolveFourDigitYear(out);
  if (yearStr && /^\d{4}$/.test(yearStr)) {
    out.dateAwarded = `${yearStr}-01-01`;
    out.year = Number(yearStr);
  }

  if (qualificationType && DEGREE_TYPES.has(qualificationType)) {
    const cat = String(out.category ?? "").trim();
    out.category = cat.length ? cat : "academic";

    out.fieldOfStudy = fieldOfStudy.length ? fieldOfStudy : undefined;
    out.institution = institution.length ? institution : undefined;

    if (fieldOfStudy.length > 0) {
      const prefix = DEGREE_TITLE_PREFIX[qualificationType];
      if (prefix) {
        out.qualificationTitle = `${prefix} in ${fieldOfStudy}`;
      }
    }

    const ab = String(out.awardingBody ?? out.awarding_body ?? "").trim();
    out.awardingBody =
      ab.length > 0 ? ab : institution.length > 0 ? institution : undefined;

    if (out.hasExpiry === undefined || out.hasExpiry === null) {
      out.hasExpiry = false;
    }

    const vs = String(out.verificationStatus ?? out.verification_status ?? "").trim();
    out.verificationStatus = vs.length ? vs : "not_required";

    const st = String(out.status ?? "").trim();
    out.status = st.length ? st : "active";

    if (out.documentId === undefined) {
      out.documentId = null;
    }
  }

  return out;
}

/** Coerce Flight/JSON omissions (undefined keys) before Zod parsing */
function preprocessStandaloneQualification(raw: unknown): unknown {
  if (raw == null || typeof raw !== "object") return raw;
  const o = { ...(raw as Record<string, unknown>) };

  const qtRaw = String(
    o.qualificationType ??
      o.degreeType ??
      o.type ??
      o.qualification_type ??
      "",
  ).trim();
  if (qtRaw) {
    o.qualificationType = qtRaw;
  }

  const fieldTrimmed = String(
    o.fieldOfStudy ??
      o.areaOfStudy ??
      o.field ??
      o.studyArea ??
      o.field_of_study ??
      "",
  ).trim();
  o.fieldOfStudy = fieldTrimmed.length ? fieldTrimmed : undefined;

  const instTrimmed = String(
    o.institution ?? o.school ?? o.university ?? "",
  ).trim();
  o.institution = instTrimmed.length ? instTrimmed : undefined;

  const ys = resolveFourDigitYear(o);
  if (ys && /^\d{4}$/.test(ys)) {
    o.dateAwarded = `${ys}-01-01`;
  }

  const notesTrimmed = String(o.notes ?? "").trim();
  o.notes = notesTrimmed.length ? notesTrimmed : undefined;

  if (o.hasExpiry === undefined || o.hasExpiry === null) {
    o.hasExpiry = false;
  }

  const vs = o.verificationStatus ?? o.verification_status;
  if (vs === undefined || vs === null || String(vs).trim() === "") {
    o.verificationStatus = "not_required";
  } else {
    o.verificationStatus = String(vs).trim();
  }

  const st = o.status;
  if (st === undefined || st === null || String(st).trim() === "") {
    o.status = "active";
  } else {
    o.status = String(st).trim();
  }

  const cat = o.category;
  if (cat === undefined || cat === null || String(cat).trim() === "") {
    o.category = "academic";
  }

  if (o.documentId === undefined) {
    o.documentId = null;
  }

  const qt = String(o.qualificationType ?? "").trim();
  if (DEGREE_TYPES.has(qt) && fieldTrimmed.length > 0) {
    const prefix = DEGREE_TITLE_PREFIX[qt];
    if (prefix) {
      o.qualificationTitle = `${prefix} in ${fieldTrimmed}`;
    }
  } else if (o.qualificationTitle === undefined || o.qualificationTitle === null) {
    o.qualificationTitle = "";
  } else {
    o.qualificationTitle = String(o.qualificationTitle).trim();
  }

  const inst =
    typeof o.institution === "string"
      ? o.institution.trim()
      : o.institution != null
        ? String(o.institution).trim()
        : "";

  const ab =
    typeof o.awardingBody === "string"
      ? o.awardingBody.trim()
      : o.awardingBody != null
        ? String(o.awardingBody).trim()
        : "";

  if (!ab && inst) {
    o.awardingBody = inst;
  }

  return o;
}

const trimmedNullable = z.union([z.string(), z.null(), z.undefined()]).transform((v) => {
  if (v == null) return undefined;
  const t = String(v).trim();
  return t.length ? t : undefined;
});

const trimmedString = z.union([z.string(), z.null(), z.undefined()]).transform((v) => String(v ?? "").trim());

export const qualificationSubjectInputSchema = z.object({
  id: uuid.optional(),
  subjectName: z.string().trim().min(1, "Subject name is required"),
  levelOrUnit: z.string().trim().optional(),
  gradeResult: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
});

export const qualificationGroupSaveSchema = z.object({
  id: uuid.optional(),
  employeeId: uuid,
  qualificationSystem: z.enum(["CXC_CSEC", "GCE", "CAPE"]),
  sittingYear: z.coerce.number().int().min(1950).max(2100),
  institution: z.string().trim().optional(),
  awardingBody: z.string().trim().optional(),
  level: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  documentId: uuid.optional().nullable(),
  subjects: z.array(qualificationSubjectInputSchema).min(1, "Add at least one subject"),
});

export const standaloneQualificationSaveSchema = z.preprocess(
  preprocessStandaloneQualification,
  z
    .object({
      id: uuid.optional(),
      employeeId: uuid,
      category: trimmedString.pipe(z.string().min(1)),
      qualificationType: trimmedString.pipe(z.string().min(1)),
      qualificationTitle: trimmedString,
      institution: trimmedNullable.optional(),
      awardingBody: trimmedNullable.optional(),
      fieldOfStudy: trimmedNullable.optional(),
      gradeResult: trimmedNullable.optional(),
      qualificationLevel: trimmedNullable.optional(),
      dateAwarded: optionalIsoDate.optional(),
      expiryDate: optionalIsoDate.optional(),
      hasExpiry: z.coerce.boolean(),
      verificationStatus: trimmedString.pipe(z.string().min(1)),
      status: trimmedString.pipe(z.string().min(1)),
      notes: trimmedNullable.optional(),
      documentId: uuid.optional().nullable(),
    })
    .superRefine((data, ctx) => {
      const yMax = new Date().getFullYear() + 1;

      if (CXC_CSEC_TYPES.has(data.qualificationType)) {
        if (!data.qualificationTitle.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Subject is required.",
            path: ["qualificationTitle"],
          });
        }
        const g = data.gradeResult?.trim();
        if (!g) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Grade is required.",
            path: ["gradeResult"],
          });
        } else if (!["I", "II", "III"].includes(g)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Grade must be I, II, or III.",
            path: ["gradeResult"],
          });
        }
        return;
      }

      if (DEGREE_TYPES.has(data.qualificationType)) {
        const y = awardedYearFromIso(data.dateAwarded);
        const invalidDegree =
          !data.fieldOfStudy?.trim() ||
          !data.institution?.trim() ||
          y == null ||
          y < 1950 ||
          y > yMax;
        if (invalidDegree) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Please complete Degree Type, Field / Area of Study, Institution, and Year.",
            path: ["fieldOfStudy"],
          });
        }
        return;
      }

      if (!data.qualificationTitle.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Qualification title is required.",
          path: ["qualificationTitle"],
        });
      }

      if (
        data.hasExpiry &&
        (!data.expiryDate || !/^\d{4}-\d{2}-\d{2}$/.test(data.expiryDate))
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please enter a valid expiry date.",
          path: ["expiryDate"],
        });
      }
    }),
);

export const qualificationIdSchema = z.object({
  employeeId: uuid,
  qualificationId: uuid,
});

export const groupIdSchema = z.object({
  employeeId: uuid,
  groupId: uuid,
});

export const linkDocumentSchema = z.object({
  employeeId: uuid,
  qualificationId: uuid.optional(),
  groupId: uuid.optional(),
  documentId: uuid.optional().nullable(),
}).refine((d) => (d.qualificationId ? !d.groupId : !!d.groupId) || (!d.qualificationId && !d.groupId), {
  message: "Provide qualificationId or groupId",
});

export const createEvidenceSchema = z
  .object({
    employeeId: uuid,
    linkTo: z.enum(["standalone", "group"]),
    qualificationId: uuid.optional(),
    groupId: uuid.optional(),
    documentName: z.string().trim().min(1),
    fileUrl: z
      .string()
      .trim()
      .optional()
      .transform((s) => (s && /^https?:\/\//i.test(s) ? s : undefined)),
    documentType: z.string().trim().default("Qualification Evidence"),
  })
  .refine(
    (d) =>
      (d.linkTo === "standalone" && d.qualificationId) ||
      (d.linkTo === "group" && d.groupId),
    { message: "Missing target id" },
  );
