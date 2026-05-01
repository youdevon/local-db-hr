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
  type DirectoryFilters,
  type EmployeeDirectoryRow,
  exportRowsToCsv,
  filterDirectoryRows,
  formatDateOrDash,
} from "@/lib/employees-directory";
import { notifyError, notifySuccess } from "@/lib/notify";
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
    header: ({ column }) => <DataTableColumnHeader column={column} title="Residential Address" />,
    cell: ({ row }) => (
      <span className="block max-w-[16rem] truncate" title={row.original.residentialAddress}>
        {row.original.residentialAddress}
      </span>
    ),
  },
  {
    accessorKey: "emailAddress",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email Address" />,
  },
  {
    accessorKey: "department",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Department" />,
  },
  {
    accessorKey: "position",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
  },
  {
    accessorKey: "employmentStatus",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Employment Status" />,
  },
  {
    accessorKey: "dateFirstEngaged",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date First Engaged" />,
    cell: ({ row }) => formatDateOrDash(row.original.dateFirstEngaged),
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "contractEndDate",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contract End Date" />,
    cell: ({ row }) => formatDateOrDash(row.original.contractEndDate),
    sortingFn: "alphanumeric",
  },
];

const defaultFilters: DirectoryFilters = {
  query: "",
  department: "",
  position: "",
  employmentStatus: "",
  workLocation: "",
  minAge: "",
  maxAge: "",
  engagedFrom: "",
  engagedTo: "",
};

export function EmployeeDirectoryClient({
  allRows,
  canCreateEmployee,
}: {
  allRows: EmployeeDirectoryRow[];
  canCreateEmployee: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<DirectoryFilters>(defaultFilters);

  const filteredRows = useMemo(() => filterDirectoryRows(allRows, filters), [allRows, filters]);

  const departmentOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.department).filter(Boolean))].sort(),
    [allRows],
  );
  const positionOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.position).filter(Boolean))].sort(),
    [allRows],
  );
  const statusOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.employmentStatus).filter(Boolean))].sort(),
    [allRows],
  );
  const workLocationOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.workLocation).filter(Boolean))].sort(),
    [allRows],
  );

  function updateFilter<K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  function handleExportCsv() {
    try {
      exportRowsToCsv(
        "employee-directory.csv",
        [
          "File #",
          "First and Last Name",
          "Phone Contact",
          "Age",
          "Residential Address",
          "Email Address",
          "Department",
          "Position",
          "Employment Status",
          "Date First Engaged",
          "Contract End Date",
        ],
        filteredRows.map((row) => [
          row.fileNumber,
          row.fullName,
          row.phoneContact,
          row.age ?? "—",
          row.residentialAddress,
          row.emailAddress,
          row.department,
          row.position,
          row.employmentStatus,
          formatDateOrDash(row.dateFirstEngaged),
          formatDateOrDash(row.contractEndDate),
        ]),
      );
      notifySuccess("Employee list exported successfully.");
    } catch {
      notifyError("Failed to export employee list. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Employees", href: "/employees" },
          { label: "Directory" },
        ]}
        backFallbackHref="/employees"
        title="Employee Directory"
        icon="contact-round"
        description="View, filter, export, and monitor employee records."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/employees/age-monitoring")}>
              Age Monitoring
            </Button>
            <Button type="button" onClick={handleExportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="border-border bg-card rounded-xl border p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-4">
          <div className="relative lg:col-span-2">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              className="h-10 rounded-lg pl-9"
              placeholder="Search by name, file number, phone, address, email, position or ID number"
              value={filters.query}
              onChange={(e) => updateFilter("query", e.target.value)}
            />
          </div>

          <select
            className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            value={filters.department}
            onChange={(e) => updateFilter("department", e.target.value)}
          >
            <option value="">All departments</option>
            {departmentOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            value={filters.position}
            onChange={(e) => updateFilter("position", e.target.value)}
          >
            <option value="">All positions</option>
            {positionOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>

          <select
            className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            value={filters.employmentStatus}
            onChange={(e) => updateFilter("employmentStatus", e.target.value)}
          >
            <option value="">All employment statuses</option>
            {statusOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-10 rounded-lg border px-3 text-sm"
            value={filters.workLocation}
            onChange={(e) => updateFilter("workLocation", e.target.value)}
          >
            <option value="">All work locations</option>
            {workLocationOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
          <Input
            className="h-10 rounded-lg"
            type="number"
            placeholder="Age minimum"
            value={filters.minAge}
            onChange={(e) => updateFilter("minAge", e.target.value)}
          />
          <Input
            className="h-10 rounded-lg"
            type="number"
            placeholder="Age maximum"
            value={filters.maxAge}
            onChange={(e) => updateFilter("maxAge", e.target.value)}
          />

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Date first engaged from</p>
            <Input
              className="h-10 rounded-lg"
              type="date"
              value={filters.engagedFrom}
              onChange={(e) => updateFilter("engagedFrom", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Date first engaged to</p>
            <Input
              className="h-10 rounded-lg"
              type="date"
              value={filters.engagedTo}
              onChange={(e) => updateFilter("engagedTo", e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Contract end date from (future)</p>
            <Input
              className="h-10 rounded-lg"
              type="date"
              disabled
              title="Future contracts integration"
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-xs">Contract end date to (future)</p>
            <Input
              className="h-10 rounded-lg"
              type="date"
              disabled
              title="Future contracts integration"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs">
            Contract end date filters are disabled until contracts table integration is connected.
          </p>
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees recorded."
          description="Create a new employee to begin."
          action={
            canCreateEmployee ? (
              <Link href="/employees/new" className={buttonVariants()}>
                New Employee
              </Link>
            ) : undefined
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filteredRows}
          onRowClick={(row) => router.push(`/employees/${row.id}`)}
        />
      )}
    </div>
  );
}
