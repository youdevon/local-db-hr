"use client";

import Link from "next/link";

import { StatusBadge, type StatusTone } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaveStatusTone } from "@/lib/leave-balances";
import { getLeaveContractUiStatus } from "@/lib/leave-contract-ui-status";
import { formatDateLabel } from "@/lib/leave";
type LeaveContractView = {
  contractId: string;
  minuteNumber: string;
  contractNumber: string;
  contractPeriod: string;
  status: string;
  years: Array<{
    yearNumber: number;
    startDate: string;
    endDate: string;
    vacation: {
      entitlement: string;
      rolloverIn: string;
      adjustment: string;
      usedVacation: string;
      usedCasual: string;
      usedTotal: string;
      remaining: string;
      status: "Healthy" | "Low" | "Exhausted" | "Overused";
      isCurrentYear?: boolean;
    };
    sick: {
      entitlement: string;
      rolloverIn: string;
      adjustment: string;
      used: string;
      remaining: string;
      status: "Healthy" | "Low" | "Exhausted" | "Overused";
      isCurrentYear?: boolean;
    };
    isCurrentYear?: boolean;
  }>;
};

export function LeaveBalanceManagement({
  contracts,
  employeeId,
}: {
  contracts: LeaveContractView[];
  employeeId?: string;
}) {
  function remainingTone(status: "Healthy" | "Low" | "Exhausted" | "Overused") {
    if (status === "Low") return "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    if (status === "Exhausted") return "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200";
    if (status === "Overused") return "bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100";
    return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => {
        const contractUi = getLeaveContractUiStatus(contract.status);
        return (
        <div key={contract.contractId} className="rounded-xl border border-border p-4">
          <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="grid flex-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <p>
                <span className="text-muted-foreground">Contract Period: </span>
                <span className="font-medium text-foreground">{contract.contractPeriod}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-muted-foreground">Contract Status</span>
                <StatusBadge tone={contractUi.tone as StatusTone}>{contractUi.label}</StatusBadge>
              </div>
              <p>
                <span className="text-muted-foreground">Minute Number: </span>
                <span className="font-medium text-foreground">{contract.minuteNumber}</span>
              </p>
              <p>
                <span className="text-muted-foreground">Contract Number: </span>
                <span className="font-medium text-foreground">{contract.contractNumber}</span>
              </p>
            </div>
            {employeeId ? (
              <Link
                href={`/leave/transactions?employeeId=${encodeURIComponent(employeeId)}&contractId=${encodeURIComponent(contract.contractId)}&view=breakdown`}
                className={buttonVariants({ variant: "outline", className: "h-9 shrink-0 rounded-md text-xs font-medium" })}
                aria-label="Open leave transactions breakdown for this contract period"
                title="View leave taken by contractual year with balances for this contract period"
              >
                View Breakdown
              </Link>
            ) : null}
          </div>

          <div className="space-y-3">
            {contract.years.map((year) => (
              <div key={`${contract.contractId}-y${year.yearNumber}`} className="rounded-xl border border-border/70">
                <div className="border-b border-border/70 px-4 py-3 text-sm font-medium">
                  <div className="flex items-center gap-2">
                    <span>
                      Contract Year {year.yearNumber}: {formatDateLabel(year.startDate)} – {formatDateLabel(year.endDate)}
                    </span>
                    {year.isCurrentYear ? (
                      <StatusBadge tone="default" className="rounded-md px-2 py-0.5">Current Year</StatusBadge>
                    ) : null}
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead>Entitlement</TableHead>
                      <TableHead>Rollover In</TableHead>
                      <TableHead>Adjustment</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Remaining</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell>Vacation / Casual</TableCell>
                      <TableCell>{year.vacation.entitlement}</TableCell>
                      <TableCell>{year.vacation.rolloverIn}</TableCell>
                      <TableCell>{year.vacation.adjustment}</TableCell>
                      <TableCell>
                        {year.vacation.usedTotal}
                        <span className="text-muted-foreground ml-1 text-xs">
                          (Vacation: {year.vacation.usedVacation}, Casual: {year.vacation.usedCasual})
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${remainingTone(year.vacation.status)}`}>
                          {year.vacation.remaining}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={getLeaveStatusTone(year.vacation.status)}>
                          {year.vacation.status}
                        </StatusBadge>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell>Sick</TableCell>
                      <TableCell>{year.sick.entitlement}</TableCell>
                      <TableCell>{year.sick.rolloverIn}</TableCell>
                      <TableCell>{year.sick.adjustment}</TableCell>
                      <TableCell>{year.sick.used}</TableCell>
                      <TableCell>
                        <span className={`rounded-md px-2 py-1 text-xs font-medium ${remainingTone(year.sick.status)}`}>
                          {year.sick.remaining}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge tone={getLeaveStatusTone(year.sick.status)}>{year.sick.status}</StatusBadge>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </div>
  );
}
