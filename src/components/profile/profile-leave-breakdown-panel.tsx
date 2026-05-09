import { EmptyState } from "@/components/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SectionCard } from "@/components/section-card";
import { formatContractYearLabel } from "@/lib/leave-transaction-contract-year";
import type { LeaveTransactionBreakdownResult } from "@/lib/server/leave-transaction-breakdown";

function SummaryCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/80 bg-muted/20 px-4 py-3">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

export function ProfileLeaveBreakdownPanel({
  breakdown,
}: {
  breakdown: LeaveTransactionBreakdownResult | null;
}) {
  if (!breakdown) {
    return (
      <EmptyState
        title="No leave breakdown"
        description="Select a contract period above to view leave entitlement, usage, and transactions."
      />
    );
  }

  const s = breakdown.summary;

  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm">
        View-only leave summary and transactions for the selected contract. To request changes, contact HR.
      </p>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard title="Vacation leave taken" value={`${s.vacationTaken} days`} />
        <SummaryCard
          title="Vacation leave remaining"
          value={s.vacationRemaining !== null ? `${s.vacationRemaining} days` : "—"}
        />
        <SummaryCard title="Sick leave taken" value={`${s.sickTaken} days`} />
        <SummaryCard
          title="Sick leave remaining"
          value={s.sickRemaining !== null ? `${s.sickRemaining} days` : "—"}
        />
        <SummaryCard title="General leave taken" value={`${s.generalTaken} days`} />
        <SummaryCard
          title="General leave remaining"
          value={
            s.generalRemaining !== null && s.generalRemaining !== undefined ? `${s.generalRemaining} days` : "—"
          }
        />
      </div>

      {breakdown.contractYears.length === 0 ? (
        <EmptyState title="No leave transactions" description="No recorded leave for this contract in the system." />
      ) : (
        breakdown.contractYears.map((block) => (
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
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
