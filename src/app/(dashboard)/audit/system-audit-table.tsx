"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { StatusBadge } from "@/components/status-badge";

export type SystemAuditRow = {
  id: string;
  createdAt: string;
  actor: string;
  action: string;
  target: string;
  module: string;
  success: boolean;
  failureReason: string;
};

const columns: ColumnDef<SystemAuditRow>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date / Time" />,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "actor",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Who Attempted It" />,
  },
  {
    accessorKey: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
  },
  {
    accessorKey: "target",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Target" />,
  },
  {
    accessorKey: "module",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Module" />,
  },
  {
    accessorKey: "success",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Success" />,
    cell: ({ row }) => (
      <StatusBadge tone={row.original.success ? "success" : "danger"}>
        {row.original.success ? "Success" : "Failed"}
      </StatusBadge>
    ),
    sortingFn: (rowA, rowB) =>
      Number(rowA.original.success) - Number(rowB.original.success),
  },
  {
    accessorKey: "failureReason",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Failure Reason" />,
    cell: ({ row }) => (
      <span className="block max-w-[20rem] truncate text-sm" title={row.original.failureReason}>
        {row.original.failureReason}
      </span>
    ),
  },
];

export function SystemAuditTable({ rows }: { rows: SystemAuditRow[] }) {
  return (
    <DataTable
      columns={columns}
      data={rows}
      initialSorting={[{ id: "createdAt", desc: true }]}
    />
  );
}
