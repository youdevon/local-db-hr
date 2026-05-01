import type { Metadata } from "next";

import { EmployeeDirectoryClient } from "./page-client";
import { getSession } from "@/lib/get-session";
import { canCreateEmployees } from "@/lib/roles";
import { getEmployeesForUi } from "@/lib/server/hr";
import { toDirectoryRow } from "@/lib/employees-directory";

export const metadata: Metadata = {
  title: "Employee Directory",
};

export default async function EmployeeDirectoryPage() {
  const session = await getSession();
  const canCreateEmployee = canCreateEmployees(session.user?.role ?? null);

  const employees = await getEmployeesForUi();
  const rows = employees.map(toDirectoryRow);
  return <EmployeeDirectoryClient allRows={rows} canCreateEmployee={canCreateEmployee} />;
}
