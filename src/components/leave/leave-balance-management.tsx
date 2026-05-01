"use client";

import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getLeaveStatusTone } from "@/lib/leave-balances";
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
}: {
  contracts: LeaveContractView[];
}) {
  function remainingTone(status: "Healthy" | "Low" | "Exhausted" | "Overused") {
    if (status === "Low") return "bg-amber-50 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200";
    if (status === "Exhausted") return "bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200";
    if (status === "Overused") return "bg-red-100 text-red-900 dark:bg-red-900/60 dark:text-red-100";
    return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200";
  }

  return (
    <div className="space-y-4">
      {contracts.map((contract) => (
        <div key={contract.contractId} className="rounded-xl border border-border p-4">
          <div className="mb-3 grid gap-2 text-sm md:grid-cols-2">
            <p>Minute #: {contract.minuteNumber}</p>
            <p>Contract #: {contract.contractNumber}</p>
            <p>Contract period: {contract.contractPeriod}</p>
            <p>Status: {contract.status}</p>
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
      ))}
    </div>
  );
}
