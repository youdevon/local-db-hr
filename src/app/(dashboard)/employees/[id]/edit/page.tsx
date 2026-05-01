import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

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
import {
  employeeRecordToFormValues,
  getFullName,
} from "@/lib/mock/employees";
import { getEmployeeForUiById } from "@/lib/server/hr";
import { getEmployeesForUi } from "@/lib/server/hr";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployeeForUiById(id);
  const name = employee ? getFullName(employee) : "Employee";
  return {
    title: `Edit · ${name}`,
  };
}

export default async function EditEmployeePage({ params }: Props) {
  const { id } = await params;
  const user = await requireUser();
  const role = normalizeUserRole(user.role);
  if (isViewerRole(user.role)) {
    redirect(`/employees/${id}?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "employees.edit")) {
    redirect(redirectTargetForDeniedWriteRoute(role, `/employees/${id}`));
  }

  const [employee, existingEmployees] = await Promise.all([getEmployeeForUiById(id), getEmployeesForUi()]);
  if (!employee) notFound();

  const displayName = getFullName(employee);
  const initialValues = employeeRecordToFormValues(employee);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Employees", href: "/employees" },
          { label: displayName, href: `/employees/${id}` },
          { label: "Edit" },
        ]}
        backFallbackHref={`/employees/${id}`}
        title="Edit Employee"
        icon="user-round-pen"
        description="Update employee bio-data and identification records."
      />
      <EmployeeForm mode="edit" employeeId={id} initialValues={initialValues} existingEmployees={existingEmployees} />
    </div>
  );
}
