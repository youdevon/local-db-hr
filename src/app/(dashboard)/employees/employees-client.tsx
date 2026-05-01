"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  type EmployeeDirectoryRow,
} from "@/lib/employees-directory";
import { Search, Users } from "lucide-react";
const columns: ColumnDef<EmployeeDirectoryRow>[] = [
  {
    accessorKey: "fileNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="File #" />,
  },
  {
    accessorKey: "fullName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="First and Last Name" />,
  },
  {
    accessorKey: "phoneContact",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Phone Contact" />,
    cell: ({ row }) => (
      <span className="max-w-[12rem] whitespace-normal break-words text-sm">
        {row.original.phoneContact}
      </span>
    ),
  },
  {
    id: "age",
    accessorFn: (row) => row.age ?? Number.NEGATIVE_INFINITY,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Age" />,
    cell: ({ row }) => <span>{row.original.age ?? "—"}</span>,
    sortUndefined: "last",
  },
  {
    accessorKey: "residentialAddress",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Address" />,
    cell: ({ row }) => (
      <span className="block max-w-[14rem] truncate text-sm" title={row.original.residentialAddress}>
        {row.original.residentialAddress}
      </span>
    ),
  },
  {
    accessorKey: "emailAddress",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email Address" />,
    cell: ({ row }) => (
      <span className="max-w-[14rem] break-all text-sm">{row.original.emailAddress}</span>
    ),
  },
  {
    accessorKey: "position",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
  },
];

function matchesEmployeeQuery(row: EmployeeDirectoryRow, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return row.searchText.includes(needle);
}

export function EmployeesClient({
  rows: allRows,
  canCreate,
  viewerNoticeMessage,
}: {
  rows: EmployeeDirectoryRow[];
  canCreate: boolean;
  viewerNoticeMessage?: string;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [listVisible, setListVisible] = useState(false);
  const [appliedSearch, setAppliedSearch] = useState("");

  const rows = useMemo(() => {
    if (!listVisible) return [];
    if (!appliedSearch.trim()) return [];
    return allRows.filter((row) => matchesEmployeeQuery(row, appliedSearch));
  }, [listVisible, appliedSearch, allRows]);

  function applySearch(nextQuery: string) {
    const normalized = nextQuery.trim();
    setListVisible(true);
    setAppliedSearch(normalized);
    if (process.env.NODE_ENV === "development") {
      const count = normalized ? allRows.filter((row) => matchesEmployeeQuery(row, normalized)).length : 0;
      console.info("[employees:search]", { query: normalized, results: count });
    }
  }

  return (
    <div className="space-y-6">
      {viewerNoticeMessage ? (
        <div className="border-border bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" role="status">
            {viewerNoticeMessage}
          </p>
          <Link
            href="/employees"
            className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0 self-start sm:self-auto" })}
            scroll={false}
          >
            Dismiss
          </Link>
        </div>
      ) : null}
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Employees" },
        ]}
        title="Employees"
        icon="users"
        description="Search employee bio-data records."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreate ? (
              <Link
                href="/employees/new"
                className={buttonVariants({ className: "h-10 text-sm font-medium" })}
              >
                New Employee
              </Link>
            ) : null}
            <Button
              type="button"
              variant="secondary"
              className="h-10 text-sm font-medium"
              onClick={() => router.push("/employees/directory")}
            >
              Show All
            </Button>
          </div>
        }
      />

      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row">
          <div className="relative flex-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="h-10 rounded-lg pl-9 text-sm"
              placeholder="Search by name, file number, phone, address, email, position or ID number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  applySearch(query);
                }
              }}
            />
          </div>
          {query.trim() ? (
            <Button type="button" variant="outline" onClick={() => setQuery("")}>
              Clear
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => applySearch(query)}
          >
            Search
          </Button>
        </div>
      </div>

      {!listVisible ? (
        <EmptyState
          icon={Users}
          title="No employees shown"
          description="Run a search or click Show All to open the full employee directory."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees found."
          description="Create a new employee to begin."
          action={canCreate ? <Link href="/employees/new" className={buttonVariants()}>New Employee</Link> : null}
        />
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          onRowClick={(row) => router.push(`/employees/${row.id}`)}
        />
      )}
    </div>
  );
}
