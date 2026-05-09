import type { Metadata } from "next";
import { AgeMonitoringClient } from "./page-client";
import { getSession } from "@/lib/get-session";
import { canCreateEmployees } from "@/lib/roles";
import { getEmployeesForUi } from "@/lib/server/hr";
import { toDirectoryRow } from "@/lib/employees-directory";
import { getRetirementAge } from "@/lib/retirement-policy-settings";

export const metadata: Metadata = {
  title: "Age Monitoring",
};

export default async function AgeMonitoringPage() {
  const session = await getSession();
  const canCreateEmployee = canCreateEmployees(session.user?.role ?? null);

  const [employees, retirementAge] = await Promise.all([
    getEmployeesForUi(),
    getRetirementAge(),
  ]);
  const rows = employees.map(toDirectoryRow);
  return <AgeMonitoringClient allRows={rows} canCreateEmployee={canCreateEmployee} retirementAge={retirementAge} />;
}
