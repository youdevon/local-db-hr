import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { EmptyState } from "@/components/empty-state";
import { LeaveBalanceManagement } from "@/components/leave/leave-balance-management";
import { LeaveEmployeeSummaryCard } from "@/components/leave/leave-employee-summary-card";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import {
  canPerformAction,
  isViewerRole,
  normalizeUserRole,
  VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE,
} from "@/lib/roles";
import { getLeaveDetailByEmployee } from "@/lib/server/leave";

export const metadata: Metadata = {
  title: "Leave Detail",
};

export default async function LeaveEmployeeDetailPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canCreateLeave = canPerformAction(role, "leave.create");
  const canEditLeave = canPerformAction(role, "leave.edit");
  const canViewLeaveTransactions = canPerformAction(role, "leave.view");
  const isViewer = isViewerRole(session.user?.role);
  const leaveTransactionsLabel = isViewer || !canEditLeave ? "View Transactions" : "Manage Transactions";
  const leaveTransactionsAriaLabel =
    isViewer || !canEditLeave
      ? "View leave transactions for this employee"
      : "Manage leave transactions for this employee";
  const leaveTransactionsTitle =
    isViewer || !canEditLeave
      ? "Open the leave transactions list for this employee"
      : "Open the leave transactions page to review or edit records for this employee";

  const detail = await getLeaveDetailByEmployee(employeeId);
  if (!detail) notFound();

  const transactionsParams = new URLSearchParams();
  transactionsParams.set("employeeId", detail.employee.id);
  transactionsParams.set("from", "employee-details");
  if (detail.currentContractId != null) {
    transactionsParams.set("contractId", detail.currentContractId);
    transactionsParams.set("view", "breakdown");
  }
  const transactionsHref = `/leave/transactions?${transactionsParams.toString()}`;

  const addLeaveHref = `/leave/new?employeeId=${encodeURIComponent(detail.employee.id)}${
    detail.currentContractId ? `&contractId=${encodeURIComponent(detail.currentContractId)}` : ""
  }`;

  const showLeaveActionsRow = canCreateLeave || canViewLeaveTransactions;

  return (
    <div className="space-y-6">
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Leave", href: "/leave" },
          { label: "Leave Detail" },
        ]}
        backFallbackHref="/leave"
        title="Leave Detail"
        icon="calendar-clock"
        description="Review leave entitlement, usage, and remaining balances by contract period."
      />

      {showLeaveActionsRow ? (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-2">
          {canCreateLeave ? (
            <Link href={addLeaveHref} className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>
              Add Leave
            </Link>
          ) : null}
          {canViewLeaveTransactions ? (
            <Link
              href={transactionsHref}
              className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}
              aria-label={leaveTransactionsAriaLabel}
              title={leaveTransactionsTitle}
            >
              {leaveTransactionsLabel}
            </Link>
          ) : null}
        </div>
      ) : null}

      <SectionCard title="Employee Summary">
        <LeaveEmployeeSummaryCard
          employeeId={detail.employee.id}
          fullName={detail.employee.fullName}
          employeeNumber={detail.employee.fileNumber}
          department={detail.employee.department}
          position={detail.employee.position}
          showTransactionsButton={false}
        />
      </SectionCard>

      <SectionCard title="Leave Balance by Contract Period">
        {detail.contracts.length === 0 ? (
          <EmptyState title="No contract periods found." description="Create a contract before calculating leave balances." />
        ) : (
          <LeaveBalanceManagement contracts={detail.contracts} employeeId={detail.employee.id} />
        )}
      </SectionCard>
    </div>
  );
}
