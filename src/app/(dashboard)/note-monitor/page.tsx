import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { NoteMonitorClient } from "@/components/note-monitor/note-monitor-client";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { getSession } from "@/lib/get-session";
import { parseNoteSearchQuery, type NoteStatusValue, type NoteTypeValue } from "@/lib/note-monitor/constants";
import {
  canPerformAction,
  normalizeUserRole,
  VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE,
} from "@/lib/roles";
import { listNoteMonitorRecords } from "@/lib/server/note-monitor";

export const metadata: Metadata = {
  title: "Note Monitor",
};

export const dynamic = "force-dynamic";

type NoteMonitorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function readParam(value: string | string[] | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export default async function NoteMonitorPage({ searchParams }: NoteMonitorPageProps) {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!canPerformAction(role, "noteMonitor.view")) {
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const currentYear = new Date().getFullYear();
  const query = readParam(params.q);
  const parsedQuery = parseNoteSearchQuery(query);
  const noteType = readParam(params.noteType) as NoteTypeValue | "";
  const status = readParam(params.status) as NoteStatusValue | "";
  const yearParam = readParam(params.year);
  const hasUrlFilters = Boolean(query || noteType || status || yearParam);

  const yearFromParam = yearParam ? Number(yearParam) : undefined;
  const year =
    parsedQuery.noteYear ??
    (yearFromParam !== undefined && Number.isFinite(yearFromParam) ? yearFromParam : undefined) ??
    (hasUrlFilters ? undefined : currentYear);

  const rows = await listNoteMonitorRecords({
    year: Number.isFinite(year) ? year : undefined,
    noteType: noteType || undefined,
    status: status || undefined,
    query,
  });

  const filterYear =
    yearParam ||
    (parsedQuery.noteYear ? String(parsedQuery.noteYear) : "") ||
    (hasUrlFilters ? "" : String(currentYear));

  const urlFilterKey = `${query}|${yearParam}|${noteType}|${status}`;

  return (
    <>
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <Suspense fallback={null}>
        <NoteMonitorClient
          key={urlFilterKey}
          rows={rows}
          initialFilters={{
            query,
            year: filterYear,
            noteType,
            status,
          }}
          canCreate={canPerformAction(role, "noteMonitor.create")}
          canExport={canPerformAction(role, "noteMonitor.view")}
        />
      </Suspense>
    </>
  );
}
