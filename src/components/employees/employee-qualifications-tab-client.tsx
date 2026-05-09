"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deleteQualificationGroupAction,
  deleteStandaloneQualificationAction,
  linkQualificationEvidenceAction,
  saveCxcCsecQualificationsBatchAction,
  saveQualificationGroupAction,
  saveStandaloneQualificationAction,
} from "@/actions/employee-qualifications";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GCE_LEVEL_LABEL, GCE_LEVELS, QUALIFICATION_SYSTEM_LABEL, QUALIFICATION_SYSTEMS, QUALIFICATION_TYPE_LABEL } from "@/lib/qualifications-constants";
import {
  REGISTER_MENU_SECTIONS,
  displayExamGroupType,
  examPresetForKind,
  formatInstitutionAwarding,
  inferStandaloneRegisterKind,
  isRegisterExamKind,
  type RegisterExamKind,
  type RegisterMenuKind,
  type RegisterStandaloneKind,
} from "@/lib/qualifications-register-menu";
import type {
  EmployeeQualificationsBundle,
  QualificationGroupRow,
  StandaloneQualificationRow,
} from "@/lib/server/employee-qualifications-bundle";
import {
  CXC_CSEC_GRADE_OPTIONS,
  CXC_CSEC_SUBJECT_OPTIONS,
  CXC_CSEC_SUBJECT_SET,
  type CxcCsecGrade,
} from "@/lib/cxc-csec-subjects";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { ChevronDown, Plus, Trash2 } from "lucide-react";

const panel =
  "rounded-xl border border-border bg-card p-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-foreground/[0.04]";

/** `randomUUID` is not available on some HTTP origins (non-localhost); avoid hard-crashing React. */
function newQualificationBatchRowKey(): string {
  const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return `qrow-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function formatStandaloneGradeDisplay(q: StandaloneQualificationRow): string {
  const g = q.gradeResult?.trim();
  if (!g) return "—";
  if (q.qualificationType === "cxc" || q.qualificationType === "csec") {
    if (CXC_CSEC_GRADE_OPTIONS.includes(g as CxcCsecGrade)) {
      return `Grade ${g}`;
    }
  }
  return g;
}

type Props = {
  employeeId: string;
  initialBundle: EmployeeQualificationsBundle;
  allowEdit: boolean;
};

export function EmployeeQualificationsTabClient({ employeeId, initialBundle, allowEdit }: Props) {
  const router = useRouter();

  const groupRows = initialBundle.groups ?? [];
  const standaloneRows = initialBundle.standalone ?? [];
  const documentRefs = initialBundle.documents ?? [];

  const sortedGroups = useMemo(() => {
    return [...groupRows].sort((a, b) => {
      const rankDelta = getQualificationRankForGroup(b) - getQualificationRankForGroup(a);
      if (rankDelta !== 0) return rankDelta;
      if (b.sittingYear !== a.sittingYear) return b.sittingYear - a.sittingYear;
      return displayExamGroupType(a).localeCompare(displayExamGroupType(b));
    });
  }, [groupRows]);

  const sortedStandalone = useMemo(() => {
    return [...standaloneRows].sort((a, b) => {
      const rankDelta = getQualificationRankForStandalone(b) - getQualificationRankForStandalone(a);
      if (rankDelta !== 0) return rankDelta;
      const ay = yearFromDateString(a.dateAwarded);
      const by = yearFromDateString(b.dateAwarded);
      if (by !== ay) return by - ay;
      return a.title.localeCompare(b.title);
    });
  }, [standaloneRows]);

  const orderedRows = useMemo(() => {
    const rows: Array<
      | {
          kind: "group";
          rank: number;
          year: number;
          label: string;
          row: QualificationGroupRow;
        }
      | {
          kind: "standalone";
          rank: number;
          year: number;
          label: string;
          row: StandaloneQualificationRow;
        }
    > = [];

    for (const g of sortedGroups) {
      rows.push({
        kind: "group",
        rank: getQualificationRankForGroup(g),
        year: g.sittingYear ?? 0,
        label: displayExamGroupType(g),
        row: g,
      });
    }
    for (const q of sortedStandalone) {
      rows.push({
        kind: "standalone",
        rank: getQualificationRankForStandalone(q),
        year: yearFromDateString(q.dateAwarded),
        label: q.title,
        row: q,
      });
    }

    return rows.sort((a, b) => {
      if (b.rank !== a.rank) return b.rank - a.rank;
      if (b.year !== a.year) return b.year - a.year;
      return a.label.localeCompare(b.label);
    });
  }, [sortedGroups, sortedStandalone]);

  const hasRows = sortedGroups.length > 0 || sortedStandalone.length > 0;

  const [examOpen, setExamOpen] = useState(false);
  const [examCreatePreset, setExamCreatePreset] = useState<{ kind: RegisterExamKind } | null>(null);
  const [groupEdit, setGroupEdit] = useState<QualificationGroupRow | null>(null);

  const [standaloneOpen, setStandaloneOpen] = useState(false);
  const [standaloneCreateKind, setStandaloneCreateKind] = useState<RegisterStandaloneKind | null>(null);
  const [standaloneEdit, setStandaloneEdit] = useState<StandaloneQualificationRow | null>(null);
  const [cxcCsecBatchOpen, setCxcCsecBatchOpen] = useState(false);
  const [cxcCsecBatchKind, setCxcCsecBatchKind] = useState<"cxc" | "csec" | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);

  function openMenuSelection(kind: RegisterMenuKind) {
    setAddMenuOpen(false);
    if (isRegisterExamKind(kind)) {
      setExamCreatePreset({ kind });
      setGroupEdit(null);
      setExamOpen(true);
    } else if (kind === "cxc" || kind === "csec") {
      setStandaloneCreateKind(null);
      setStandaloneEdit(null);
      setCxcCsecBatchKind(kind);
      setCxcCsecBatchOpen(true);
    } else {
      setStandaloneCreateKind(kind);
      setStandaloneEdit(null);
      setStandaloneOpen(true);
    }
  }

  async function onSaveGroup(form: FormData) {
    const preset = examCreatePreset ? examPresetForKind(examCreatePreset.kind) : null;
    const subjectNames = form.getAll("subjectName") as string[];
    const grades = form.getAll("gradeResult") as string[];
    const units = form.getAll("levelOrUnit") as string[];
    const remarks = form.getAll("remarks") as string[];
    const subjects = subjectNames
      .map((subjectName, i) => ({
        subjectName,
        gradeResult: grades[i] ?? "",
        levelOrUnit: units[i] ?? "",
        remarks: remarks[i] ?? "",
      }))
      .filter((s) => s.subjectName.trim());

    const qualSystem = String(form.get("qualificationSystem") ?? "");
    const levelRaw = String(form.get("level") ?? "").trim();

    const payload = {
      id: groupEdit?.id,
      employeeId,
      qualificationSystem: qualSystem as (typeof QUALIFICATION_SYSTEMS)[number],
      sittingYear: Number(form.get("sittingYear")),
      institution: String(form.get("institution") ?? ""),
      awardingBody: String(form.get("awardingBody") ?? ""),
      level: qualSystem === "GCE" ? levelRaw : "",
      notes: String(form.get("notes") ?? ""),
      documentId: ((form.get("documentId") as string) || "").trim() || null,
      subjects,
    };

    const res = await saveQualificationGroupAction(payload);
    if (res.success) {
      notifySuccess(res.message);
      setExamOpen(false);
      setExamCreatePreset(null);
      setGroupEdit(null);
      router.refresh();
    } else notifyError(res.message);
  }

  function refreshAfterStandaloneSave() {
    setStandaloneOpen(false);
    setStandaloneCreateKind(null);
    setStandaloneEdit(null);
    router.refresh();
  }

  async function submitStandalonePayload(payload: Parameters<typeof saveStandaloneQualificationAction>[0]) {
    try {
      const res = await saveStandaloneQualificationAction(payload);
      if (res.success) {
        notifySuccess(res.message);
        refreshAfterStandaloneSave();
      } else notifyError(res.message);
    } catch {
      notifyError("Failed to save qualification. Please check the required fields.");
    }
  }

  const examDialogPreset = examCreatePreset ? examPresetForKind(examCreatePreset.kind) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-foreground text-lg font-semibold tracking-tight">Qualifications</h3>
        {allowEdit ? (
          <div className="relative">
            <Button
              type="button"
              className={cn(buttonVariants(), "gap-2 sm:min-w-[11rem]")}
              onClick={() => setAddMenuOpen((v) => !v)}
            >
              Add qualification
              <ChevronDown className="size-4 opacity-70" />
            </Button>
            {addMenuOpen ? (
              <div className="absolute right-0 z-50 mt-2 w-[18rem] rounded-lg border border-border bg-popover p-2 shadow-lg">
                {REGISTER_MENU_SECTIONS.map((section, idx) => (
                  <Fragment key={section.label}>
                    {idx > 0 ? <div className="my-2 h-px bg-border" /> : null}
                    <p className="text-muted-foreground px-2 pb-1 text-xs">{section.label}</p>
                    <div className="space-y-1">
                      {section.items.map((item) => (
                        <Button
                          key={item.kind}
                          type="button"
                          variant="ghost"
                          className="h-8 w-full justify-start px-2 text-sm"
                          onClick={() => openMenuSelection(item.kind)}
                        >
                          {item.label}
                        </Button>
                      ))}
                    </div>
                  </Fragment>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {!hasRows ? (
        <div className={cn(panel, "text-center py-10")}>
          <p className="text-muted-foreground text-sm">No qualifications recorded.</p>
        </div>
      ) : null}

      {/* Desktop register */}
      {hasRows ? (
        <div className="hidden md:block overflow-x-auto rounded-xl border border-border">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="min-w-[10rem] font-semibold">Qualification type</TableHead>
                <TableHead className="min-w-[11rem] font-semibold">Title / Subject</TableHead>
                <TableHead className="min-w-[10rem] font-semibold">Institution / Awarding body</TableHead>
                <TableHead className="min-w-[7rem] font-semibold">Grade / Result</TableHead>
                <TableHead className="min-w-[9rem] font-semibold">Date / Year</TableHead>
                <TableHead className="min-w-[7rem] font-semibold">Evidence</TableHead>
                <TableHead className="w-[9rem] text-right font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {orderedRows.map((entry) => {
                if (entry.kind === "group") {
                  const g = entry.row;
                  return (
                    <Fragment key={g.id}>
                      <TableRow className="bg-muted/25">
                        <TableCell className="font-medium">
                          {displayExamGroupType(g)} — {g.sittingYear}
                        </TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell>{formatInstitutionAwarding(g.institution, g.awardingBody)}</TableCell>
                        <TableCell>—</TableCell>
                        <TableCell className="tabular-nums">{g.sittingYear}</TableCell>
                        <TableCell>
                          {allowEdit ? (
                            <EvidenceLink
                              employeeId={employeeId}
                              documents={documentRefs}
                              documentId={g.documentId}
                              onLinked={() => router.refresh()}
                              target={{ groupId: g.id }}
                            />
                          ) : (
                            <EvidenceView documents={documentRefs} documentId={g.documentId} />
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {allowEdit ? (
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-8"
                                onClick={() => {
                                  setExamCreatePreset(null);
                                  setGroupEdit(g);
                                  setExamOpen(true);
                                }}
                              >
                                Edit
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="h-8 px-2"
                                onClick={async () => {
                                  if (!confirm("Remove this sitting and all subjects?")) return;
                                  const res = await deleteQualificationGroupAction({ employeeId, groupId: g.id });
                                  if (res.success) {
                                    notifySuccess(res.message);
                                    router.refresh();
                                  } else notifyError(res.message);
                                }}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                      {g.subjects.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell />
                          <TableCell className="border-l-2 border-primary/25 pl-4">{s.subjectName}</TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell>{s.gradeResult ?? "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-xs">
                            {[s.levelOrUnit, s.remarks].filter(Boolean).join(" · ") || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground">—</TableCell>
                          <TableCell />
                        </TableRow>
                      ))}
                    </Fragment>
                  );
                }

                const q = entry.row;
                return (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{displayQualificationType(q)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{q.title}</div>
                      {q.fieldOfStudy ? (
                        <div className="text-muted-foreground text-xs">{q.fieldOfStudy}</div>
                      ) : null}
                    </TableCell>
                    <TableCell>{formatInstitutionAwarding(q.institution, q.awardingBody)}</TableCell>
                    <TableCell>{formatStandaloneGradeDisplay(q)}</TableCell>
                    <TableCell className="tabular-nums text-sm">{formatStandaloneDates(q)}</TableCell>
                    <TableCell>
                      {allowEdit ? (
                        <EvidenceLink
                          employeeId={employeeId}
                          documents={documentRefs}
                          documentId={q.documentId}
                          onLinked={() => router.refresh()}
                          target={{ qualificationId: q.id }}
                        />
                      ) : (
                        <EvidenceView documents={documentRefs} documentId={q.documentId} />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {allowEdit ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8"
                            onClick={() => {
                              setStandaloneEdit(q);
                              setStandaloneCreateKind(null);
                              setStandaloneOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 px-2"
                            onClick={async () => {
                              if (!confirm("Remove this qualification?")) return;
                              const res = await deleteStandaloneQualificationAction({
                                employeeId,
                                qualificationId: q.id,
                              });
                              if (res.success) {
                                notifySuccess(res.message);
                                router.refresh();
                              } else notifyError(res.message);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {/* Mobile register */}
      {hasRows ? (
        <div className="space-y-4 md:hidden">
          {orderedRows.map((entry) => {
            if (entry.kind === "group") {
              const g = entry.row;
              return (
                <div key={g.id} className={cn(panel, "space-y-3 p-4")}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold">
                        {displayExamGroupType(g)} — {g.sittingYear}
                      </p>
                      <p className="text-muted-foreground text-sm">
                        {formatInstitutionAwarding(g.institution, g.awardingBody)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {allowEdit ? (
                        <EvidenceLink
                          employeeId={employeeId}
                          documents={documentRefs}
                          documentId={g.documentId}
                          onLinked={() => router.refresh()}
                          target={{ groupId: g.id }}
                          compact
                        />
                      ) : (
                        <EvidenceView documents={documentRefs} documentId={g.documentId} />
                      )}
                      {allowEdit ? (
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setExamCreatePreset(null);
                              setGroupEdit(g);
                              setExamOpen(true);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="px-2"
                            onClick={async () => {
                              if (!confirm("Remove this sitting and all subjects?")) return;
                              const res = await deleteQualificationGroupAction({ employeeId, groupId: g.id });
                              if (res.success) {
                                notifySuccess(res.message);
                                router.refresh();
                              } else notifyError(res.message);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <ul className="border-border divide-y divide-border rounded-lg border text-sm">
                    {g.subjects.map((s) => (
                      <li key={s.id} className="flex flex-col gap-0.5 px-3 py-2">
                        <span className="font-medium">{s.subjectName}</span>
                        <span className="text-muted-foreground text-xs">
                          {[s.gradeResult && `Grade: ${s.gradeResult}`, s.levelOrUnit, s.remarks]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }

            const q = entry.row;
            return (
              <div key={q.id} className={cn(panel, "space-y-3 p-4")}>
                <div className="flex justify-between gap-2">
                  <div>
                    <p className="text-muted-foreground text-xs">{displayQualificationType(q)}</p>
                    <p className="font-semibold">{q.title}</p>
                    {q.fieldOfStudy ? (
                      <p className="text-muted-foreground text-sm">{q.fieldOfStudy}</p>
                    ) : null}
                  </div>
                </div>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Institution / Awarding body</dt>
                    <dd className="text-right">{formatInstitutionAwarding(q.institution, q.awardingBody)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Grade / Result</dt>
                    <dd className="text-right">{formatStandaloneGradeDisplay(q)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Dates</dt>
                    <dd className="text-right tabular-nums">{formatStandaloneDates(q)}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
                  {allowEdit ? (
                    <EvidenceLink
                      employeeId={employeeId}
                      documents={documentRefs}
                      documentId={q.documentId}
                      onLinked={() => router.refresh()}
                      target={{ qualificationId: q.id }}
                      compact
                    />
                  ) : (
                    <EvidenceView documents={documentRefs} documentId={q.documentId} />
                  )}
                  {allowEdit ? (
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setStandaloneEdit(q);
                          setStandaloneCreateKind(null);
                          setStandaloneOpen(true);
                        }}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="px-2"
                        onClick={async () => {
                          if (!confirm("Remove this qualification?")) return;
                          const res = await deleteStandaloneQualificationAction({
                            employeeId,
                            qualificationId: q.id,
                          });
                          if (res.success) {
                            notifySuccess(res.message);
                            router.refresh();
                          } else notifyError(res.message);
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      <ExamSittingDialog
        open={examOpen}
        onOpenChange={(o) => {
          if (!o) {
            setExamOpen(false);
            setGroupEdit(null);
            setExamCreatePreset(null);
          }
        }}
        groupEdit={groupEdit}
        createPreset={examDialogPreset}
        createKindLabel={examCreatePreset ? REGISTER_MENU_SECTIONS.flatMap((s) => s.items).find((i) => i.kind === examCreatePreset.kind)?.label : undefined}
        documents={documentRefs}
        onSave={onSaveGroup}
      />

      {cxcCsecBatchKind ? (
        <CxcCsecBatchQualificationsDialog
          open={cxcCsecBatchOpen}
          onOpenChange={(o) => {
            if (!o) {
              setCxcCsecBatchOpen(false);
              setCxcCsecBatchKind(null);
            }
          }}
          employeeId={employeeId}
          kind={cxcCsecBatchKind}
          onSuccess={() => {
            setCxcCsecBatchOpen(false);
            setCxcCsecBatchKind(null);
            router.refresh();
          }}
        />
      ) : null}

      <StandaloneRegisterDialog
        open={standaloneOpen}
        onOpenChange={(o) => {
          if (!o) {
            setStandaloneOpen(false);
            setStandaloneEdit(null);
            setStandaloneCreateKind(null);
          }
        }}
        employeeId={employeeId}
        documents={documentRefs}
        createKind={standaloneCreateKind}
        editRow={standaloneEdit}
        onSubmit={submitStandalonePayload}
      />
    </div>
  );
}

function formatStandaloneDates(q: StandaloneQualificationRow): string {
  const parts: string[] = [];
  if (q.dateAwarded) {
    const d = q.dateAwarded;
    parts.push(/^\d{4}-01-01$/.test(d) ? d.slice(0, 4) : d);
  }
  if (q.hasExpiry && q.expiryDate) parts.push(`Expires ${q.expiryDate}`);
  return parts.length ? parts.join(" · ") : "—";
}

function displayQualificationType(q: StandaloneQualificationRow): string {
  if (q.qualificationType === "cxc") return "CXC";
  if (q.qualificationType === "csec") return "CSEC";
  if (q.qualificationType === "doctorate_phd") return "PhD / Doctorate";
  return q.qualificationTypeLabel;
}

function yearFromDateString(value: string | null | undefined): number {
  if (!value) return 0;
  const y = Number(value.slice(0, 4));
  return Number.isFinite(y) ? y : 0;
}

function getQualificationRank(qualificationType: string): number {
  const map: Record<string, number> = {
    doctorate_phd: 100,
    masters_degree: 90,
    bachelors_degree: 80,
    associate_degree: 70,
    cape: 60,
    gce_a_level: 55,
    cxc_associate_degree: 50,
    cvq: 45,
    csec: 40,
    cxc: 38,
    gce_o_level: 35,
    vocational_certification: 30,
    attendance_certificate: 20,
    certificate_of_attendance: 20,
    participation_certificate: 18,
    certificate_of_participation: 18,
    custom_qualification: 10,
    custom_other: 10,
    other: 5,
  };
  return map[qualificationType] ?? 5;
}

function getQualificationRankForStandalone(q: StandaloneQualificationRow): number {
  return getQualificationRank(q.qualificationType);
}

function getQualificationRankForGroup(g: QualificationGroupRow): number {
  if (g.qualificationSystem === "CAPE") return getQualificationRank("cape");
  if (g.qualificationSystem === "GCE") {
    if (g.level === "A_LEVEL") return getQualificationRank("gce_a_level");
    if (g.level === "O_LEVEL") return getQualificationRank("gce_o_level");
    return getQualificationRank("gce_o_level");
  }
  if (g.qualificationSystem === "CXC_CSEC") return getQualificationRank("csec");
  return 5;
}

function stripStartDateFromNotes(notes: string | null | undefined): string {
  if (!notes) return "";
  return notes.replace(/^Start year:\s*\d{4}\s*\n?/m, "").trim();
}

function EvidenceView({
  documents,
  documentId,
}: {
  documents: EmployeeQualificationsBundle["documents"];
  documentId: string | null;
}) {
  if (!documentId) return <span className="text-muted-foreground text-xs">—</span>;
  const d = documents.find((x) => x.id === documentId);
  if (!d?.fileUrl) return <span className="text-xs text-muted-foreground">On file</span>;
  return (
    <a
      href={d.fileUrl}
      target="_blank"
      rel="noreferrer"
      className="text-primary text-xs font-medium underline underline-offset-2"
    >
      View
    </a>
  );
}

function EvidenceLink({
  employeeId,
  documents,
  documentId,
  onLinked,
  target,
  compact,
}: {
  employeeId: string;
  documents: EmployeeQualificationsBundle["documents"];
  documentId: string | null;
  onLinked: () => void;
  target: { qualificationId?: string; groupId?: string };
  compact?: boolean;
}) {
  return (
    <form
      className={cn("flex gap-1", compact ? "flex-col" : "flex-col sm:flex-row sm:items-center")}
      action={async (formData) => {
        const docId = (formData.get("documentId") as string) || null;
        const res = await linkQualificationEvidenceAction({
          employeeId,
          qualificationId: target.qualificationId,
          groupId: target.groupId,
          documentId: docId,
        });
        if (res.success) {
          notifySuccess(res.message);
          onLinked();
        } else notifyError(res.message);
      }}
    >
      <select
        name="documentId"
        defaultValue={documentId ?? ""}
        className="border-input h-9 max-w-[11rem] rounded-md border bg-background px-2 text-xs"
      >
        <option value="">No evidence</option>
        {documents.map((d) => (
          <option key={d.id} value={d.id}>
            {d.documentName}
          </option>
        ))}
      </select>
      <Button type="submit" variant="secondary" size="sm" className="h-8 text-xs shrink-0">
        Link
      </Button>
    </form>
  );
}

function ExamSittingDialog({
  open,
  onOpenChange,
  groupEdit,
  createPreset,
  createKindLabel,
  documents,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  groupEdit: QualificationGroupRow | null;
  createPreset: { qualificationSystem: (typeof QUALIFICATION_SYSTEMS)[number]; level: string } | null;
  createKindLabel?: string;
  documents: EmployeeQualificationsBundle["documents"];
  onSave: (form: FormData) => Promise<void>;
}) {
  const system = (groupEdit?.qualificationSystem ?? createPreset?.qualificationSystem ?? "CXC_CSEC") as (typeof QUALIFICATION_SYSTEMS)[number];
  const defaultLevel = groupEdit?.level ?? createPreset?.level ?? "";
  const isCape = system === "CAPE";
  const defaultSubjects =
    groupEdit?.subjects?.length ? groupEdit.subjects : [{ subjectName: "", gradeResult: "", levelOrUnit: "", remarks: "" }];

  const title =
    groupEdit?.id != null
      ? `Edit ${displayExamGroupType(groupEdit)} sitting`
      : createKindLabel
        ? `Add ${createKindLabel}`
        : `Add ${QUALIFICATION_SYSTEM_LABEL[system] ?? system} sitting`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,760px)] overflow-y-auto sm:max-w-lg">
        <form
          action={async (fd) => {
            await onSave(fd);
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <input type="hidden" name="qualificationSystem" value={system} />
          <div className="grid gap-3 py-4">
            <div className="space-y-2">
              <Label>Year</Label>
              <Input
                type="number"
                name="sittingYear"
                required
                defaultValue={groupEdit?.sittingYear ?? new Date().getFullYear()}
              />
            </div>
            <div className="space-y-2">
              <Label>School / Institution</Label>
              <Input name="institution" defaultValue={groupEdit?.institution ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Awarding body</Label>
              <Input name="awardingBody" defaultValue={groupEdit?.awardingBody ?? ""} />
            </div>
            {system === "GCE" ? (
              <div className="space-y-2">
                <Label>Level</Label>
                <select
                  name="level"
                  className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                  defaultValue={defaultLevel || "O_LEVEL"}
                >
                  {GCE_LEVELS.map((l) => (
                    <option key={l} value={l}>
                      {GCE_LEVEL_LABEL[l]}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="level" value="" />
            )}
            <div className="space-y-2">
              <Label>Evidence (existing document)</Label>
              <select
                name="documentId"
                className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                defaultValue={groupEdit?.documentId ?? ""}
              >
                <option value="">None</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.documentName}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={groupEdit?.notes ?? ""} />
            </div>
            <div className="space-y-2">
              <Label>Subjects</Label>
              <SubjectRows
                key={groupEdit?.id ?? `new-${system}-${createPreset?.level ?? ""}`}
                defaultSubjects={defaultSubjects}
                unitPlaceholder={isCape ? "Unit 1 / Unit 2 / Full" : "Level / unit (optional)"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SubjectRows({
  defaultSubjects,
  unitPlaceholder,
}: {
  defaultSubjects: Array<{
    subjectName: string;
    gradeResult?: string | null;
    levelOrUnit?: string | null;
    remarks?: string | null;
  }>;
  unitPlaceholder?: string;
}) {
  const [rows, setRows] = useState(
    defaultSubjects.map((s) => ({
      subjectName: s.subjectName,
      gradeResult: s.gradeResult ?? "",
      levelOrUnit: s.levelOrUnit ?? "",
      remarks: s.remarks ?? "",
    })),
  );

  return (
    <div className="space-y-2">
      {rows.map((row, i) => (
        <div key={i} className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
          <Input
            placeholder="Subject"
            name="subjectName"
            value={row.subjectName}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], subjectName: e.target.value };
              setRows(next);
            }}
          />
          <Input
            placeholder="Grade"
            name="gradeResult"
            value={row.gradeResult}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], gradeResult: e.target.value };
              setRows(next);
            }}
          />
          <Input
            placeholder={unitPlaceholder ?? "Level / unit"}
            name="levelOrUnit"
            value={row.levelOrUnit}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], levelOrUnit: e.target.value };
              setRows(next);
            }}
          />
          <Input
            placeholder="Notes"
            name="remarks"
            value={row.remarks}
            onChange={(e) => {
              const next = [...rows];
              next[i] = { ...next[i], remarks: e.target.value };
              setRows(next);
            }}
          />
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() =>
          setRows([...rows, { subjectName: "", gradeResult: "", levelOrUnit: "", remarks: "" }])
        }
      >
        <Plus className="size-4" />
        Add another subject
      </Button>
    </div>
  );
}

function standaloneCategoryType(kind: RegisterStandaloneKind): { category: string; qualificationType: string } {
  switch (kind) {
    case "cxc":
      return { category: "academic", qualificationType: "cxc" };
    case "csec":
      return { category: "academic", qualificationType: "csec" };
    case "associate_degree":
      return { category: "academic", qualificationType: "associate_degree" };
    case "bachelors_degree":
      return { category: "academic", qualificationType: "bachelors_degree" };
    case "masters_degree":
      return { category: "academic", qualificationType: "masters_degree" };
    case "doctorate_phd":
      return { category: "academic", qualificationType: "doctorate_phd" };
  }
}

function degreeLabelForKind(kind: RegisterStandaloneKind): string {
  if (kind === "associate_degree") return "Associate Degree";
  if (kind === "bachelors_degree") return "Bachelor’s Degree";
  if (kind === "masters_degree") return "Master’s Degree";
  if (kind === "doctorate_phd") return "PhD / Doctorate";
  return "Degree";
}

type CxcCsecBatchRow = { key: string; subject: string; grade: string };

function CxcCsecBatchQualificationsDialog({
  open,
  onOpenChange,
  employeeId,
  kind,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  kind: "cxc" | "csec";
  onSuccess: () => void;
}) {
  const [rows, setRows] = useState<CxcCsecBatchRow[]>([]);

  useEffect(() => {
    if (open) {
      setRows([{ key: newQualificationBatchRowKey(), subject: "", grade: "" }]);
    } else {
      setRows([]);
    }
  }, [open]);

  function addRow() {
    setRows((prev) => [...prev, { key: newQualificationBatchRowKey(), subject: "", grade: "" }]);
  }

  function removeRow(key: string) {
    setRows((prev) => (prev.length <= 1 ? prev : prev.filter((r) => r.key !== key)));
  }

  function updateRow(key: string, patch: Partial<Pick<CxcCsecBatchRow, "subject" | "grade">>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  async function handleSaveQualifications() {
    const trimmed = rows.map((row) => ({
      subject: row.subject.trim(),
      grade: row.grade.trim(),
    }));

    if (trimmed.length < 1) {
      notifyError("Please select a subject and grade for each row.");
      return;
    }

    for (const row of trimmed) {
      if (
        !row.subject ||
        !row.grade ||
        !CXC_CSEC_GRADE_OPTIONS.includes(row.grade as CxcCsecGrade)
      ) {
        notifyError("Please select a subject and grade for each row.");
        return;
      }
      if (!CXC_CSEC_SUBJECT_SET.has(row.subject)) {
        notifyError("Please select a subject and grade for each row.");
        return;
      }
    }

    const subjects = trimmed.map((r) => r.subject);
    if (new Set(subjects).size !== subjects.length) {
      notifyError("Duplicate subjects are not allowed in the same qualification entry.");
      return;
    }

    try {
      const res = await saveCxcCsecQualificationsBatchAction({
        employeeId,
        qualificationType: kind,
        rows: trimmed.map((r) => ({
          subject: r.subject,
          qualificationTitle: r.subject,
          grade: r.grade,
        })),
      });
      if (res.success) {
        notifySuccess(res.message);
        onSuccess();
      } else {
        notifyError(res.message);
      }
    } catch {
      notifyError("Failed to save qualifications. Please check the required fields.");
    }
  }

  const title = kind === "cxc" ? "Add CXC Qualifications" : "Add CSEC Qualifications";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,800px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <p className="text-muted-foreground pt-1 text-sm">Add one or more subjects and grades.</p>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          {rows.map((row, index) => (
            <div
              key={row.key}
              className="border-border bg-muted/20 grid gap-3 rounded-lg border p-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              <div className="space-y-1.5">
                <Label className="text-xs">Subject</Label>
                <select
                  className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                  value={row.subject}
                  onChange={(e) => updateRow(row.key, { subject: e.target.value })}
                  aria-label={`Subject row ${index + 1}`}
                >
                  <option value="">Select subject</option>
                  {CXC_CSEC_SUBJECT_OPTIONS.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Grade</Label>
                <select
                  className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                  value={row.grade}
                  onChange={(e) => updateRow(row.key, { grade: e.target.value })}
                  aria-label={`Grade row ${index + 1}`}
                >
                  <option value="">Select grade</option>
                  {CXC_CSEC_GRADE_OPTIONS.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end sm:justify-center sm:pb-0.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1 px-2"
                  disabled={rows.length <= 1}
                  onClick={() => removeRow(row.key)}
                  aria-label={`Remove row ${index + 1}`}
                >
                  <Trash2 className="size-4" />
                  Remove
                </Button>
              </div>
            </div>
          ))}

          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={addRow}>
            <Plus className="mr-2 size-4" />
            Add Another Subject
          </Button>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSaveQualifications}>
            Save Qualifications
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StandaloneRegisterDialog({
  open,
  onOpenChange,
  employeeId,
  documents,
  createKind,
  editRow,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  employeeId: string;
  documents: EmployeeQualificationsBundle["documents"];
  createKind: RegisterStandaloneKind | null;
  editRow: StandaloneQualificationRow | null;
  onSubmit: (payload: Parameters<typeof saveStandaloneQualificationAction>[0]) => Promise<void>;
}) {
  const effectiveKind = editRow ? inferStandaloneRegisterKind(editRow) : createKind ?? "associate_degree";
  const isCxcCsec = effectiveKind === "cxc" || effectiveKind === "csec";
  const isDegree =
    effectiveKind === "associate_degree" ||
    effectiveKind === "bachelors_degree" ||
    effectiveKind === "masters_degree" ||
    effectiveKind === "doctorate_phd";

  const createLabel =
    createKind && !editRow
      ? QUALIFICATION_TYPE_LABEL[standaloneCategoryType(createKind).qualificationType]
      : null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);

    let category: string;
    let qualificationType: string;
    if (editRow) {
      category = editRow.category;
      qualificationType = editRow.qualificationType;
    } else if (createKind) {
      const st = standaloneCategoryType(createKind);
      category = st.category;
      qualificationType = st.qualificationType;
    } else {
      category = "academic";
      qualificationType = "associate_degree";
    }

    if (isCxcCsec && !editRow) return;

    const rawNotes = String(fd.get("notes") ?? "").trim();
    const notesForPayload = rawNotes.length > 0 ? rawNotes : undefined;
    const selectedSubject = String(fd.get("subject") ?? "").trim();
    const degreeField = String(fd.get("fieldOfStudy") ?? "").trim();
    const institutionStr = String(fd.get("institution") ?? "").trim();
    const awardedYear = String(fd.get("year") ?? "").trim();
    const currentYearPlusOne = new Date().getFullYear() + 1;
    const gradeRaw = String(fd.get("gradeResult") ?? "").trim();
    if (isCxcCsec) {
      if (!selectedSubject) {
        notifyError("Subject is required.");
        return;
      }
      if (!gradeRaw) {
        notifyError("Grade is required.");
        return;
      }
      if (!CXC_CSEC_GRADE_OPTIONS.includes(gradeRaw as CxcCsecGrade)) {
        notifyError("Grade must be I, II, or III.");
        return;
      }
    }
    let degreeYearNum = NaN;
    if (isDegree) {
      if (!degreeField.trim() || !institutionStr.trim()) {
        notifyError("Please complete Degree Type, Field / Area of Study, Institution, and Year.");
        return;
      }
      if (!/^\d{4}$/.test(awardedYear)) {
        notifyError("Please complete Degree Type, Field / Area of Study, Institution, and Year.");
        return;
      }
      degreeYearNum = Number(awardedYear);
      if (degreeYearNum < 1950 || degreeYearNum > currentYearPlusOne) {
        notifyError("Please complete Degree Type, Field / Area of Study, Institution, and Year.");
        return;
      }
    }

    if (isCxcCsec && editRow) {
      await onSubmit({
        id: editRow.id,
        employeeId,
        category,
        qualificationType,
        qualificationTitle: selectedSubject,
        awardingBody: "CXC",
        gradeResult: gradeRaw,
        hasExpiry: false,
        verificationStatus: editRow.verificationStatus ?? "not_required",
        status: editRow.status ?? "active",
        notes: notesForPayload,
        documentId: editRow.documentId ?? null,
      });
      return;
    }

    if (isDegree) {
      await onSubmit({
        ...(editRow?.id
          ? {
              id: editRow.id,
              documentId: editRow.documentId ?? null,
              verificationStatus: editRow.verificationStatus ?? "not_required",
              status: editRow.status ?? "active",
            }
          : {}),
        employeeId,
        qualificationType,
        fieldOfStudy: degreeField,
        institution: institutionStr,
        year: degreeYearNum,
        notes: rawNotes.length > 0 ? rawNotes : null,
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(92vh,800px)] overflow-y-auto sm:max-w-xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{editRow ? "Edit qualification" : `Add ${degreeLabelForKind(effectiveKind)}`}</DialogTitle>
            {createLabel ? (
              <p className="text-muted-foreground pt-1 text-sm">{createLabel}</p>
            ) : editRow ? (
              <p className="text-muted-foreground pt-1 text-sm">{editRow.qualificationTypeLabel}</p>
            ) : null}
          </DialogHeader>

          <div className="grid gap-3 py-4 sm:grid-cols-2">
            {isCxcCsec && editRow ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Subject</Label>
                  <select
                    name="subject"
                    required
                    className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                    defaultValue={editRow.title ?? ""}
                  >
                    <option value="" disabled>Select subject</option>
                    {CXC_CSEC_SUBJECT_OPTIONS.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Grade</Label>
                  <select
                    name="gradeResult"
                    required
                    className="border-input bg-background h-10 w-full rounded-md border px-2 text-sm"
                    defaultValue={(editRow.gradeResult as string) ?? ""}
                  >
                    <option value="" disabled>Select grade</option>
                    {CXC_CSEC_GRADE_OPTIONS.map((grade) => (
                      <option key={grade} value={grade}>
                        {grade}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            ) : null}

            {isDegree ? (
              <>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Degree type</Label>
                  <Input value={degreeLabelForKind(effectiveKind)} readOnly />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Field / Area of Study</Label>
                  <Input name="fieldOfStudy" required defaultValue={editRow?.fieldOfStudy ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Institution</Label>
                  <Input name="institution" required defaultValue={editRow?.institution ?? ""} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Year</Label>
                  <Input
                    type="number"
                    name="year"
                    min={1950}
                    max={new Date().getFullYear() + 1}
                    required
                    defaultValue={editRow?.dateAwarded?.slice(0, 4) ?? ""}
                  />
                </div>
              </>
            ) : null}

            <div className="space-y-2 sm:col-span-2">
              <Label>Notes</Label>
              <Input name="notes" defaultValue={stripStartDateFromNotes(editRow?.notes)} />
            </div>

            <input type="hidden" name="verificationStatus" value={editRow?.verificationStatus ?? "not_required"} />
            <input type="hidden" name="status" value={editRow?.status ?? "active"} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
