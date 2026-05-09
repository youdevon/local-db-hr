import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LeaveEmployeeSummaryCard } from "@/components/leave/leave-employee-summary-card";
import type { StatusTone } from "@/components/status-badge";
import { LeaveTransactionsDirectoryClient } from "@/components/leave/leave-transactions-directory-client";
import { LeaveTransactionsPageActions } from "@/components/leave/leave-transactions-page-actions";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { Skeleton } from "@/components/ui/skeleton";
import { getSession } from "@/lib/get-session";
import {
  getContractIsoBoundsFromLeaveDetailContract,
  resolveLeaveTransactionsContractStatus,
} from "@/lib/leave-selected-contract-status";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getLeaveDetailByEmployee, getLeaveEmployeeOptions, getLeaveTransactionsForEmployee } from "@/lib/server/leave";
import {
  getLeaveTransactionBreakdownForContract,
  getLeaveTransactionDaysRemainingById,
} from "@/lib/server/leave-transaction-breakdown";

export async function generateMetadata({
  searchParams: _searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}): Promise<Metadata> {
  return { title: "Leave Transactions" };
}

export default async function LeaveTransactionsDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const employeeIdRaw = params.employeeId;
  const contractIdRaw = params.contractId;
  const viewRaw = params.view;
  const fromRaw = params.from;

  const employeeId = (Array.isArray(employeeIdRaw) ? employeeIdRaw[0] : employeeIdRaw)?.trim() ?? "";
  const contractId = (Array.isArray(contractIdRaw) ? contractIdRaw[0] : contractIdRaw)?.trim() ?? "";
  const view = (Array.isArray(viewRaw) ? viewRaw[0] : viewRaw)?.trim() ?? "";
  const fromParam = (Array.isArray(fromRaw) ? fromRaw[0] : fromRaw)?.trim() ?? "";
  const breakdownView = view === "breakdown";
  const fromEmployeeDetails = fromParam === "employee-details";

  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canCreateLeave = canPerformAction(role, "leave.create");
  const canEditLeave = canPerformAction(role, "leave.edit");
  const canDeleteLeave = canPerformAction(role, "leave.delete");

  const [employeeOptions, detail, transactions, breakdown] = await Promise.all([
    getLeaveEmployeeOptions(),
    employeeId ? getLeaveDetailByEmployee(employeeId) : Promise.resolve(null),
    employeeId ? getLeaveTransactionsForEmployee(employeeId) : Promise.resolve([]),
    breakdownView && employeeId && contractId
      ? getLeaveTransactionBreakdownForContract(employeeId, contractId)
      : Promise.resolve(null),
  ]);

  const daysRemainingByTransactionId =
    employeeId && detail ? await getLeaveTransactionDaysRemainingById(employeeId, detail) : {};

  if (employeeId && !detail) {
    notFound();
  }

  const selectedContract =
    contractId && detail ? detail.contracts.find((c) => c.contractId === contractId) : undefined;

  const resolvedContractFilter =
    detail && selectedContract
      ? (() => {
          const { startIso, endIso } = getContractIsoBoundsFromLeaveDetailContract(selectedContract);
          const resolved = resolveLeaveTransactionsContractStatus(selectedContract.status, startIso, endIso);
          return {
            contractPeriod: selectedContract.contractPeriod,
            contractStatusRaw: selectedContract.status,
            minuteNumber: selectedContract.minuteNumber,
            contractNumber: selectedContract.contractNumber,
            resolvedStatus: {
              label: resolved.label,
              tone: resolved.tone as StatusTone,
            },
          };
        })()
      : null;

  /** Stable header copy so switching Standard/Breakdown does not resize the heading block. */
  const subtitle = "Review leave transactions. Filter by employee, contract period, and leave type.";
  const title = "Leave Transactions";

  const backFallbackHref = employeeId ? `/leave/employee/${employeeId}` : "/leave";
  const backNavigateHref =
    fromEmployeeDetails && employeeId ? `/leave/employee/${employeeId}` : undefined;

  const breadcrumbItems =
    fromEmployeeDetails && employeeId
      ? [
          { label: "Leave", href: "/leave" },
          { label: "Employee", href: "/leave/employee" },
          { label: "Details", href: `/leave/employee/${employeeId}` },
          { label: "Transactions" },
        ]
      : [
          { label: "Dashboard", href: "/" },
          { label: "Leave", href: "/leave" },
          { label: "Leave Transactions" },
        ];

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={breadcrumbItems}
        backFallbackHref={backFallbackHref}
        backNavigateHref={backNavigateHref}
        title={title}
        icon="calendar-days"
        description={subtitle}
        actions={
          employeeId ? (
            <Suspense fallback={<Skeleton className="h-10 w-56 rounded-md" />}>
              <LeaveTransactionsPageActions
                employeeId={employeeId}
                contractId={contractId}
                breakdownView={breakdownView}
                canCreateLeave={canCreateLeave}
              />
            </Suspense>
          ) : null
        }
      />

      {employeeId && detail ? (
        <SectionCard title="Employee Summary">
          <LeaveEmployeeSummaryCard
            employeeId={detail.employee.id}
            fullName={detail.employee.fullName}
            employeeNumber={detail.employee.fileNumber}
            department={detail.employee.department}
            position={detail.employee.position}
            contractFilter={resolvedContractFilter}
            allContractsInScope={Boolean(!contractId)}
            showTransactionsButton={false}
          />
        </SectionCard>
      ) : null}

      <LeaveTransactionsDirectoryClient
        employeeOptions={employeeOptions}
        initialEmployeeId={employeeId}
        initialContractId={contractId}
        breakdownView={breakdownView}
        detail={detail}
        transactions={transactions}
        breakdown={breakdown}
        daysRemainingByTransactionId={daysRemainingByTransactionId}
        canEditLeave={canEditLeave}
        canDeleteLeave={canDeleteLeave}
      />
    </div>
  );
}
