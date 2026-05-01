"use client";

import type { ColumnDef, SortingFn } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import {
  compareContractStatusLabel,
  getContractDisplayStatus,
  getContractDisplayStatusTone,
} from "@/lib/contract-display-status";
import {
  calculateDaysToExpiry,
  formatContractDate,
  type ContractListRow,
} from "@/lib/mock/contracts";
import { parseCurrencyToNumber } from "@/lib/sort-compare";
import { FileText } from "lucide-react";

function daysToExpiryLabel(row: ContractListRow): string {
  if (!row.endDate) return "—";
  const display = getContractDisplayStatus({
    startDate: row.startDate,
    endDate: row.endDate,
    status: row.status,
  });
  if (display === "Expired") return "Expired";
  const days = calculateDaysToExpiry(row.endDate);
  if (days < 0) return "Expired";
  if (days === 0) return "Expires today";
  return `${days} days remaining`;
}

const sortDaysToExpiry: SortingFn<ContractListRow> = (rowA, rowB) => {
  const a = rowA.original;
  const b = rowB.original;
  const na = a.daysToExpiry;
  const nb = b.daysToExpiry;
  if (na === null && nb === null) return 0;
  if (na === null) return 1;
  if (nb === null) return -1;
  return na - nb;
};

const sortSalary: SortingFn<ContractListRow> = (rowA, rowB) => {
  const na = parseCurrencyToNumber(rowA.original.salary);
  const nb = parseCurrencyToNumber(rowB.original.salary);
  if (Number.isNaN(na) && Number.isNaN(nb)) return 0;
  if (Number.isNaN(na)) return 1;
  if (Number.isNaN(nb)) return -1;
  return na - nb;
};

const sortDisplayStatus: SortingFn<ContractListRow> = (rowA, rowB) => {
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

function buildColumns(): ColumnDef<ContractListRow>[] {
  return [
    {
      accessorKey: "minuteNumber",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Minute #" />,
    },
    {
      accessorKey: "contractNumber",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contract #" />,
    },
    {
      accessorKey: "employeeName",
      header: ({ column }) => <DataTableColumnHeader column={column} title="First and Last Name" />,
    },
    {
      accessorKey: "position",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Position" />,
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
      cell: ({ row }) => formatContractDate(row.original.startDate),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
      cell: ({ row }) => formatContractDate(row.original.endDate),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "salary",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Salary" />,
      sortingFn: sortSalary,
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
      sortingFn: sortDisplayStatus,
    },
    {
      id: "daysToExpiry",
      accessorFn: (row) => row.daysToExpiry,
      header: ({ column }) => <DataTableColumnHeader column={column} title="Days to Expiry" />,
      cell: ({ row }) => (
        <span className="tabular-nums">{daysToExpiryLabel(row.original)}</span>
      ),
      sortingFn: sortDaysToExpiry,
    },
  ];
}

const columns = buildColumns();

export function ContractResultsTable({
  contracts,
  onRowClick,
  emptyTitle = "No contracts found.",
  emptyDescription = "Try adjusting your search terms.",
  emptyAction,
}: {
  contracts: ContractListRow[];
  onRowClick: (row: ContractListRow) => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
}) {
  if (contracts.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <DataTable
      columns={columns}
      data={contracts}
      onRowClick={onRowClick}
      initialSorting={[{ id: "endDate", desc: false }]}
    />
  );
}
