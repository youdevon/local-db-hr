"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { deleteLeaveTransactionAction } from "@/actions/leave";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmployeeCombobox } from "@/components/employee-combobox";
import { LeaveTransactionsTableClient } from "@/components/leave/leave-transactions-table-client";
import { EmptyState } from "@/components/empty-state";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { EmployeeFilterOption } from "@/lib/reports/report-definitions";
import type {
  LeaveBreakdownTxRow,
  LeaveBreakdownYearBlock,
  LeaveTransactionBreakdownResult,
} from "@/lib/server/leave-transaction-breakdown";
import type { LeaveDetailData, LeaveEmployeeOption, LeaveTransactionListRow } from "@/lib/server/leave";
import { formatContractYearLabel } from "@/lib/leave-transaction-contract-year";
import { formatDateLabel, LEAVE_TYPE_OPTIONS } from "@/lib/leave";
import { notifyError, notifySuccess } from "@/lib/notify";

function toEmployeeFilterOptions(employees: LeaveEmployeeOption[]): EmployeeFilterOption[] {
  return employees.map((employee) => ({
    value: employee.id,
    label: `${employee.fullName} · ${employee.fileNumber}`,
    fullName: employee.fullName,
    fileNumber: employee.fileNumber,
    searchText: employee.searchText,
  }));
}

function transactionMatchesContractRow(
  tx: LeaveTransactionListRow,
  contractId: string,
  detail: LeaveDetailData | null,
): boolean {
  if (!detail) return false;
  if (tx.contractIdResolved === contractId) return true;
  const contract = detail.contracts.find((c) => c.contractId === contractId);
  if (!contract?.years.length) return false;
  const sorted = [...contract.years].sort((a, b) => a.yearNumber - b.yearNumber);
  const startBound = sorted[0]!.startDate;
  const endBound = sorted[sorted.length - 1]!.endDate;
  return tx._sortStartIso >= startBound && tx._sortStartIso <= endBound;
}

function rowMatchesFilters(tx: LeaveTransactionListRow, opts: { leaveType: string }): boolean {
  if (opts.leaveType && tx.leaveTypeRaw !== opts.leaveType) return false;
  return true;
}

function breakdownTxMatchesFilters(tx: LeaveBreakdownTxRow, opts: { leaveType: string }): boolean {
  if (opts.leaveType && tx.leaveTypeRaw !== opts.leaveType) return false;
  return true;
}

function filterBreakdownYears(
  years: LeaveBreakdownYearBlock[],
  filters: { leaveType: string },
): LeaveBreakdownYearBlock[] {
  return years
    .map((block) => ({
      ...block,
      transactions: block.transactions.filter((tx) => breakdownTxMatchesFilters(tx, filters)),
    }))
    .filter((block) => block.transactions.length > 0);
}

export type LeaveTransactionsDirectoryClientProps = {
  employeeOptions: LeaveEmployeeOption[];
  initialEmployeeId: string;
  initialContractId: string;
  breakdownView: boolean;
  detail: LeaveDetailData | null;
  transactions: LeaveTransactionListRow[];
  breakdown: LeaveTransactionBreakdownResult | null;
  /** Running days remaining after each tx (breakdown simulation); keys are transaction ids. */
  daysRemainingByTransactionId: Record<string, string>;
  canEditLeave: boolean;
  canDeleteLeave: boolean;
};

export function LeaveTransactionsDirectoryClient({
  employeeOptions,
  initialEmployeeId,
  initialContractId,
  breakdownView,
  detail,
  transactions,
  breakdown,
  daysRemainingByTransactionId,
  canEditLeave,
  canDeleteLeave,
}: LeaveTransactionsDirectoryClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<LeaveTransactionListRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const employeeComboboxOptions = useMemo(() => toEmployeeFilterOptions(employeeOptions), [employeeOptions]);

  const selectedEmployee = useMemo(
    () => employeeOptions.find((e) => e.id === initialEmployeeId) ?? null,
    [employeeOptions, initialEmployeeId],
  );

  const contractChoices = selectedEmployee?.contracts ?? [];

  const setQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      router.push(qs ? `/leave/transactions?${qs}` : `/leave/transactions`);
    },
    [router, searchParams],
  );

  const filterOpts = useMemo(() => ({ leaveType: leaveTypeFilter }), [leaveTypeFilter]);

  const filteredTransactions = useMemo(() => {
    let rows = transactions;
    if (initialContractId && detail) {
      rows = rows.filter((tx) => transactionMatchesContractRow(tx, initialContractId, detail));
    }
    return rows.filter((tx) => rowMatchesFilters(tx, filterOpts));
  }, [transactions, initialContractId, detail, filterOpts]);

  const filteredBreakdownYears = useMemo(() => {
    if (!breakdown) return [];
    return filterBreakdownYears(breakdown.contractYears, filterOpts);
  }, [breakdown, filterOpts]);

  const hasActiveFilters = Boolean(leaveTypeFilter);

  const summaryFromFilteredBreakdown = useMemo(() => {
    if (!breakdown) return null;
    if (!hasActiveFilters) return breakdown.summary;
    const flat = filteredBreakdownYears.flatMap((y) => y.transactions);
    const vacationTaken = Number(
      flat
        .filter((t) => t.leaveTypeRaw === "vacation" || t.leaveTypeRaw === "casual")
        .reduce((s, t) => s + t.daysTakenNum, 0)
        .toFixed(2),
    );
    const sickTaken = Number(
      flat.filter((t) => t.leaveTypeRaw === "sick").reduce((s, t) => s + t.daysTakenNum, 0).toFixed(2),
    );
    const generalTaken = Number(
      flat
        .filter((t) => t.leaveTypeRaw !== "vacation" && t.leaveTypeRaw !== "casual" && t.leaveTypeRaw !== "sick")
        .reduce((s, t) => s + t.daysTakenNum, 0)
        .toFixed(2),
    );
    return {
      vacationTaken,
      sickTaken,
      generalTaken,
      vacationRemaining: breakdown.summary.vacationRemaining,
      sickRemaining: breakdown.summary.sickRemaining,
      generalRemaining: breakdown.summary.generalRemaining,
    };
  }, [breakdown, filteredBreakdownYears, hasActiveFilters]);

  const displaySummary = summaryFromFilteredBreakdown ?? breakdown?.summary;

  const showBreakdownLayout = breakdownView && Boolean(initialEmployeeId && initialContractId && breakdown);
  const breakdownMissing =
    breakdownView && Boolean(initialEmployeeId && initialContractId) && !breakdown && Boolean(detail);
  const breakdownNeedsContract = breakdownView && Boolean(initialEmployeeId) && !initialContractId;

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

  const clearFilters = () => {
    setLeaveTypeFilter("");
  };

  const showRowActions = canEditLeave || canDeleteLeave;

  const viewModeDescription =
    !initialEmployeeId
      ? null
      : breakdownView && initialContractId
        ? "Breakdown view — running balances grouped by contractual year."
        : initialContractId
          ? "Standard view — sortable transaction table for the selected filters."
          : "Standard view — select a contract period to switch to breakdown.";

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(180px,1.2fr)_minmax(180px,1.2fr)_minmax(150px,0.8fr)_auto] items-end">
          <div className="space-y-2">
            <Label>Employee</Label>
            <EmployeeCombobox
              options={employeeComboboxOptions}
              value={initialEmployeeId}
              onChange={(id) => {
                setQuery({ employeeId: id || null, contractId: null, view: null, from: null });
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Contract period</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              value={initialContractId}
              onChange={(e) => {
                const v = e.target.value;
                setQuery({ contractId: v || null, view: v && breakdownView ? "breakdown" : null });
              }}
              disabled={!initialEmployeeId || contractChoices.length === 0}
            >
              <option value="">All contracts</option>
              {contractChoices.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.contractNumber ? `Contract #${c.contractNumber}` : "Contract"} ·{" "}
                  {formatDateLabel(c.startDate)} – {formatDateLabel(c.endDate)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Leave type</Label>
            <select
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              value={leaveTypeFilter}
              onChange={(e) => setLeaveTypeFilter(e.target.value)}
            >
              <option value="">All types</option>
              {LEAVE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex w-full lg:w-auto lg:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full lg:w-auto"
              onClick={clearFilters}
            >
              Clear filters
            </Button>
          </div>
        </div>
      </div>

      {viewModeDescription ? (
        <p className="text-muted-foreground text-sm leading-relaxed" role="status">
          {viewModeDescription}
        </p>
      ) : null}

      {showBreakdownLayout && breakdown && displaySummary ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <SummaryCard title="Vacation leave taken" value={`${displaySummary.vacationTaken} days`} />
            <SummaryCard
              title="Vacation leave remaining"
              value={displaySummary.vacationRemaining !== null ? `${displaySummary.vacationRemaining} days` : "—"}
            />
            <SummaryCard title="Sick leave taken" value={`${displaySummary.sickTaken} days`} />
            <SummaryCard
              title="Sick leave remaining"
              value={displaySummary.sickRemaining !== null ? `${displaySummary.sickRemaining} days` : "—"}
            />
            <SummaryCard title="General leave taken" value={`${displaySummary.generalTaken} days`} />
            <SummaryCard
              title="General leave remaining"
              value={
                displaySummary.generalRemaining !== null && displaySummary.generalRemaining !== undefined
                  ? `${displaySummary.generalRemaining} days`
                  : "—"
              }
            />
          </div>

          {filteredBreakdownYears.length === 0 ? (
            <EmptyState title="No transactions match the current filters." />
          ) : (
            filteredBreakdownYears.map((block) => (
              <div key={block.yearNumber} className="space-y-3 rounded-xl border border-border p-4">
                <h3 className="text-sm font-semibold">{block.heading}</h3>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave period</TableHead>
                        <TableHead>Leave type</TableHead>
                        <TableHead>Days used</TableHead>
                        <TableHead>Days remaining</TableHead>
                        <TableHead>Contract Year</TableHead>
                        {showRowActions ? (
                          <TableHead className="text-right">Actions</TableHead>
                        ) : null}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {block.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell className="whitespace-nowrap">{tx.leavePeriod}</TableCell>
                          <TableCell>{tx.leaveTypeLabel}</TableCell>
                          <TableCell>{tx.daysTaken}</TableCell>
                          <TableCell>{tx.balanceAfter ?? "—"}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {formatContractYearLabel(block.yearNumber)}
                          </TableCell>
                          {showRowActions ? (
                            <TableCell className="text-right">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                {canEditLeave ? (
                                  <Link
                                    href={`/leave/transactions/${tx.id}/edit`}
                                    className={buttonVariants({
                                      variant: "outline",
                                      size: "sm",
                                      className:
                                        "inline-flex h-9 min-w-[72px] items-center justify-center",
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
                                    className="h-9 min-w-[72px] justify-center"
                                    onClick={() => {
                                      const match = transactions.find((r) => r.id === tx.id);
                                      if (match) setDeleteTarget(match);
                                    }}
                                  >
                                    Delete
                                  </Button>
                                ) : null}
                              </div>
                            </TableCell>
                          ) : null}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ))
          )}
        </>
      ) : null}

      {breakdownNeedsContract ? (
        <EmptyState
          title="Select a contract period"
          description="Choose a contract in the Contract period filter to view the breakdown."
        />
      ) : null}

      {breakdownMissing ? (
        <EmptyState
          title="Breakdown unavailable"
          description="Could not load leave breakdown for this contract. Check that the contract belongs to the employee."
        />
      ) : null}

      {!breakdownView && initialEmployeeId && detail ? (
        <>
          {filteredTransactions.length === 0 ? (
            <EmptyState title="No leave transactions match the current filters." />
          ) : (
            <LeaveTransactionsTableClient
              transactions={filteredTransactions}
              contractYearContracts={detail?.contracts ?? null}
              daysRemainingByTransactionId={daysRemainingByTransactionId}
              canEditLeave={canEditLeave}
              canDeleteLeave={canDeleteLeave}
            />
          )}
        </>
      ) : null}

      {!initialEmployeeId ? (
        <EmptyState title="Select an employee" description="Choose an employee to load leave transactions." />
      ) : null}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Leave Record"
        description={
          deleteTarget
            ? "This will remove the leave record and recalculate the employee’s leave balance. This action should only be used to correct an incorrect record."
            : ""
        }
        confirmLabel="Delete Leave Record"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        pending={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
