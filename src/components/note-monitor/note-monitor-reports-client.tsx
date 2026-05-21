"use client";

import { useMemo, useState, useTransition } from "react";
import { Download, NotebookPen, Printer, Search } from "lucide-react";
import Link from "next/link";

import {
  exportNoteMonitorReportAction,
  previewNoteMonitorReportAction,
} from "@/actions/note-monitor-reports";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { downloadBase64File } from "@/lib/download-base64";
import {
  NOTE_STATUS_OPTIONS,
  NOTE_TYPE_OPTIONS,
  type NoteStatusValue,
  type NoteTypeValue,
} from "@/lib/note-monitor/constants";
import { notifyError, notifySuccess } from "@/lib/notify";
import type {
  NoteMonitorCreatorOption,
  NoteMonitorLinkedContractFilter,
  NoteMonitorReportFilters,
  NoteMonitorReportRow,
} from "@/lib/server/note-monitor-reports";
import { cn } from "@/lib/utils";

function formatDisplayDate(value: string): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

type NoteMonitorReportsClientProps = {
  initialYear: number;
  creators: NoteMonitorCreatorOption[];
};

type ReportFilters = {
  year: string;
  fromDate: string;
  toDate: string;
  noteType: string;
  status: string;
  search: string;
  createdBy: string;
  linkedToContract: NoteMonitorLinkedContractFilter;
  dueDateFrom: string;
  dueDateTo: string;
};

export function NoteMonitorReportsClient({ initialYear, creators }: NoteMonitorReportsClientProps) {
  const [filters, setFilters] = useState<ReportFilters>({
    year: String(initialYear),
    fromDate: "",
    toDate: "",
    noteType: "",
    status: "",
    search: "",
    createdBy: "",
    linkedToContract: "all",
    dueDateFrom: "",
    dueDateTo: "",
  });
  const [rows, setRows] = useState<NoteMonitorReportRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [hasPreview, setHasPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const selectClass =
    "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

  const createdByLabel = useMemo(
    () => creators.find((creator) => creator.value === filters.createdBy)?.label ?? "",
    [creators, filters.createdBy],
  );

  function buildFilterPayload(): NoteMonitorReportFilters {
    return {
      year: filters.year ? Number(filters.year) : initialYear,
      fromDate: filters.fromDate || undefined,
      toDate: filters.toDate || undefined,
      noteType: filters.noteType ? (filters.noteType as NoteTypeValue) : undefined,
      status: filters.status ? (filters.status as NoteStatusValue) : undefined,
      search: filters.search || undefined,
      createdBy: filters.createdBy || undefined,
      linkedToContract: filters.linkedToContract,
      dueDateFrom: filters.dueDateFrom || undefined,
      dueDateTo: filters.dueDateTo || undefined,
    };
  }

  function runPreview() {
    startTransition(async () => {
      try {
        const result = await previewNoteMonitorReportAction(buildFilterPayload());
        setValidationError(result.validationError);
        if (result.validationError) {
          notifyError(result.validationError);
          return;
        }
        setRows(result.rows);
        setTotalCount(result.totalCount);
        setHasPreview(true);
      } catch {
        notifyError("Failed to preview report. Please review your filters and try again.");
      }
    });
  }

  async function exportExcel() {
    if (validationError) {
      notifyError(validationError);
      return;
    }
    setIsExporting(true);
    try {
      const result = await exportNoteMonitorReportAction(buildFilterPayload());
      if (result.success !== true) {
        notifyError(result.message);
        return;
      }
      const contentBase64 = result.contentBase64?.trim();
      if (!contentBase64) {
        notifyError("Export did not return a valid file. Please try again.");
        return;
      }
      downloadBase64File(contentBase64, result.fileName, result.mimeType);
      notifySuccess(`Exported ${result.recordCount} note record${result.recordCount === 1 ? "" : "s"}.`);
    } catch {
      notifyError("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Note Monitor", href: "/note-monitor" },
          { label: "Reports" },
        ]}
        backFallbackHref="/note-monitor"
        title="Note Monitor Reports"
        icon="notebook-pen"
        description="Filter, preview, print, and export note records."
        actions={
          <Link href="/note-monitor" className={buttonVariants({ variant: "outline", className: "h-10 rounded-md" })}>
            Back to Note Monitor
          </Link>
        }
      />

      <SectionCard title="Filters">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-medium">Year</span>
            <Input
              type="number"
              className="h-10 rounded-md"
              value={filters.year}
              onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">From Date</span>
            <Input
              type="date"
              className={cn("h-10 rounded-md", validationError?.includes("From Date") ? "border-amber-500" : "")}
              value={filters.fromDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, fromDate: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">To Date</span>
            <Input
              type="date"
              className={cn("h-10 rounded-md", validationError?.includes("To Date") ? "border-amber-500" : "")}
              value={filters.toDate}
              onChange={(event) => setFilters((prev) => ({ ...prev, toDate: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Note Type</span>
            <select
              className={selectClass}
              value={filters.noteType}
              onChange={(event) => setFilters((prev) => ({ ...prev, noteType: event.target.value }))}
            >
              <option value="">All note types</option>
              {NOTE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Note Status</span>
            <select
              className={selectClass}
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <option value="">All statuses</option>
              {NOTE_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Linked to Contract</span>
            <select
              className={selectClass}
              value={filters.linkedToContract}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  linkedToContract: event.target.value as NoteMonitorLinkedContractFilter,
                }))
              }
            >
              <option value="all">All</option>
              <option value="linked">Linked</option>
              <option value="not_linked">Not Linked</option>
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Due Date From</span>
            <Input
              type="date"
              className="h-10 rounded-md"
              value={filters.dueDateFrom}
              onChange={(event) => setFilters((prev) => ({ ...prev, dueDateFrom: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Due Date To</span>
            <Input
              type="date"
              className="h-10 rounded-md"
              value={filters.dueDateTo}
              onChange={(event) => setFilters((prev) => ({ ...prev, dueDateTo: event.target.value }))}
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Created By</span>
            <select
              className={selectClass}
              value={filters.createdBy}
              onChange={(event) => setFilters((prev) => ({ ...prev, createdBy: event.target.value }))}
            >
              <option value="">All users</option>
              {creators.map((creator) => (
                <option key={creator.value} value={creator.value}>
                  {creator.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 md:col-span-2 lg:col-span-3">
            <span className="text-sm font-medium">Search</span>
            <Input
              className="h-10 rounded-md"
              placeholder='Search note number, details, type, or status (e.g. "16 of 2026")'
              value={filters.search}
              onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Results Preview"
        headerActions={
          <div className="no-print flex flex-wrap gap-2">
            <Button onClick={runPreview} disabled={isPending} className="h-10 rounded-md">
              <Search className="mr-2 h-4 w-4" />
              {isPending ? "Running..." : "Run Report"}
            </Button>
            <Button onClick={exportExcel} disabled={!hasPreview || isExporting} variant="outline" className="h-10 rounded-md">
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button onClick={printReport} disabled={!hasPreview || rows.length === 0} variant="outline" className="h-10 rounded-md">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        }
      >
        {validationError ? <p className="no-print mb-3 text-xs text-amber-600">{validationError}</p> : null}
        {!hasPreview ? (
          <EmptyState
            icon={NotebookPen}
            title="No report preview yet"
            description="Set your filters and run the report to preview matching note records."
          />
        ) : rows.length === 0 ? (
          <EmptyState icon={NotebookPen} title="No records found" description="No notes match the selected filters." />
        ) : (
          <div id="printable-note-monitor-report" className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Preview shows up to 100 matching rows. Total matching records: {totalCount}.
            </p>
            <div className="print-only hidden space-y-1">
              <h2 className="font-heading text-lg font-bold tracking-tight">Note Monitor Report</h2>
              <p className="text-sm">Year: {filters.year}</p>
              {filters.fromDate ? <p className="text-sm">From Date: {filters.fromDate}</p> : null}
              {filters.toDate ? <p className="text-sm">To Date: {filters.toDate}</p> : null}
              {createdByLabel ? <p className="text-sm">Created By: {createdByLabel}</p> : null}
              <p className="text-sm">Total matching records: {totalCount}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    {["Reference", "Type", "Preparation Date", "Details", "Status", "Due Date", "Linked Contracts"].map(
                      (heading) => (
                        <th
                          key={heading}
                          className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                        >
                          {heading}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.noteYear}-${row.noteNumber}-${row.displayReference}`} className="border-b last:border-b-0">
                      <td className="px-3 py-2 font-medium">{row.displayReference}</td>
                      <td className="px-3 py-2">{row.noteType}</td>
                      <td className="px-3 py-2">{formatDisplayDate(row.notePreparationDate)}</td>
                      <td className="max-w-xs truncate px-3 py-2">{row.details}</td>
                      <td className="px-3 py-2">{row.status}</td>
                      <td className="px-3 py-2">{formatDisplayDate(row.dueDate)}</td>
                      <td className="max-w-sm truncate px-3 py-2">{row.linkedContracts || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      <style jsx global>{`
        @media print {
          .no-print,
          nav,
          aside,
          header .shrink-0,
          .sidebar,
          .top-header {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
