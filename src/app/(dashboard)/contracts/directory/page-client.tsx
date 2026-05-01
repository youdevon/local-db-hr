"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ContractResultsTable } from "@/components/contracts/contract-results-table";
import { PageHeader } from "@/components/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportRowsToCsv } from "@/lib/employees-directory";
import {
  contractMatchesQuery,
  formatContractDate,
  formatContractStatusLabel,
  type ContractListRow,
} from "@/lib/mock/contracts";
import { notifyError, notifySuccess } from "@/lib/notify";

type DirectoryFilters = {
  query: string;
  department: string;
  position: string;
  status: string;
  startFrom: string;
  startTo: string;
  endFrom: string;
  endTo: string;
  expiringPreset: "none" | "30" | "60" | "90";
  customDays: string;
  salaryMin: string;
  salaryMax: string;
};

const defaultFilters: DirectoryFilters = {
  query: "",
  department: "",
  position: "",
  status: "",
  startFrom: "",
  startTo: "",
  endFrom: "",
  endTo: "",
  expiringPreset: "none",
  customDays: "",
  salaryMin: "",
  salaryMax: "",
};

export function ContractsDirectoryClient({
  rows,
  canCreateContract,
}: {
  rows: ContractListRow[];
  canCreateContract: boolean;
}) {
  const router = useRouter();
  const [filters, setFilters] = useState<DirectoryFilters>(defaultFilters);

  const departments = useMemo(
    () => [...new Set(rows.map((row) => row.department).filter(Boolean))].sort(),
    [rows],
  );
  const positions = useMemo(() => [...new Set(rows.map((row) => row.position).filter(Boolean))].sort(), [rows]);
  const statuses = useMemo(() => [...new Set(rows.map((row) => row.status))], [rows]);

  const filteredRows = useMemo(() => {
    const salaryMin = filters.salaryMin ? Number(filters.salaryMin) : null;
    const salaryMax = filters.salaryMax ? Number(filters.salaryMax) : null;
    const expiryDays = filters.customDays
      ? Number(filters.customDays)
      : filters.expiringPreset !== "none"
        ? Number(filters.expiringPreset)
        : null;

    return rows.filter((row) => {
      if (filters.query && !contractMatchesQuery(row, filters.query)) return false;
      if (filters.department && row.department !== filters.department) return false;
      if (filters.position && row.position !== filters.position) return false;
      if (filters.status && row.status !== filters.status) return false;
      if (filters.startFrom && row.startDate < filters.startFrom) return false;
      if (filters.startTo && row.startDate > filters.startTo) return false;
      if (filters.endFrom && row.endDate < filters.endFrom) return false;
      if (filters.endTo && row.endDate > filters.endTo) return false;
      if (salaryMin !== null || salaryMax !== null) {
        const numericSalary = Number(row.salary.replace(/[^\d.-]/g, ""));
        if (salaryMin !== null && numericSalary < salaryMin) return false;
        if (salaryMax !== null && numericSalary > salaryMax) return false;
      }
      if (expiryDays !== null) {
        if (row.daysToExpiry === null || row.daysToExpiry > expiryDays) return false;
      }
      return true;
    });
  }, [rows, filters]);

  function update<K extends keyof DirectoryFilters>(key: K, value: DirectoryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function clearFilters() {
    setFilters(defaultFilters);
  }

  function exportCsv() {
    try {
      exportRowsToCsv(
        "contract-directory.csv",
        [
          "Minute #",
          "Contract #",
          "First and Last Name",
          "Position",
          "Start Date",
          "End Date",
          "Salary",
          "Status",
          "Days to Expiry",
        ],
        filteredRows.map((row) => [
          row.minuteNumber || "—",
          row.contractNumber,
          row.employeeName,
          row.position,
          formatContractDate(row.startDate),
          formatContractDate(row.endDate),
          row.salary,
          formatContractStatusLabel(row.status),
          row.daysToExpiry === null
            ? "—"
            : row.daysToExpiry < 0
              ? "Expired"
              : row.daysToExpiry === 0
                ? "Expires today"
                : `${row.daysToExpiry} days remaining`,
        ]),
      );
      notifySuccess("Contract list exported successfully.");
    } catch {
      notifyError("Failed to export contract list. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "Directory" },
        ]}
        backFallbackHref="/contracts"
        title="Contract Directory"
        icon="folder-kanban"
        description="View, filter, and export contract records."
        actions={
          <div className="flex flex-wrap gap-2">
            {canCreateContract ? (
              <Button type="button" variant="outline" onClick={() => router.push("/contracts/new")}>
                New Contract
              </Button>
            ) : null}
            <Button type="button" onClick={exportCsv}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-4">
          <Input
            className="h-10 rounded-md lg:col-span-2"
            placeholder="Search by minute #, employee name, file number, contract number, position, department or status"
            value={filters.query}
            onChange={(e) => update("query", e.target.value)}
          />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.department} onChange={(e) => update("department", e.target.value)}>
            <option value="">All departments</option>
            {departments.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.position} onChange={(e) => update("position", e.target.value)}>
            <option value="">All positions</option>
            {positions.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={(e) => update("status", e.target.value)}>
            <option value="">All statuses</option>
            {statuses.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <Input className="h-10 rounded-md" type="date" value={filters.startFrom} onChange={(e) => update("startFrom", e.target.value)} />
          <Input className="h-10 rounded-md" type="date" value={filters.startTo} onChange={(e) => update("startTo", e.target.value)} />
          <Input className="h-10 rounded-md" type="date" value={filters.endFrom} onChange={(e) => update("endFrom", e.target.value)} />
          <Input className="h-10 rounded-md" type="date" value={filters.endTo} onChange={(e) => update("endTo", e.target.value)} />
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.expiringPreset} onChange={(e) => update("expiringPreset", e.target.value as DirectoryFilters["expiringPreset"])}>
            <option value="none">No expiry preset</option>
            <option value="30">Expiring in 30 days</option>
            <option value="60">Expiring in 60 days</option>
            <option value="90">Expiring in 90 days</option>
          </select>
          <Input className="h-10 rounded-md" type="number" placeholder="Custom days" value={filters.customDays} onChange={(e) => update("customDays", e.target.value)} />
          <Input className="h-10 rounded-md" type="number" step="0.01" min="0" placeholder="Salary min" value={filters.salaryMin} onChange={(e) => update("salaryMin", e.target.value)} />
          <Input className="h-10 rounded-md" type="number" step="0.01" min="0" placeholder="Salary max" value={filters.salaryMax} onChange={(e) => update("salaryMax", e.target.value)} />
        </div>
        <div className="mt-3 flex justify-end">
          <Button type="button" variant="outline" onClick={clearFilters}>
            Clear Filters
          </Button>
        </div>
      </div>

      <ContractResultsTable
        contracts={filteredRows}
        onRowClick={(row) => router.push(`/contracts/${row.id}`)}
        emptyTitle="No contracts recorded."
        emptyDescription="Create a new contract to begin."
        emptyAction={
          canCreateContract ? (
            <Link href="/contracts/new" className={buttonVariants()}>
              New Contract
            </Link>
          ) : undefined
        }
      />
    </div>
  );
}
