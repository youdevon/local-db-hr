import type { QualificationSystemCode } from "@/lib/qualifications-constants";
import type { QualificationGroupRow, StandaloneQualificationRow } from "@/lib/server/employee-qualifications-bundle";

/** Add-menu value: exam sitting (group) or standalone slug. */
export type RegisterExamKind = "csec_cxc" | "gce_o_level" | "cape" | "gce_a_level";
export type RegisterStandaloneKind =
  | "cxc"
  | "csec"
  | "associate_degree"
  | "bachelors_degree"
  | "masters_degree"
  | "doctorate_phd";

export type RegisterMenuKind = RegisterExamKind | RegisterStandaloneKind;

export const REGISTER_MENU_SECTIONS: {
  label: string;
  items: { kind: RegisterMenuKind; label: string }[];
}[] = [
  {
    label: "Qualification Types",
    items: [
      { kind: "cxc", label: "CXC" },
      { kind: "csec", label: "CSEC" },
      { kind: "associate_degree", label: "Associate Degree" },
      { kind: "bachelors_degree", label: "Bachelor’s Degree" },
      { kind: "masters_degree", label: "Master’s Degree" },
      { kind: "doctorate_phd", label: "PhD / Doctorate" },
    ],
  },
];

export function isRegisterExamKind(k: RegisterMenuKind): k is RegisterExamKind {
  return k === "csec_cxc" || k === "gce_o_level" || k === "cape" || k === "gce_a_level";
}

export function examPresetForKind(kind: RegisterExamKind): {
  qualificationSystem: QualificationSystemCode;
  level: string;
} {
  switch (kind) {
    case "csec_cxc":
      return { qualificationSystem: "CXC_CSEC", level: "" };
    case "gce_o_level":
      return { qualificationSystem: "GCE", level: "O_LEVEL" };
    case "cape":
      return { qualificationSystem: "CAPE", level: "" };
    case "gce_a_level":
      return { qualificationSystem: "GCE", level: "A_LEVEL" };
  }
}

/** Table / list label for grouped exam rows. */
export function displayExamGroupType(g: QualificationGroupRow): string {
  if (g.qualificationSystem === "CXC_CSEC") return "CSEC / CXC";
  if (g.qualificationSystem === "CAPE") return "CAPE";
  if (g.qualificationSystem === "GCE") {
    if (g.level === "O_LEVEL") return "GCE O-Level";
    if (g.level === "A_LEVEL") return "GCE A-Level";
    if (g.level === "AS_LEVEL") return "GCE AS-Level";
    return "GCE";
  }
  return g.qualificationSystemLabel;
}

export function formatInstitutionAwarding(
  institution: string | null | undefined,
  awarding: string | null | undefined,
): string {
  const i = institution?.trim();
  const a = awarding?.trim();
  if (i && a && i === a) return i;
  return [i, a].filter(Boolean).join(" · ") || "—";
}

/** Map saved standalone row → register form kind for edit (best effort). */
export function inferStandaloneRegisterKind(row: StandaloneQualificationRow): RegisterStandaloneKind {
  const t = row.qualificationType;
  const direct: Partial<Record<string, RegisterStandaloneKind>> = {
    cxc: "cxc",
    csec: "csec",
    associate_degree: "associate_degree",
    bachelors_degree: "bachelors_degree",
    masters_degree: "masters_degree",
    doctorate_phd: "doctorate_phd",
  };
  if (direct[t]) return direct[t]!;
  return "associate_degree";
}

