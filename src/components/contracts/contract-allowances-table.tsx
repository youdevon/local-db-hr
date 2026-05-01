"use client";

import { type ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { formatContractDate, formatCurrencyTTD } from "@/lib/mock/contracts";

type ContractAllowanceRow = {
  aid: string;
  allowanceType: string;
  description: string;
  amount: number | null;
  frequency: string;
  startDate: string;
  endDate: string;
  taxable: boolean;
  notes: string;
};

function toTitle(value: string | null | undefined): string {
  if (!value?.trim()) return "—";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function ContractAllowancesTable({ allowances }: { allowances: ContractAllowanceRow[] }) {
  const columns: ColumnDef<ContractAllowanceRow>[] = [
    {
      accessorKey: "allowanceType",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Allowance type" />,
      cell: ({ row }) => toTitle(row.original.allowanceType),
    },
    {
      accessorKey: "description",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Description" />,
      cell: ({ row }) => row.original.description?.trim() || "—",
    },
    {
      accessorKey: "amount",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Amount" />,
      cell: ({ row }) => formatCurrencyTTD(row.original.amount),
    },
    {
      accessorKey: "frequency",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Frequency" />,
      cell: ({ row }) => toTitle(row.original.frequency),
    },
    {
      accessorKey: "startDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Start date" />,
      cell: ({ row }) => formatContractDate(row.original.startDate),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "endDate",
      header: ({ column }) => <DataTableColumnHeader column={column} title="End date" />,
      cell: ({ row }) => formatContractDate(row.original.endDate),
      sortingFn: "alphanumeric",
    },
    {
      accessorKey: "taxable",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Taxable" />,
      cell: ({ row }) => (row.original.taxable ? "Yes" : "No"),
    },
    {
      accessorKey: "notes",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Notes" />,
      cell: ({ row }) => row.original.notes?.trim() || "—",
    },
  ];

  if (!allowances.length) {
    return <p className="text-muted-foreground text-sm">No allowances recorded.</p>;
  }

  return <DataTable columns={columns} data={allowances} />;
}
