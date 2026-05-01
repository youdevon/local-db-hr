import type { Metadata } from "next";
import { AgeMonitoringClient } from "./page-client";
import { getSession } from "@/lib/get-session";
import { canCreateEmployees } from "@/lib/roles";
import { getEmployeesForUi } from "@/lib/server/hr";
import { toDirectoryRow } from "@/lib/employees-directory";

export const metadata: Metadata = {
  title: "Age Monitoring",
};

export default async function AgeMonitoringPage() {
  const session = await getSession();
  const canCreateEmployee = canCreateEmployees(session.user?.role ?? null);

  const employees = await getEmployeesForUi();
  const rows = employees.map(toDirectoryRow);
  return <AgeMonitoringClient allRows={rows} canCreateEmployee={canCreateEmployee} />;
}
