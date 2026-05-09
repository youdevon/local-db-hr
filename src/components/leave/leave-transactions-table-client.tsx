"use client";

import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { deleteLeaveTransactionAction } from "@/actions/leave";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { DataTableColumnHeader } from "@/components/data-table-column-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifyError, notifySuccess } from "@/lib/notify";
import {
  resolveTransactionContractYearLabel,
  resolveTransactionContractYearNumber,
} from "@/lib/leave-transaction-contract-year";
import type { LeaveDetailData } from "@/lib/server/leave";
import type { LeaveTransactionListRow } from "@/lib/server/leave";
import { compareNumber } from "@/lib/sort-compare";

function leavePeriodDisplay(row: LeaveTransactionListRow): string {
  return `${row.startDate} – ${row.endDate}`;
}

function parseDaysRemainingLabel(raw: string | undefined): number {
  if (raw == null || raw === "" || raw === "—") return Number.NaN;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) ? n : Number.NaN;
}

type LeaveTransactionsTableClientProps = {
  transactions: LeaveTransactionListRow[];
  /** When set, Contract Year is resolved from contractual years for each transaction. */
  contractYearContracts?: LeaveDetailData["contracts"] | null;
  /** Same breakdown simulation as Leave Balance / breakdown (vacation/casual + sick pools). */
  daysRemainingByTransactionId: Record<string, string>;
  canEditLeave: boolean;
  canDeleteLeave: boolean;
};

export function LeaveTransactionsTableClient({
  transactions,
  contractYearContracts,
  daysRemainingByTransactionId,
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
        id: "leavePeriod",
        accessorFn: (row) => row._sortStartIso,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Period" />,
        cell: ({ row }) => (
          <span className="whitespace-nowrap">{leavePeriodDisplay(row.original)}</span>
        ),
        sortingFn: "alphanumeric",
      },
      {
        accessorKey: "leaveType",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Leave Type" />,
        cell: ({ row }) => <span className="font-medium">{row.original.leaveType}</span>,
      },
      {
        accessorKey: "_sortDays",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Days Used" />,
        cell: ({ row }) => row.original.daysUsed,
        sortingFn: (rowA, rowB) =>
          compareNumber(rowA.original._sortDays, rowB.original._sortDays),
      },
      {
        id: "daysRemaining",
        accessorFn: (row) => parseDaysRemainingLabel(daysRemainingByTransactionId[row.id]),
        header: ({ column }) => <DataTableColumnHeader column={column} title="Days Remaining" />,
        cell: ({ row }) => daysRemainingByTransactionId[row.original.id] ?? "—",
        sortingFn: (rowA, rowB) => {
          const a = parseDaysRemainingLabel(daysRemainingByTransactionId[rowA.original.id]);
          const b = parseDaysRemainingLabel(daysRemainingByTransactionId[rowB.original.id]);
          if (Number.isNaN(a) && Number.isNaN(b)) return 0;
          if (Number.isNaN(a)) return 1;
          if (Number.isNaN(b)) return -1;
          return compareNumber(a, b);
        },
      },
      {
        id: "contractYear",
        accessorFn: (row) =>
          resolveTransactionContractYearNumber(row, contractYearContracts ?? undefined) ?? -1,
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contract Year" />,
        cell: ({ row }) =>
          resolveTransactionContractYearLabel(row.original, contractYearContracts ?? undefined),
        sortingFn: (rowA, rowB) =>
          compareNumber(
            resolveTransactionContractYearNumber(rowA.original, contractYearContracts ?? undefined) ?? -1,
            resolveTransactionContractYearNumber(rowB.original, contractYearContracts ?? undefined) ?? -1,
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
                  className="flex flex-wrap items-center justify-end gap-2"
                  onClick={(event) => event.stopPropagation()}
                  onKeyDown={(event) => event.stopPropagation()}
                >
                  {canEditLeave ? (
                    <Link
                      href={`/leave/transactions/${row.original.id}/edit`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "inline-flex h-9 min-w-[72px] items-center justify-center",
                      })}
                    >
                      Edit
                    </Link>
                  ) : null}
                  {canDeleteLeave ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className={cn(
                        "h-9 min-w-[72px] justify-center",
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
    [
      canDeleteLeave,
      canEditLeave,
      contractYearContracts,
      daysRemainingByTransactionId,
      showRowActions,
    ],
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
