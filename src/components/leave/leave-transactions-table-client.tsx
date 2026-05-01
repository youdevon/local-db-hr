"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteLeaveTransactionAction } from "@/actions/leave";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { LeaveTransactionListRow } from "@/lib/server/leave";
import { compareNumber, compareString } from "@/lib/sort-compare";

function toneForStatus(status: string): "default" | "success" | "warning" | "danger" | "muted" {
  const normalized = status.trim().toLowerCase();
  if (normalized === "approved") return "success";
  if (normalized === "recorded" || normalized === "adjusted") return "default";
  if (normalized === "cancelled") return "muted";
  if (normalized === "rejected") return "danger";
  return "default";
}

type LeaveTransactionsTableClientProps = {
  transactions: LeaveTransactionListRow[];
  canEditLeave: boolean;
  canDeleteLeave: boolean;
};

export function LeaveTransactionsTableClient({
  transactions,
  canEditLeave,
  canDeleteLeave,
}: LeaveTransactionsTableClientProps) {
  const router = useRouter();
  const [deleteTarget, setDeleteTarget] = useState<LeaveTransactionListRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const showRowActions = canEditLeave || canDeleteLeave;

  const columns = useMemo<ColumnDef<LeaveTransactionListRow>[]>(
    () => [
      {
        accessorKey: "leaveType",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
        cell: ({ row }) => <span className="font-medium">{row.original.leaveType}</span>,
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
        cell: ({ row }) => (
          <StatusBadge tone={toneForStatus(row.original.status)}>{row.original.status}</StatusBadge>
        ),
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
      ...(showRowActions
        ? ([
            {
              id: "actions",
              enableSorting: false,
              header: () => (
                <span className="text-muted-foreground block text-right text-xs font-medium">Actions</span>
              ),
              cell: ({ row }) => (
                <div
                  className="flex items-center justify-end gap-2"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {canEditLeave ? (
                    <Link
                      href={`/leave/transactions/${row.original.id}/edit`}
                      className={buttonVariants({
                        variant: "outline",
                        className: "h-8 rounded-md px-3 text-xs font-medium",
                      })}
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDeleteLeave ? (
                    <Button
                      type="button"
                      variant="destructive"
                      className={cn(
                        "h-8 rounded-md px-3 text-xs font-medium",
                        "bg-destructive/85 hover:bg-destructive text-destructive-foreground",
                      )}
                      onClick={() => setDeleteTarget(row.original)}
                    >
                      Delete
                    </Button>
                  ) : null}
                </div>
              ),
            },
          ] satisfies ColumnDef<LeaveTransactionListRow>[])
        : []),
    ],
    [canDeleteLeave, canEditLeave, showRowActions],
  );

  const deleteDescription = useMemo(
    () =>
      deleteTarget
        ? "This will remove the leave record and recalculate the employee’s leave balance. This action should only be used to correct an incorrect record."
        : "",
    [deleteTarget],
  );

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const result = await deleteLeaveTransactionAction(deleteTarget.id);
      if (!result.success) {
        notifyError("Failed to delete leave record. Please try again.");
        return;
      }
      notifySuccess("Leave record deleted successfully.");
      setDeleteTarget(null);
      router.refresh();
    } catch (err) {
      const msg = err instanceof Error && err.message ? err.message : "Failed to delete leave record. Please try again.";
      notifyError(msg);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <DataTable columns={columns} data={transactions} initialSorting={[]} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Leave Record"
        description={deleteDescription}
        confirmLabel="Delete Leave Record"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </>
  );
}
