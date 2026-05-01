import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AddLeaveForm } from "@/components/leave/add-leave-form";
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
import { getLeaveEmployeeOptions } from "@/lib/server/leave";

export const metadata: Metadata = {
  title: "Add Leave",
};

export default async function AddLeavePage({
  searchParams,
}: {
  searchParams?: Promise<{ employeeId?: string; contractId?: string }>;
}) {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (isViewerRole(session.user?.role)) {
    redirect(`/leave?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "leave.create")) {
    redirect(redirectTargetForDeniedWriteRoute(role, "/leave"));
  }

  const employees = await getLeaveEmployeeOptions();
  const params = (await searchParams) ?? {};
  const initialEmployeeId = params.employeeId?.trim() || "";
  const initialContractId = params.contractId?.trim() || "";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Leave", href: "/leave" },
          { label: "Add Leave" },
        ]}
        backFallbackHref="/leave"
        title="Add Leave"
        icon="calendar-plus"
        description="Record leave taken by an employee."
      />
      <AddLeaveForm
        employees={employees}
        initialEmployeeId={initialEmployeeId}
        initialContractId={initialContractId}
      />
    </div>
  );
}
