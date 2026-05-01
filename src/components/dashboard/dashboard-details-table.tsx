"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { DashboardDetailCell, DashboardDetailColumn, DashboardDetailRow } from "@/lib/server/dashboard-detail-metrics";
import {
  compareDateIso,
  compareNumber,
  compareString,
  parseDaysLabel,
} from "@/lib/sort-compare";
import { cn } from "@/lib/utils";

function renderCell(value: DashboardDetailCell | undefined) {
  if (value === undefined || value === null || value === "") return "—";
  if (typeof value === "object" && value.type === "status") {
    return <StatusBadge tone={value.tone}>{value.label}</StatusBadge>;
  }
  return String(value);
}

type SortDir = "asc" | "desc" | null;

function sortValueFromRow(row: DashboardDetailRow, col: DashboardDetailColumn): string | number | null {
  const field = col.sortKey ?? col.key;
  const raw = row[field];
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "object" && raw !== null && "type" in raw && raw.type === "status") {
    return raw.label;
  }
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s || s === "—") return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parsedDays = parseDaysLabel(s);
  if (!Number.isNaN(parsedDays) && /day/i.test(s)) return parsedDays;
  const n = Number(s.replace(/[^\d.-]/g, ""));
  if (Number.isFinite(n) && /^\s*-?\d/.test(s.replace(/[^\d.-]/g, ""))) return n;
  return s;
}

function compareRows(
  a: DashboardDetailRow,
  b: DashboardDetailRow,
  col: DashboardDetailColumn,
): number {
  const va = sortValueFromRow(a, col);
  const vb = sortValueFromRow(b, col);
  if (
    typeof va === "number" &&
    typeof vb === "number" &&
    Number.isFinite(va) &&
    Number.isFinite(vb)
  ) {
    return va - vb;
  }
  const label = col.label.toLowerCase();
  const key = col.key.toLowerCase();

  if (
    label.includes("date") ||
    key.includes("date") ||
    key === "birthday" ||
    key === "retirementdate" ||
    key === "contractenddate" ||
    key === "retirementcutoffdate"
  ) {
    return compareDateIso(va, vb);
  }

  if (label.includes("day") || key.includes("days") || key === "age") {
    const na = typeof va === "number" ? va : Number(va);
    const nb = typeof vb === "number" ? vb : Number(vb);
    return compareNumber(Number.isFinite(na) ? na : Number.NaN, Number.isFinite(nb) ? nb : Number.NaN);
  }

  if (typeof va === "number" && typeof vb === "number") return va - vb;

  return compareString(va, vb);
}

export function DashboardDetailsTable({
  columns,
  rows,
  emptyMessage,
}: {
  columns: DashboardDetailColumn[];
  rows: DashboardDetailRow[];
  emptyMessage: string;
}) {
  const router = useRouter();
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const sortedRows = useMemo(() => {
    if (!sortCol || !sortDir) return rows;
    const col = columns.find((c) => c.key === sortCol);
    if (!col) return rows;
    const next = [...rows];
    next.sort((a, b) => {
      const cmp = compareRows(a, b, col);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return next;
  }, [rows, columns, sortCol, sortDir]);

  function cycleSort(columnKey: string) {
    if (sortCol !== columnKey) {
      setSortCol(columnKey);
      setSortDir("asc");
      return;
    }
    if (sortDir === "asc") {
      setSortDir("desc");
      return;
    }
    if (sortDir === "desc") {
      setSortCol(null);
      setSortDir(null);
      return;
    }
    setSortDir("asc");
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyMessage} />;
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => {
                const sorted =
                  sortCol === column.key ? (sortDir === "asc" ? "asc" : sortDir === "desc" ? "desc" : false) : false;
                return (
                  <TableHead
                    key={column.key}
                    className="text-sm"
                    aria-sort={
                      sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : "none"
                    }
                  >
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground inline-flex h-8 w-full min-w-0 cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        cycleSort(column.key);
                      }}
                    >
                      <span className="truncate">{column.label}</span>
                      {sorted === "asc" ? (
                        <ArrowUp className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />
                      ) : sorted === "desc" ? (
                        <ArrowDown className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />
                      ) : (
                        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
                      )}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.map((row, index) => {
              const clickable = Boolean(row.href);
              return (
                <TableRow
                  key={`${row.href ?? "row"}:${index}`}
                  className={cn(
                    "text-sm",
                    clickable &&
                      "cursor-pointer transition-colors hover:bg-muted/30 focus-within:bg-muted/30 focus-within:outline-none",
                  )}
                  onClick={clickable ? () => router.push(row.href as string) : undefined}
                  onKeyDown={
                    clickable
                      ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            router.push(row.href as string);
                          }
                        }
                      : undefined
                  }
                  role={clickable ? "link" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                >
                  {columns.map((column) => (
                    <TableCell key={column.key} className="text-sm">
                      {renderCell(row[column.key])}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
