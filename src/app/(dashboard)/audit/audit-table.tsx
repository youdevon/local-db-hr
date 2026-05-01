"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { StatusBadge } from "@/components/status-badge";

export type AuditRow = {
  id: string;
  createdAt: string;
  attemptedEmail: string;
  action: string;
  success: boolean;
  failureReason: string;
  ip: string;
  deviceName: string;
};

const columns: ColumnDef<AuditRow>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Date / Time" />,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "attemptedEmail",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Email Attempted" />,
  },
  {
    accessorKey: "action",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Action" />,
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
      <span
        className="block max-w-[20rem] truncate text-sm"
        title={row.original.failureReason}
      >
        {row.original.failureReason}
      </span>
    ),
  },
  {
    accessorKey: "ip",
    header: ({ column }) => <DataTableColumnHeader column={column} title="IP Address" />,
  },
  {
    accessorKey: "deviceName",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Device Name" />,
  },
];

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const router = useRouter();

  return (
    <DataTable
      columns={columns}
      data={rows}
      onRowClick={(row) => router.push(`/audit/login/${row.id}`)}
      initialSorting={[{ id: "createdAt", desc: true }]}
    />
  );
}
