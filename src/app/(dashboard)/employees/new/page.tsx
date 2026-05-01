import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { EmployeeForm } from "@/components/employees/employee-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth-server";
import {
  canPerformAction,
  isViewerRole,
  normalizeUserRole,
  redirectTargetForDeniedWriteRoute,
  VIEW_ONLY_ERROR_PARAM,
  VIEW_ONLY_ERROR_VALUE,
} from "@/lib/roles";
import { getEmployeesForUi } from "@/lib/server/hr";

export const metadata: Metadata = {
  title: "New Employee",
};

export default async function NewEmployeePage() {
  const user = await requireUser();
  const role = normalizeUserRole(user.role);
  if (isViewerRole(user.role)) {
    redirect(`/employees?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "employees.create")) {
    redirect(redirectTargetForDeniedWriteRoute(role, "/employees"));
  }

  const existingEmployees = await getEmployeesForUi();
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Employees", href: "/employees" },
          { label: "New Employee" },
        ]}
        backFallbackHref="/employees"
        title="New Employee"
        icon="user-plus"
        description="Create a new employee bio-data record."
      />
      <EmployeeForm mode="create" existingEmployees={existingEmployees} />
    </div>
  );
}
