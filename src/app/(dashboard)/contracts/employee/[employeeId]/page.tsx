import type { Metadata } from "next";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { EmployeeContractHistoryClient } from "./history-client";
import { FileText } from "lucide-react";
import { getEmployeeContractHistoryForUi } from "@/lib/server/hr";

type Props = { params: Promise<{ employeeId: string }> };

export const metadata: Metadata = {
  title: "Employee Contract History",
};

export default async function EmployeeContractHistoryPage({ params }: Props) {
  const { employeeId } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canCreateContract = canPerformAction(role, "contracts.create");

  const { employee, contracts } = await getEmployeeContractHistoryForUi(employeeId);

  if (!employee) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Contracts", href: "/contracts" },
            { label: "Employee Contract History" },
          ]}
          backFallbackHref="/contracts"
          title="Employee Contract History"
          icon="history"
          description="View all contracts issued to this employee over time."
        />
        <EmptyState icon={FileText} title="Employee not found." description="" />
      </div>
    );
  }

  return (
    <EmployeeContractHistoryClient
      employeeId={employeeId}
      employee={employee}
      contracts={contracts}
      canCreateContract={canCreateContract}
    />
  );
}
