"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NotebookPen, Search } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import {
  getNoteStatusTone,
  NOTE_STATUS_OPTIONS,
  NOTE_TYPE_OPTIONS,
} from "@/lib/note-monitor/constants";
import type { NoteMonitorListRow } from "@/lib/server/note-monitor";
import { cn } from "@/lib/utils";

function formatDisplayDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type NoteMonitorFilters = {
  query: string;
  year: string;
  noteType: string;
  status: string;
};

type NoteMonitorClientProps = {
  rows: NoteMonitorListRow[];
  initialFilters: NoteMonitorFilters;
  canCreate: boolean;
  canExport: boolean;
};

function buildNoteMonitorHref(filters: NoteMonitorFilters): string {
  const params = new URLSearchParams();
  if (filters.query.trim()) params.set("q", filters.query.trim());
  if (filters.year.trim()) params.set("year", filters.year.trim());
  if (filters.noteType) params.set("noteType", filters.noteType);
  if (filters.status) params.set("status", filters.status);
  const suffix = params.toString();
  return suffix ? `/note-monitor?${suffix}` : "/note-monitor";
}

function filtersFromSearchParams(searchParams: URLSearchParams): NoteMonitorFilters {
  return {
    query: searchParams.get("q")?.trim() ?? "",
    year: searchParams.get("year")?.trim() ?? "",
    noteType: searchParams.get("noteType")?.trim() ?? "",
    status: searchParams.get("status")?.trim() ?? "",
  };
}

export function NoteMonitorClient({ rows, initialFilters, canCreate, canExport }: NoteMonitorClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialFilters.query);
  const [year, setYear] = useState(initialFilters.year);
  const [noteType, setNoteType] = useState(initialFilters.noteType);
  const [status, setStatus] = useState(initialFilters.status);
  const debouncedQuery = useDebouncedValue(query, 300);

  useEffect(() => {
    const nextHref = buildNoteMonitorHref({
      query: debouncedQuery,
      year,
      noteType,
      status,
    });
    const currentHref = buildNoteMonitorHref(filtersFromSearchParams(searchParams));
    if (nextHref !== currentHref) {
      router.replace(nextHref);
    }
  }, [debouncedQuery, year, noteType, status, router, searchParams]);

  const selectClass =
    "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Note Monitor" },
        ]}
        title="Note Monitor"
        icon="notebook-pen"
        description="Track Executive Council and Secretary note numbers before contracts are created."
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport ? (
              <Link
                href="/note-monitor/reports"
                className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}
              >
                Export / Reports
              </Link>
            ) : null}
            {canCreate ? (
              <Link href="/note-monitor/new" className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>
                Create New Note Number
              </Link>
            ) : null}
          </div>
        }
      />

      <div className="border-border bg-card space-y-4 rounded-xl border p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="h-10 rounded-md pl-9 text-sm"
              placeholder='Search by year, number, type, details, status, due date (e.g. "16 of 2022")'
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <Input
            type="number"
            className="h-10 rounded-md text-sm"
            placeholder="Note year"
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
          <select className={selectClass} value={noteType} onChange={(event) => setNoteType(event.target.value)}>
            <option value="">All note types</option>
            {NOTE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-3 lg:grid-cols-4">
          <select className={selectClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">All statuses</option>
            {NOTE_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap gap-2 lg:col-span-3">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-md"
              onClick={() => router.replace("/note-monitor")}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No note records found"
          description="Try adjusting your search filters or create a new note number."
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-xl border shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="bg-muted/40 border-b">
                <tr>
                  {[
                    "Note Year",
                    "Note Number",
                    "Note Type",
                    "Note Preparation Date",
                    "Details",
                    "Note Status",
                    "Due Date",
                  ].map((heading) => (
                    <th key={heading} className="text-muted-foreground px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={cn("hover:bg-muted/30 cursor-pointer border-b transition last:border-b-0")}
                    onClick={() => router.push(`/note-monitor/${row.id}`)}
                  >
                    <td className="px-4 py-3">{row.noteYear}</td>
                    <td className="px-4 py-3 font-medium">{row.displayReference}</td>
                    <td className="px-4 py-3">{row.noteTypeLabel}</td>
                    <td className="px-4 py-3">{formatDisplayDate(row.notePreparationDate)}</td>
                    <td className="max-w-xs truncate px-4 py-3">{row.details}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={getNoteStatusTone(row.status)}>{row.statusLabel}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">{formatDisplayDate(row.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
