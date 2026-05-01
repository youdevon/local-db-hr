"use client";

import type { ColumnDef } from "@tanstack/react-table";

import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import type { LeaveDetailData } from "@/lib/server/leave";
import { compareNumber, compareString } from "@/lib/sort-compare";

type TxRow = LeaveDetailData["transactions"][number];

const columns: ColumnDef<TxRow>[] = [
  {
    accessorKey: "leaveType",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
  },
  {
    accessorKey: "_sortStartIso",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Start Date" />,
    cell: ({ row }) => row.original.startDate,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "_sortEndIso",
    header: ({ column }) => <DataTableColumnHeader column={column} title="End Date" />,
    cell: ({ row }) => row.original.endDate,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "_sortReturnIso",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Return to Work Date" />,
    cell: ({ row }) => row.original.returnToWorkDate,
    sortingFn: "alphanumeric",
  },
  {
    accessorKey: "_sortDays",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Days Used" />,
    cell: ({ row }) => row.original.daysUsed,
    sortingFn: (rowA, rowB) =>
      compareNumber(rowA.original._sortDays, rowB.original._sortDays),
  },
  {
    accessorKey: "contractPeriod",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Contract Period" />,
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    sortingFn: (rowA, rowB) =>
      compareString(rowA.original.status, rowB.original.status),
  },
  {
    accessorKey: "notes",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Notes" />,
    cell: ({ row }) => (
      <span className="max-w-[220px] truncate" title={row.original.notes}>
        {row.original.notes}
      </span>
    ),
  },
];

export function LeaveDetailTransactionsTable({ rows }: { rows: TxRow[] }) {
  return <DataTable columns={columns} data={rows} initialSorting={[]} />;
}
