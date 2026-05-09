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
import { Users } from "lucide-react";

const columns: ColumnDef<EmployeeDirectoryRow>[] = [
  {
    accessorKey: "fileNumber",
    header: ({ column }) => <DataTableColumnHeader column={column} title="File #" />,
  },
  {
    accessorKey: "fullName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Full Name" />,
  },
  {
    id: "age",
    accessorFn: (row) => row.age ?? Number.NEGATIVE_INFINITY,
    header: ({ column }) => <DataTableColumnHeader column={column} title="Age" />,
    cell: ({ row }) => <span>{row.original.age ?? "—"}</span>,
    sortUndefined: "last",
  },
  {
    accessorKey: "dateOfBirth",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date of Birth" />,
    cell: ({ row }) => formatDateOrDash(row.original.dateOfBirth),
    sortingFn: "alphanumeric",
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
    accessorKey: "workLocation",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Work Location" />,
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

export function AgeMonitoringClient({
  allRows,
  canCreateEmployee,
  retirementAge,
}: {
  allRows: EmployeeDirectoryRow[];
  canCreateEmployee: boolean;
  retirementAge: number;
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
  const locationOptions = useMemo(
    () => [...new Set(allRows.map((row) => row.workLocation).filter(Boolean))].sort(),
    [allRows],
  );

  function updateFilter<K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function applyQuickAge(min: string) {
    setFilters((prev) => ({ ...prev, minAge: min, maxAge: "" }));
  }

  function clearAll() {
    setFilters(defaultFilters);
  }

  const quickAgeThresholds = useMemo(
    () => [Math.max(18, retirementAge - 5), retirementAge, Math.min(100, retirementAge + 5)],
    [retirementAge],
  );

  function exportCsv() {
    try {
      exportRowsToCsv(
        "age-monitoring.csv",
        [
          "File #",
          "Full Name",
          "Age",
          "Date of Birth",
          "Department",
          "Position",
          "Employment Status",
          "Work Location",
          "Contract End Date",
        ],
        filteredRows.map((row) => [
          row.fileNumber,
          row.fullName,
          row.age ?? "—",
          formatDateOrDash(row.dateOfBirth),
          row.department,
          row.position,
          row.employmentStatus,
          row.workLocation,
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
          { label: "Age Monitoring" },
        ]}
        backFallbackHref="/employees/directory"
        title="Age Monitoring"
        icon="calendar-clock"
        description="Filter employees by age range and review age-related HR monitoring."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => router.push("/employees/directory")}>
              Directory
            </Button>
            <Button type="button" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="border-border bg-card space-y-3 rounded-xl border p-5 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {quickAgeThresholds.map((ageValue) => (
            <Button key={ageValue} type="button" variant="outline" onClick={() => applyQuickAge(String(ageValue))}>
              Age {ageValue}+
            </Button>
          ))}
          <Button type="button" variant="outline" onClick={() => setFilters((p) => ({ ...p, minAge: "", maxAge: "" }))}>
            Custom Range
          </Button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <Input
            className="h-10 rounded-lg"
            type="number"
            placeholder="Minimum age"
            value={filters.minAge}
            onChange={(e) => updateFilter("minAge", e.target.value)}
          />
          <Input
            className="h-10 rounded-lg"
            type="number"
            placeholder="Maximum age"
            value={filters.maxAge}
            onChange={(e) => updateFilter("maxAge", e.target.value)}
          />
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
            {locationOptions.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={clearAll}>
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
