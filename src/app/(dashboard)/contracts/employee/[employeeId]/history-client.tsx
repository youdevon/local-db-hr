"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  compareContractStatusLabel,
  getContractDisplayStatus,
  getContractDisplayStatusTone,
} from "@/lib/contract-display-status";
import { exportRowsToCsv } from "@/lib/employees-directory";
import { formatContractDate } from "@/lib/mock/contracts";
import { notifyError, notifySuccess } from "@/lib/notify";
import type {
  EmployeeContractHistoryContract,
  EmployeeContractHistoryEmployee,
} from "@/lib/server/hr";
import { FileText } from "lucide-react";

const sortHistoryStatus: SortingFn<EmployeeContractHistoryContract> = (rowA, rowB) => {
  const a = getContractDisplayStatus({
    startDate: rowA.original.startDate,
    endDate: rowA.original.endDate,
    status: rowA.original.status,
  });
  const b = getContractDisplayStatus({
    startDate: rowB.original.startDate,
    endDate: rowB.original.endDate,
    status: rowB.original.status,
  });
  return compareContractStatusLabel(a, b);
};

export function EmployeeContractHistoryClient({
  employeeId,
  employee,
  contracts,
  canCreateContract,
}: {
  employeeId: string;
  employee: EmployeeContractHistoryEmployee;
  contracts: EmployeeContractHistoryContract[];
  canCreateContract: boolean;
}) {
  const router = useRouter();
  const employeeName = `${employee.firstName} ${employee.lastName}`.trim() || "—";

  const latestDisplay =
    contracts[0] === undefined
      ? "—"
      : getContractDisplayStatus({
          startDate: contracts[0].startDate,
          endDate: contracts[0].endDate,
          status: contracts[0].status,
        });

  const columns = useMemo<ColumnDef<EmployeeContractHistoryContract>[]>(
    () => [
      {
        id: "minuteNumber",
        accessorFn: (row) => row.minuteNumber?.trim() || "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Minute #" />,
        cell: ({ row }) => row.original.minuteNumber?.trim() || "—",
      },
      {
        id: "contractNumber",
        accessorFn: (row) => row.contractNumber?.trim() || "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contract #" />,
        cell: ({ row }) =>
          row.original.contractNumber?.trim() || "No assigned number",
      },
      {
        accessorKey: "startDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
        cell: ({ row }) =>
          row.original.startDate ? formatContractDate(row.original.startDate) : "—",
        sortingFn: "alphanumeric",
      },
      {
        accessorKey: "endDate",
        header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
        cell: ({ row }) =>
          row.original.endDate ? formatContractDate(row.original.endDate) : "Present",
        sortingFn: "alphanumeric",
      },
      {
        id: "position",
        accessorFn: (row) => row.position || "",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
        cell: ({ row }) => row.original.position || employee.position || "—",
      },
      {
        id: "displayStatus",
        accessorFn: (row) =>
          getContractDisplayStatus({
            startDate: row.startDate,
            endDate: row.endDate,
            status: row.status,
          }),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
        cell: ({ row }) => {
          const label = getContractDisplayStatus({
            startDate: row.original.startDate,
            endDate: row.original.endDate,
            status: row.original.status,
          });
          return (
            <StatusBadge tone={getContractDisplayStatusTone(label)}>
              {label}
            </StatusBadge>
          );
        },
        sortingFn: sortHistoryStatus,
      },
    ],
    [employee.position],
  );

  function exportCsv() {
    try {
      exportRowsToCsv(
        `employee-contract-history-${employee.fileNumber || employeeId}.csv`,
        [
          "Minute #",
          "Contract #",
          "Start Date",
          "End Date",
          "Position",
          "Status",
        ],
        contracts.map((contract) => [
          contract.minuteNumber?.trim() || "—",
          contract.contractNumber?.trim() || "No assigned number",
          formatContractDate(contract.startDate),
          contract.endDate ? formatContractDate(contract.endDate) : "Present",
          contract.position || employee.position || "—",
          getContractDisplayStatus({
            startDate: contract.startDate,
            endDate: contract.endDate,
            status: contract.status,
          }),
        ]),
      );
      notifySuccess("Contract history exported successfully.");
    } catch {
      notifyError("Failed to export contract history. Please try again.");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "Employee Contract History" },
        ]}
        backFallbackHref="/contracts"
        title="Employee Contract History"
        icon="history"
        description="View all contracts issued to this employee over time."
        actions={
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={exportCsv} className={buttonVariants({ variant: "outline" })}>
              Export CSV
            </button>
            {canCreateContract ? (
              <Link href={`/contracts/new?employeeId=${employeeId}`} className={buttonVariants()}>
                New Contract
              </Link>
            ) : null}
          </div>
        }
      />

      <SectionCard title="Employee Summary">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Employee name</dt>
            <dd className="font-medium">{employeeName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">File number</dt>
            <dd className="font-medium">{employee.fileNumber || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Department</dt>
            <dd className="font-medium">{employee.department || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Position</dt>
            <dd className="font-medium">{employee.position || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Total contracts</dt>
            <dd className="font-medium">{contracts.length}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Current/latest contract status</dt>
            <dd className="pt-1">
              <StatusBadge
                tone={contracts[0] ? getContractDisplayStatusTone(latestDisplay) : "muted"}
              >
                {latestDisplay}
              </StatusBadge>
            </dd>
          </div>
        </dl>
      </SectionCard>

      <SectionCard title="Contracts">
        {contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No contracts recorded."
            description="Contracts issued to this employee will appear here."
            action={
              canCreateContract ? (
                <Link href={`/contracts/new?employeeId=${employeeId}`} className={buttonVariants()}>
                  New Contract
                </Link>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            columns={columns}
            data={contracts}
            onRowClick={(row) => router.push(`/contracts/${row.id}`)}
            initialSorting={[]}
          />
        )}
      </SectionCard>
    </div>
  );
}
