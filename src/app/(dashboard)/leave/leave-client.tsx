"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_LEAVE_WARNING_SETTINGS, type LeaveWarningSettings } from "@/lib/leave-warning-defaults";
import { getLeaveStatus, getLeaveStatusTone } from "@/lib/leave-balances";
import { getLeaveTypeLabel, type LeaveType } from "@/lib/leave";
import type { LeaveSearchRow } from "@/lib/server/leave";
import { compareNumber, compareString, parseDaysLabel } from "@/lib/sort-compare";

const LEAVE_BALANCE_STATUS_ORDER: Record<string, number> = {
  Healthy: 0,
  Low: 1,
  Exhausted: 2,
  Overused: 3,
};

function parseRemainingDays(text: string): number | null {
  if (!text || text.trim() === "—") return null;
  const parsed = Number(text.replace(" days", "").replace(" day", "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

export function LeaveClient({
  rows: allRows,
  leaveWarningSettings = DEFAULT_LEAVE_WARNING_SETTINGS,
  canCreate,
}: {
  rows: LeaveSearchRow[];
  leaveWarningSettings?: LeaveWarningSettings;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [listVisible, setListVisible] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState("");

  const columns = useMemo<ColumnDef<LeaveSearchRow>[]>(() => {
    return [
      {
        accessorKey: "fullName",
        header: ({ column }) => <DataTableColumnHeader column={column} title="First and Last Name" />,
      },
      {
        accessorKey: "fileNumber",
        header: ({ column }) => <DataTableColumnHeader column={column} title="File #" />,
      },
      {
        id: "leaveTypeLabel",
        accessorFn: (row) => getLeaveTypeLabel(row.leaveType as LeaveType),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
        cell: ({ row }) => getLeaveTypeLabel(row.original.leaveType as LeaveType),
        sortingFn: (rowA, rowB) =>
          compareString(
            getLeaveTypeLabel(rowA.original.leaveType as LeaveType),
            getLeaveTypeLabel(rowB.original.leaveType as LeaveType),
          ),
      },
      {
        accessorKey: "contractPeriod",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contract Period" />,
      },
      {
        id: "availableSort",
        accessorFn: (row) => parseDaysLabel(row.availableText),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Available" />,
        cell: ({ row }) => row.original.availableText,
        sortingFn: (rowA, rowB) =>
          compareNumber(
            parseDaysLabel(rowA.original.availableText),
            parseDaysLabel(rowB.original.availableText),
          ),
      },
      {
        id: "usedSort",
        accessorFn: (row) => parseDaysLabel(row.usedText),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Used" />,
        cell: ({ row }) => row.original.usedText,
        sortingFn: (rowA, rowB) =>
          compareNumber(parseDaysLabel(rowA.original.usedText), parseDaysLabel(rowB.original.usedText)),
      },
      {
        id: "remainingSort",
        accessorFn: (row) => parseDaysLabel(row.remainingText),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Remaining" />,
        cell: ({ row }) => row.original.remainingText,
        sortingFn: (rowA, rowB) =>
          compareNumber(
            parseDaysLabel(rowA.original.remainingText),
            parseDaysLabel(rowB.original.remainingText),
          ),
      },
      {
        id: "resolvedStatus",
        accessorFn: (row) => {
          const remaining = parseRemainingDays(row.remainingText);
          return remaining === null
            ? row.status
            : getLeaveStatus(remaining, row.leaveType, leaveWarningSettings);
        },
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const remaining = parseRemainingDays(row.original.remainingText);
          const resolvedStatus =
            remaining === null
              ? row.original.status
              : getLeaveStatus(remaining, row.original.leaveType, leaveWarningSettings);
          return <StatusBadge tone={getLeaveStatusTone(resolvedStatus)}>{resolvedStatus}</StatusBadge>;
        },
        sortingFn: (rowA, rowB) => {
          const raRem = parseRemainingDays(rowA.original.remainingText);
          const rbRem = parseRemainingDays(rowB.original.remainingText);
          const sa =
            raRem === null
              ? rowA.original.status
              : getLeaveStatus(raRem, rowA.original.leaveType, leaveWarningSettings);
          const sb =
            rbRem === null
              ? rowB.original.status
              : getLeaveStatus(rbRem, rowB.original.leaveType, leaveWarningSettings);
          const ra = LEAVE_BALANCE_STATUS_ORDER[sa] ?? 99;
          const rb = LEAVE_BALANCE_STATUS_ORDER[sb] ?? 99;
          if (ra !== rb) return ra - rb;
          return compareString(sa, sb);
        },
      },
    ];
  }, [leaveWarningSettings]);

  const rows = useMemo(() => {
    if (!listVisible) return [];
    if (!appliedSearch.trim()) return [];
    return allRows.filter((row) => row.searchText.includes(appliedSearch.toLowerCase()));
  }, [allRows, listVisible, appliedSearch]);

  function applySearch(nextQuery: string) {
    setListVisible(true);
    setAppliedSearch(nextQuery.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Leave" },
        ]}
        title="Leave"
        icon="calendar-days"
        description="Search, review, and manage employee leave records."
        actions={canCreate ? <Link href="/leave/new" className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>Add Leave</Link> : null}
      />

      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="h-10 rounded-md pl-9 text-sm"
              placeholder="Search by employee name, file number, ID number, or leave type"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") applySearch(query);
              }}
            />
          </div>
          {query.trim() ? (
            <Button type="button" variant="outline" className="h-10 rounded-md" onClick={() => setQuery("")}>
              Clear
            </Button>
          ) : null}
          <Button type="button" className="h-10 rounded-md" onClick={() => applySearch(query)}>
            Search
          </Button>
        </div>
      </div>

      {!listVisible ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave records shown"
          description="Run a search to review employee leave records."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave records found."
          description="Try adjusting your search terms or add a leave record."
          action={canCreate ? <Link href="/leave/new" className={buttonVariants()}>Add Leave</Link> : null}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) =>
            router.push(
              `/leave/employee/${row.employeeId}?contractId=${encodeURIComponent(row.contractId ?? "")}&type=${encodeURIComponent(row.leaveType)}`,
            )
          }
        />
      )}
    </div>
  );
}
