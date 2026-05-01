import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CalendarDays } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { LeaveTransactionsTableClient } from "@/components/leave/leave-transactions-table-client";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getLeaveDetailByEmployee, getLeaveTransactionsForEmployee } from "@/lib/server/leave";

export const metadata: Metadata = {
  title: "Leave Transactions",
};

export default async function LeaveTransactionsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canCreateLeave = canPerformAction(role, "leave.create");
  const canEditLeave = canPerformAction(role, "leave.edit");
  const canDeleteLeave = canPerformAction(role, "leave.delete");

  const [detail, transactions] = await Promise.all([
    getLeaveDetailByEmployee(employeeId),
    getLeaveTransactionsForEmployee(employeeId),
  ]);
  if (!detail) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Leave", href: "/leave" },
          { label: "Leave Transactions" },
        ]}
        backFallbackHref={`/leave/employee/${employeeId}`}
        title="Leave Transactions"
        icon="calendar-days"
        description="Review, edit, or delete leave records for this employee."
        actions={
          canCreateLeave ? (
            <Link
              href={`/leave/new?employeeId=${encodeURIComponent(employeeId)}`}
              className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}
            >
              Add Leave
            </Link>
          ) : null
        }
      />

      <SectionCard title="Employee Summary">
        <div className="grid gap-2 text-sm md:grid-cols-2">
          <p>Employee name: {detail.employee.fullName}</p>
          <p>File #: {detail.employee.fileNumber}</p>
          <p>Current/latest contract period: {detail.latestContractPeriod}</p>
          <p>Current position: {detail.employee.position}</p>
        </div>
      </SectionCard>

      {transactions.length === 0 ? (
        <EmptyState icon={CalendarDays} title="No leave transactions recorded." />
      ) : (
        <LeaveTransactionsTableClient
          transactions={transactions}
          canEditLeave={canEditLeave}
          canDeleteLeave={canDeleteLeave}
        />
      )}
    </div>
  );
}
