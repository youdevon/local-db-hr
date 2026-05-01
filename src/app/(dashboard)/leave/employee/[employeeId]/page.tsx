import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { EmptyState } from "@/components/empty-state";
import { LeaveBalanceManagement } from "@/components/leave/leave-balance-management";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { buttonVariants } from "@/components/ui/button";
import { LeaveDetailTransactionsTable } from "@/components/leave/leave-detail-transactions-table";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole, VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE } from "@/lib/roles";
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

  const detail = await getLeaveDetailByEmployee(employeeId);
  if (!detail) notFound();

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

      <SectionCard title="Employee Summary">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>Employee name: {detail.employee.fullName}</p>
          <p>File #: {detail.employee.fileNumber}</p>
          <p>Department: {detail.employee.department}</p>
          <p>Position: {detail.employee.position}</p>
          <p>Current/latest contract period: {detail.latestContractPeriod}</p>
          <p>Contract status: {detail.latestContractStatus}</p>
        </div>
      </SectionCard>

      <SectionCard
        title="Leave Balance by Contract Period"
        headerActions={
          canCreateLeave || canEditLeave ? (
            <div className="flex flex-wrap gap-3">
              {canCreateLeave ? (
                <Link
                  href={`/leave/new?employeeId=${encodeURIComponent(detail.employee.id)}${detail.currentContractId ? `&contractId=${encodeURIComponent(detail.currentContractId)}` : ""}`}
                  className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}
                >
                  Add Leave
                </Link>
              ) : null}
              {canEditLeave ? (
                <Link
                  href={`/leave/employee/${detail.employee.id}/transactions`}
                  className={buttonVariants({ variant: "outline", className: "h-10 rounded-md text-sm font-medium" })}
                >
                  Edit Leave
                </Link>
              ) : null}
            </div>
          ) : null
        }
      >
        {detail.contracts.length === 0 ? (
          <EmptyState title="No contract periods found." description="Create a contract before calculating leave balances." />
        ) : (
          <LeaveBalanceManagement contracts={detail.contracts} />
        )}
      </SectionCard>

      <SectionCard title="Leave Transactions">
        {detail.transactions.length === 0 ? (
          <EmptyState title="No leave transactions recorded." />
        ) : (
          <LeaveDetailTransactionsTable rows={detail.transactions} />
        )}
      </SectionCard>
    </div>
  );
}
