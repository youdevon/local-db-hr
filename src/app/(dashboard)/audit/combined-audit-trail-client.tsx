"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportAuditTrailToExcel } from "@/lib/export-excel";
import { notifyError, notifySuccess } from "@/lib/notify";
import { compareDateIso, compareString } from "@/lib/sort-compare";
import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp, ChevronsUpDown, FileSearch } from "lucide-react";

export type CombinedAuditRow = {
  id: string;
  sourceType: "login" | "system";
  createdAt: string;
  createdAtIso: string;
  auditType: "Login" | "System";
  whoAttemptedIt: string;
  action: string;
  target: string;
  module: string;
  success: boolean;
  failureReason: string;
  ipAddress: string;
  deviceName: string;
};

type AuditFilters = {
  search: string;
  auditType: "all" | "login" | "system";
  module: string;
  success: "all" | "success" | "failed";
  dateFrom: string;
  dateTo: string;
};

const defaultFilters: AuditFilters = {
  search: "",
  auditType: "all",
  module: "all",
  success: "all",
  dateFrom: "",
  dateTo: "",
};

const AUDIT_TABLE_MIN_WIDTH = 1930;

function toDateOnly(value: string): string {
  if (!value) return "";
  return value.slice(0, 10);
}

type CombinedSortKey =
  | "createdAtIso"
  | "auditType"
  | "whoAttemptedIt"
  | "action"
  | "target"
  | "module"
  | "success"
  | "failureReason"
  | "ipAddress"
  | "deviceName";

function compareCombinedRows(
  a: CombinedAuditRow,
  b: CombinedAuditRow,
  key: CombinedSortKey,
): number {
  if (key === "createdAtIso") return compareDateIso(a.createdAtIso, b.createdAtIso);
  if (key === "success") return Number(a.success) - Number(b.success);
  const va = a[key];
  const vb = b[key];
  return compareString(va, vb);
}

function matchesSearch(row: CombinedAuditRow, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return [
    row.whoAttemptedIt,
    row.action,
    row.target,
    row.module,
    row.failureReason,
    row.ipAddress,
    row.deviceName,
  ]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

export function CombinedAuditTrailClient({ rows }: { rows: CombinedAuditRow[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState<AuditFilters>(defaultFilters);
  const [sortKey, setSortKey] = useState<CombinedSortKey | null>("createdAtIso");
  const [sortDir, setSortDir] = useState<"asc" | "desc" | null>("desc");
  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);
  const syncingRef = useRef<"top" | "table" | null>(null);

  const moduleOptions = useMemo(() => {
    const values = new Set<string>();
    rows.forEach((row) => {
      if (row.module?.trim()) values.add(row.module.trim());
    });
    return ["all", ...Array.from(values).sort((a, b) => a.localeCompare(b))];
  }, [rows]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) => {
        if (!matchesSearch(row, filters.search)) return false;
        if (filters.auditType !== "all" && row.sourceType !== filters.auditType) return false;
        if (filters.module !== "all" && row.module !== filters.module) return false;
        if (filters.success === "success" && !row.success) return false;
        if (filters.success === "failed" && row.success) return false;

        const rowDate = toDateOnly(row.createdAtIso);
        if (filters.dateFrom && rowDate && rowDate < filters.dateFrom) return false;
        if (filters.dateTo && rowDate && rowDate > filters.dateTo) return false;
        return true;
      }),
    [rows, filters],
  );

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return filteredRows;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const cmp = compareCombinedRows(a, b, sortKey);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [filteredRows, sortKey, sortDir]);

  function cycleSort(columnKey: CombinedSortKey) {
    if (sortKey !== columnKey) {
      setSortKey(columnKey);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortKey(null);
      setSortDir(null);
      return;
    }
    setSortDir("asc");
  }

  function auditAriaSort(columnKey: CombinedSortKey): "ascending" | "descending" | "none" {
    if (sortKey !== columnKey || !sortDir) return "none";
    return sortDir === "asc" ? "ascending" : "descending";
  }

  function auditSortIcon(columnKey: CombinedSortKey) {
    const active = sortKey === columnKey;
    const dir = active ? sortDir : false;
    if (dir === "asc") {
      return <ArrowUp className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />;
    }
    if (dir === "desc") {
      return <ArrowDown className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />;
    }
    return <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />;
  }

  function update<K extends keyof AuditFilters>(key: K, value: AuditFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  function handleExportExcel() {
    try {
      exportAuditTrailToExcel(
        filteredRows.map((row) => ({
          "Date / Time": row.createdAt || "—",
          "Audit Type": row.auditType || "—",
          "Who Attempted It": row.whoAttemptedIt || "Unknown",
          Action: row.action || "—",
          Target: row.target || "—",
          Module: row.module || "—",
          Success: row.success ? "Success" : "Failed",
          "Failure Reason": row.failureReason || "—",
          "IP Address": row.ipAddress || "—",
          "Device Name": row.deviceName || "—",
        })),
      );
      notifySuccess("Audit trail exported successfully.");
    } catch {
      notifyError("Failed to export audit trail. Please try again.");
    }
  }

  function openAuditDetail(row: CombinedAuditRow) {
    const href = row.sourceType === "login" ? `/audit/login/${row.id}` : `/audit/system/${row.id}`;
    router.push(href);
  }

  function syncScroll(source: "top" | "table") {
    const top = topScrollRef.current;
    const table = tableScrollRef.current;
    if (!top || !table) return;

    if (syncingRef.current && syncingRef.current !== source) {
      syncingRef.current = null;
      return;
    }

    syncingRef.current = source;

    if (source === "top" && table.scrollLeft !== top.scrollLeft) {
      table.scrollLeft = top.scrollLeft;
      return;
    }

    if (source === "table" && top.scrollLeft !== table.scrollLeft) {
      top.scrollLeft = table.scrollLeft;
      return;
    }

    syncingRef.current = null;
  }

  return (
    <SectionCard
      title="Audit Trail"
      headerActions={
        <Button type="button" className="h-10 rounded-md text-sm font-medium" onClick={handleExportExcel}>
          Export Excel
        </Button>
      }
    >
      <div className="mb-6 grid gap-4 lg:grid-cols-6">
        <Input
          className="h-10 rounded-md lg:col-span-2"
          placeholder="Search who, action, target, module, failure reason, IP, device"
          value={filters.search}
          onChange={(e) => update("search", e.target.value)}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.auditType}
          onChange={(e) => update("auditType", e.target.value as AuditFilters["auditType"])}
        >
          <option value="all">All Audit Types</option>
          <option value="login">Login</option>
          <option value="system">System</option>
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.module}
          onChange={(e) => update("module", e.target.value)}
        >
          {moduleOptions.map((module) => (
            <option key={module} value={module}>
              {module === "all" ? "All Modules" : module}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={filters.success}
          onChange={(e) => update("success", e.target.value as AuditFilters["success"])}
        >
          <option value="all">All Results</option>
          <option value="success">Success</option>
          <option value="failed">Failed</option>
        </select>
        <Button type="button" variant="outline" className="h-10 rounded-md text-sm font-medium" onClick={clearFilters}>
          Clear Filters
        </Button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:max-w-md">
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Date From</span>
          <Input
            className="h-10 rounded-md"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => update("dateFrom", e.target.value)}
          />
        </label>
        <label className="space-y-1">
          <span className="text-muted-foreground text-xs font-medium">Date To</span>
          <Input
            className="h-10 rounded-md"
            type="date"
            value={filters.dateTo}
            onChange={(e) => update("dateTo", e.target.value)}
          />
        </label>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={FileSearch}
          title="No audit records found."
          description="Login activity and system changes will appear here."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm">
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll("top")}
            className="overflow-x-auto overflow-y-hidden border-b border-border"
            aria-label="Audit table horizontal scroll"
          >
            <div className="h-4" style={{ minWidth: `${AUDIT_TABLE_MIN_WIDTH}px` }} />
          </div>
          <div
            ref={tableScrollRef}
            tabIndex={0}
            onScroll={() => syncScroll("table")}
            className="h-[62vh] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <table className="w-full border-collapse text-sm" style={{ minWidth: `${AUDIT_TABLE_MIN_WIDTH}px` }}>
              <thead className="sticky top-0 z-20 bg-muted/60 dark:bg-neutral-800/70">
                <tr className="border-b border-border">
                  <th
                    className="h-11 w-[180px] min-w-[180px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("createdAtIso")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("createdAtIso");
                      }}
                    >
                      Date / Time
                      {auditSortIcon("createdAtIso")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[120px] min-w-[120px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("auditType")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("auditType");
                      }}
                    >
                      Audit Type
                      {auditSortIcon("auditType")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[220px] min-w-[220px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("whoAttemptedIt")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("whoAttemptedIt");
                      }}
                    >
                      Who Attempted It
                      {auditSortIcon("whoAttemptedIt")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[190px] min-w-[190px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("action")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("action");
                      }}
                    >
                      Action
                      {auditSortIcon("action")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[260px] min-w-[260px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("target")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("target");
                      }}
                    >
                      Target
                      {auditSortIcon("target")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[160px] min-w-[160px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("module")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("module");
                      }}
                    >
                      Module
                      {auditSortIcon("module")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[120px] min-w-[120px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("success")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("success");
                      }}
                    >
                      Success
                      {auditSortIcon("success")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[320px] min-w-[320px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("failureReason")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("failureReason");
                      }}
                    >
                      Failure Reason
                      {auditSortIcon("failureReason")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[160px] min-w-[160px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("ipAddress")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("ipAddress");
                      }}
                    >
                      IP Address
                      {auditSortIcon("ipAddress")}
                    </button>
                  </th>
                  <th
                    className="h-11 w-[200px] min-w-[200px] px-4 text-left align-middle whitespace-nowrap"
                    aria-sort={auditAriaSort("deviceName")}
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(event) => {
                        event.preventDefault();
                        cycleSort("deviceName");
                      }}
                    >
                      Device Name
                      {auditSortIcon("deviceName")}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
              {sortedRows.map((row) => {
                return (
                  <tr
                    key={`${row.sourceType}:${row.id}`}
                    role="button"
                    tabIndex={0}
                    className={cn(
                      "cursor-pointer border-b border-border transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:hover:bg-neutral-800 dark:focus-visible:bg-neutral-800",
                    )}
                    onClick={() => openAuditDetail(row)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openAuditDetail(row);
                      }
                    }}
                  >
                    <td className="w-[180px] min-w-[180px] px-4 py-3 align-middle whitespace-nowrap">{row.createdAt}</td>
                    <td className="w-[120px] min-w-[120px] px-4 py-3 align-middle whitespace-nowrap">{row.auditType}</td>
                    <td className="w-[220px] min-w-[220px] px-4 py-3 align-middle whitespace-nowrap">{row.whoAttemptedIt}</td>
                    <td className="w-[190px] min-w-[190px] px-4 py-3 align-middle whitespace-nowrap">{row.action}</td>
                    <td className="w-[260px] min-w-[260px] max-w-[260px] truncate px-4 py-3 align-middle" title={row.target}>
                      {row.target}
                    </td>
                    <td className="w-[160px] min-w-[160px] px-4 py-3 align-middle whitespace-nowrap">{row.module}</td>
                    <td className="w-[120px] min-w-[120px] px-4 py-3 align-middle whitespace-nowrap">
                      <StatusBadge tone={row.success ? "success" : "danger"}>
                        {row.success ? "Success" : "Failed"}
                      </StatusBadge>
                    </td>
                    <td className="w-[320px] min-w-[320px] max-w-[320px] truncate px-4 py-3 align-middle" title={row.failureReason}>
                      {row.failureReason}
                    </td>
                    <td className="w-[160px] min-w-[160px] px-4 py-3 align-middle whitespace-nowrap">{row.ipAddress}</td>
                    <td className="w-[200px] min-w-[200px] max-w-[200px] truncate px-4 py-3 align-middle" title={row.deviceName}>
                      {row.deviceName}
                    </td>
                  </tr>
                );
              })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </SectionCard>
  );
}
