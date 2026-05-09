"use client";

import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getLeaveContractUiStatus } from "@/lib/leave-contract-ui-status";

/** Contract-specific row when the Leave Transactions page is scoped to exactly one contract. */
export type LeaveEmployeeSummaryContractFilter = {
  contractPeriod: string;
  contractStatusRaw: string;
  minuteNumber: string;
  contractNumber: string;
  /** When set (e.g. Leave Transactions), overrides raw status mapping using date-aware resolution. */
  resolvedStatus?: { label: string; tone: StatusTone };
};

export type LeaveEmployeeSummaryCardProps = {
  employeeId: string;
  fullName: string;
  employeeNumber: string;
  department: string;
  position: string;
  /** Required when `showTransactionsButton` is true (e.g. Leave Detail page). */
  transactionsHref?: string;
  transactionsLabel?: string;
  transactionsAriaLabel?: string;
  transactionsTitle?: string;
  /**
   * When set (e.g. `contractId` query on Leave Transactions), show contract period, status,
   * minute number, and contract number for that contract only. Omit on employee-level pages.
   */
  contractFilter?: LeaveEmployeeSummaryContractFilter | null;
  /**
   * When true (Leave Transactions, no contract selected), show aggregate placeholders instead of
   * a single contract’s minute/contract numbers.
   */
  allContractsInScope?: boolean;
  /** When false, omit the transactions action row (e.g. if shown elsewhere). */
  showTransactionsButton?: boolean;
  className?: string;
};

export function LeaveEmployeeSummaryCard({
  employeeId,
  fullName,
  employeeNumber,
  department,
  position,
  transactionsHref,
  transactionsLabel,
  transactionsAriaLabel,
  transactionsTitle,
  contractFilter,
  allContractsInScope = false,
  showTransactionsButton = true,
  className,
}: LeaveEmployeeSummaryCardProps) {
  const status = contractFilter?.resolvedStatus
    ? { label: contractFilter.resolvedStatus.label, tone: contractFilter.resolvedStatus.tone }
    : contractFilter
      ? getLeaveContractUiStatus(contractFilter.contractStatusRaw)
      : null;
  const periodDisplay = contractFilter?.contractPeriod.replace(/\s*–\s*/g, " to ");

  return (
    <div className={cn("space-y-6 text-sm", className)}>
      <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="min-w-0 space-y-1 sm:col-span-2 lg:col-span-1">
          <p className="text-muted-foreground">Employee name</p>
          <Link
            href={`/employees/${employeeId}`}
            className="font-heading text-xl font-bold tracking-tight text-slate-900 underline-offset-4 hover:text-primary hover:underline dark:text-slate-100"
          >
            {fullName}
          </Link>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Employee Number</p>
          <p className="font-medium text-foreground">{employeeNumber}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Position</p>
          <p className="font-medium text-foreground">{position}</p>
        </div>
        <div className="space-y-1">
          <p className="text-muted-foreground">Department</p>
          <p className="font-medium text-foreground">{department}</p>
        </div>

        {allContractsInScope ? (
          <>
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <p className="text-muted-foreground">Contract Period</p>
              <p className="font-medium text-foreground">All contract periods</p>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-muted-foreground shrink-0">Contract Status</p>
              <p className="font-medium text-foreground">Multiple / Not selected</p>
            </div>
          </>
        ) : null}

        {contractFilter && status && periodDisplay && !allContractsInScope ? (
          <>
            <div className="space-y-1 sm:col-span-2 lg:col-span-2">
              <p className="text-muted-foreground">Contract Period</p>
              <p className="font-medium text-foreground">{periodDisplay}</p>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
              <p className="text-muted-foreground shrink-0">Contract Status</p>
              <StatusBadge tone={status.tone as StatusTone}>{status.label}</StatusBadge>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Minute Number</p>
              <p className="font-medium text-foreground">{contractFilter.minuteNumber}</p>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground">Contract Number</p>
              <p className="font-medium text-foreground">{contractFilter.contractNumber}</p>
            </div>
          </>
        ) : null}
      </div>

      {showTransactionsButton && transactionsHref ? (
        <div className="flex flex-wrap gap-3 border-t border-border pt-6">
          <Link
            href={transactionsHref}
            className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}
            aria-label={transactionsAriaLabel ?? transactionsLabel ?? "Leave transactions"}
            title={transactionsTitle}
          >
            {transactionsLabel ?? "Transactions"}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
