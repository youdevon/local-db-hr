import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { EditLeaveTransactionForm } from "@/components/leave/edit-leave-transaction-form";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/get-session";
import {
  canPerformAction,
  isViewerRole,
  normalizeUserRole,
  redirectTargetForDeniedWriteRoute,
  VIEW_ONLY_ERROR_PARAM,
  VIEW_ONLY_ERROR_VALUE,
} from "@/lib/roles";
import { getLeaveTransactionForEdit } from "@/lib/server/leave";

export const metadata: Metadata = {
  title: "Edit Leave",
};

export default async function EditLeaveTransactionPage({
  params,
}: {
  params: Promise<{ leaveTransactionId: string }>;
}) {
  const { leaveTransactionId } = await params;
  const transaction = await getLeaveTransactionForEdit(leaveTransactionId);
  if (!transaction) notFound();

  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (isViewerRole(session.user?.role)) {
    redirect(
      `/leave/employee/${transaction.employeeId}?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`,
    );
  }
  if (!canPerformAction(role, "leave.edit")) {
    redirect(
      redirectTargetForDeniedWriteRoute(role, `/leave/employee/${transaction.employeeId}/transactions`),
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Leave", href: "/leave" },
          { label: "Leave Transactions", href: `/leave/employee/${transaction.employeeId}/transactions` },
          { label: "Edit Leave" },
        ]}
        backFallbackHref={`/leave/employee/${transaction.employeeId}/transactions`}
        title="Edit Leave"
        icon="calendar-clock"
        description="Correct leave type, dates, return date, days used, status, or notes."
      />
      <EditLeaveTransactionForm transaction={transaction} />
    </div>
  );
}
