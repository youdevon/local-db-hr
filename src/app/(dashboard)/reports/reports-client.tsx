"use client";

import { useMemo, useState, useTransition } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { BarChart3, Download, Printer, Search } from "lucide-react";

import { logReportExportAction, runReportAction } from "./actions";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmployeeCombobox } from "@/components/employee-combobox";
import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/data-table";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { ReportDefinition, ReportResult } from "@/lib/reports/report-definitions";
import { cn } from "@/lib/utils";

type ReportsClientProps = {
  categories: Array<{ id: string; label: string }>;
  reports: ReportDefinition[];
  filterOptions: {
    employees: Array<{ label: string; value: string; fullName: string; fileNumber: string; searchText: string }>;
    departments: Array<{ label: string; value: string }>;
    positions: Array<{ label: string; value: string }>;
    nationalities: Array<{ label: string; value: string }>;
    genders: Array<{ label: string; value: string }>;
    contractStatuses: Array<{ label: string; value: string }>;
    leaveTypes: Array<{ label: string; value: string }>;
    leaveStatuses: Array<{ label: string; value: string }>;
    roles: Array<{ label: string; value: string }>;
    linkedEmployeeStatuses: Array<{ label: string; value: string }>;
    successOptions: Array<{ label: string; value: string }>;
    auditTypes: Array<{ label: string; value: string }>;
    auditModules: Array<{ label: string; value: string }>;
    ageConditions: Array<{ label: string; value: string }>;
  };
  canExport: boolean;
  requireExportReason: boolean;
  includeExportMetadata: boolean;
};

type FilterMap = Record<string, string>;

function defaultsFor(report: ReportDefinition): FilterMap {
  const next: FilterMap = {};
  for (const filter of report.filters) {
    next[filter.key] = filter.defaultValue ?? "";
  }
  return next;
}

function isAllOrEmpty(value: string): boolean {
  return !value || value.toLowerCase() === "all";
}

function validateFilters(report: ReportDefinition, filters: FilterMap): string[] {
  const errors: string[] = [];
  for (const key of report.requiredFilters) {
    if (isAllOrEmpty(filters[key] ?? "")) errors.push(`${key}:required`);
  }

  const ageCondition = (filters.ageCondition || "all").toLowerCase();
  const ageValue = filters.ageValue || "";
  const ageFrom = filters.ageFrom || "";
  const ageTo = filters.ageTo || "";
  const numericAgeValue = ageValue ? Number(ageValue) : null;
  const numericAgeFrom = ageFrom ? Number(ageFrom) : null;
  const numericAgeTo = ageTo ? Number(ageTo) : null;

  if (!isAllOrEmpty(ageCondition)) {
    if (ageCondition === "between") {
      if (!ageFrom) errors.push("ageFrom:required");
      if (!ageTo) errors.push("ageTo:required");
      if (numericAgeFrom !== null && numericAgeTo !== null && numericAgeFrom > numericAgeTo) {
        errors.push("Age From cannot be greater than Age To.");
      }
    } else if (!["all"].includes(ageCondition)) {
      if (!ageValue) errors.push("ageValue:required");
    }
  }
  if (ageValue && (!Number.isFinite(numericAgeValue) || (numericAgeValue ?? 0) <= 0)) errors.push("Age Value must be a valid positive number.");
  if (ageFrom && (!Number.isFinite(numericAgeFrom) || (numericAgeFrom ?? 0) <= 0)) errors.push("Age From must be a valid positive number.");
  if (ageTo && (!Number.isFinite(numericAgeTo) || (numericAgeTo ?? 0) <= 0)) errors.push("Age To must be a valid positive number.");

  const datePairs: Array<{ from: string; to: string; label: string }> = [
    { from: filters.startDateFrom || "", to: filters.startDateTo || "", label: "Start Date" },
    { from: filters.endDateFrom || "", to: filters.endDateTo || "", label: "End Date" },
    { from: filters.dateFrom || "", to: filters.dateTo || "", label: "Date" },
  ];
  for (const pair of datePairs) {
    if (pair.from && pair.to && pair.from > pair.to) {
      errors.push(`${pair.label} From cannot be after ${pair.label} To.`);
    }
  }
  return errors;
}

function requiredForFilter(report: ReportDefinition, key: string, filters: FilterMap): boolean {
  if (report.requiredFilters.includes(key)) return true;
  const ageCondition = (filters.ageCondition || "all").toLowerCase();
  if (ageCondition === "between") return key === "ageFrom" || key === "ageTo";
  if (!isAllOrEmpty(ageCondition) && ageCondition !== "between") return key === "ageValue";
  return false;
}

export function ReportsClient({
  categories,
  reports,
  filterOptions,
  canExport,
  requireExportReason,
  includeExportMetadata,
}: ReportsClientProps) {
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "employee");
  const reportsByCategory = useMemo(() => reports.filter((item) => item.category === categoryId), [reports, categoryId]);
  const [reportType, setReportType] = useState(reportsByCategory[0]?.id ?? reports[0]?.id ?? "");
  const selectedReport = useMemo(() => reports.find((item) => item.id === reportType) ?? reports[0], [reportType, reports]);
  const [filters, setFilters] = useState<FilterMap>(selectedReport ? defaultsFor(selectedReport) : {});
  const [result, setResult] = useState<ReportResult | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filterErrorSet = useMemo(() => new Set(validationErrors.filter((item) => item.includes(":required")).map((item) => item.split(":")[0])), [validationErrors]);
  const blockRun = validationErrors.length > 0 || isPending || !selectedReport;

  function changeCategory(nextCategory: string) {
    setCategoryId(nextCategory);
    const firstReport = reports.find((item) => item.category === nextCategory);
    if (!firstReport) return;
    setReportType(firstReport.id);
    setFilters(defaultsFor(firstReport));
    setResult(null);
    setValidationErrors([]);
  }

  function changeReport(nextReportType: string) {
    const report = reports.find((item) => item.id === nextReportType);
    if (!report) return;
    setReportType(report.id);
    setFilters(defaultsFor(report));
    setResult(null);
    setValidationErrors([]);
  }

  function updateFilter(key: string, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value ?? "" }));
  }

  function runReport() {
    if (!selectedReport) return;
    const errors = validateFilters(selectedReport, filters);
    setValidationErrors(errors);
    if (errors.length > 0) {
      notifyError("Complete the required fields to run this report.");
      return;
    }
    startTransition(async () => {
      try {
        const payload = await runReportAction(selectedReport.id, filters);
        setResult(payload);
      } catch {
        notifyError("Failed to run report. Please review your filters and try again.");
      }
    });
  }

  async function exportExcel() {
    if (!result) return;
    let exportReason: string | undefined;
    if (requireExportReason) {
      const reason = window.prompt("Export reason is required. Please enter a reason:");
      if (!reason || !reason.trim()) {
        notifyError("Export reason is required.");
        return;
      }
      exportReason = reason.trim();
    }
    setIsExporting(true);
    try {
      await logReportExportAction(selectedReport.id, exportReason);
      const XLSX = await import("xlsx");
      const worksheetRows = result.rows.length ? result.rows : [{ Notice: "No records found for the selected filters." }];
      const ws = XLSX.utils.json_to_sheet(worksheetRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      const dateStamp = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `${selectedReport.id}-${dateStamp}.xlsx`);
      notifySuccess("Report exported successfully.");
    } catch {
      notifyError("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }

  function printReport() {
    window.print();
  }

  const columns = useMemo<ColumnDef<Record<string, string | number>>[]>(() => {
    if (!result) return [];
    return result.columns.map((column) => ({
      accessorKey: column.key,
      enableSorting: column.sortable !== false,
      header: ({ column: tableColumn }) => <DataTableColumnHeader column={tableColumn} title={column.label} />,
      cell: ({ row }) => {
        const value = row.getValue(column.key) as string | number | undefined;
        return <span>{value === "" || value === undefined ? "—" : String(value)}</span>;
      },
    }));
  }, [result]);

  return (
    <PageContainer className="space-y-6">
      <PageHeader
        breadcrumbItems={[{ label: "Dashboard", href: "/" }, { label: "Reports" }]}
        title="Reports"
        icon="bar-chart-3"
        description="Filter, preview, print, and export HR data across the system."
      />

      <SectionCard title="Report Selection">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-medium">Report Category</span>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={categoryId}
              onChange={(event) => changeCategory(event.target.value)}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm font-medium">Report Type</span>
            <select
              className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              value={selectedReport?.id ?? ""}
              onChange={(event) => changeReport(event.target.value)}
            >
              {reportsByCategory.map((report) => (
                <option key={report.id} value={report.id}>
                  {report.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </SectionCard>

      <SectionCard title="Required Fields / Guidance">
        <ul className="text-muted-foreground space-y-1 text-sm">
          {(selectedReport?.guidance ?? []).map((line) => (
            <li key={line}>- {line}</li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title="Filters">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {(selectedReport?.filters ?? []).map((filter) => {
            const isRequired = requiredForFilter(selectedReport, filter.key, filters);
            const hasError = filterErrorSet.has(filter.key);
            const label = (
              <span className="text-sm font-medium">
                {filter.label}
                {isRequired ? <span className="ml-1 text-amber-500">*</span> : null}
              </span>
            );
            const helper = hasError ? <p className="text-xs text-amber-600">Required for this report.</p> : null;
            if (filter.type === "employee") {
              return (
                <label key={filter.key} className="space-y-2">
                  {label}
                  <div className={cn(hasError ? "ring-amber-500/50 rounded-md ring-1" : "")}>
                    <EmployeeCombobox options={filterOptions.employees} value={filters[filter.key] ?? ""} onChange={(value) => updateFilter(filter.key, value)} />
                  </div>
                  {helper}
                </label>
              );
            }
            if (filter.type === "select") {
              const options =
                filter.key === "department"
                  ? filterOptions.departments
                  : filter.key === "position"
                    ? filterOptions.positions
                    : filter.key === "nationality"
                      ? filterOptions.nationalities
                      : filter.key === "gender"
                        ? filterOptions.genders
                        : filter.key === "contractStatus"
                          ? filterOptions.contractStatuses
                          : filter.key === "leaveType"
                            ? filterOptions.leaveTypes
                            : filter.key === "leaveStatus"
                              ? filterOptions.leaveStatuses
                              : filter.key === "role"
                                ? filterOptions.roles
                                : filter.key === "linkedEmployeeStatus"
                                  ? filterOptions.linkedEmployeeStatuses
                                  : filter.key === "success"
                                    ? filterOptions.successOptions
                                    : filter.key === "auditType"
                                      ? filterOptions.auditTypes
                                      : filter.key === "module"
                                        ? filterOptions.auditModules
                                        : filter.key === "ageCondition"
                                          ? filterOptions.ageConditions
                                          : [];
              return (
                <label key={filter.key} className="space-y-2">
                  {label}
                  <select
                    className={cn("border-input bg-background h-10 w-full rounded-md border px-3 text-sm", hasError ? "border-amber-500" : "")}
                    value={filters[filter.key] ?? filter.defaultValue ?? ""}
                    onChange={(event) => updateFilter(filter.key, event.target.value)}
                  >
                    <option value="">All</option>
                    {options.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {helper}
                </label>
              );
            }
            return (
              <label key={filter.key} className="space-y-2">
                {label}
                <Input
                  type={filter.type === "number" ? "number" : filter.type === "date" ? "date" : "text"}
                  className={cn("h-10 rounded-md", hasError ? "border-amber-500" : "")}
                  value={filters[filter.key] ?? ""}
                  onChange={(event) => updateFilter(filter.key, event.target.value)}
                />
                {helper}
              </label>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard
        title="Results Preview"
        headerActions={
          <div className="no-print flex flex-wrap gap-2">
            <Button onClick={runReport} disabled={blockRun} className="h-10 rounded-md">
              <Search className="mr-2 h-4 w-4" />
              {isPending ? "Running..." : "Run Report"}
            </Button>
            <Button onClick={exportExcel} disabled={!result || !canExport || isExporting} variant="outline" className="h-10 rounded-md">
              <Download className="mr-2 h-4 w-4" />
              {isExporting ? "Exporting..." : "Export Excel"}
            </Button>
            <Button onClick={printReport} disabled={!result} variant="outline" className="h-10 rounded-md">
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
          </div>
        }
      >
        {blockRun ? (
          <p className="no-print text-muted-foreground mb-3 text-xs">Complete the required fields to run this report.</p>
        ) : null}
        {validationErrors.filter((item) => !item.includes(":required")).map((item) => (
          <p key={item} className="no-print mb-2 text-xs text-amber-600">
            {item}
          </p>
        ))}
        {!result ? (
          <EmptyState title="No report preview yet" description="Select a report and run it to preview results." icon={BarChart3} />
        ) : result.rows.length === 0 ? (
          <EmptyState title="No records found" description="No rows match the selected filters." icon={BarChart3} />
        ) : (
          <div id="printable-report" className="space-y-4">
            <p className="text-muted-foreground text-xs">
              Preview shows first {result.previewLimit} matching rows. Total matching rows: {result.totalMatchingRows}.
            </p>
            <div className="print-only hidden space-y-1">
              <h2 className="font-heading text-lg font-bold tracking-tight">{result.title}</h2>
              {includeExportMetadata ? <p className="text-sm">Generated: {result.generatedAt}</p> : null}
              <p className="text-sm">
                Filters:{" "}
                {Object.entries(result.filtersApplied)
                  .filter(([, value]) => !!value)
                  .map(([key, value]) => `${key}: ${value}`)
                  .join(" | ") || "None"}
              </p>
            </div>
            <DataTable columns={columns} data={result.rows} />
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
    </PageContainer>
  );
}
