import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ContractForm } from "@/components/contracts/contract-form";
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
import { getRetirementAgePolicySettings } from "@/lib/retirement-policy-settings";
import { getGratuitySettings } from "@/lib/gratuity-settings";
import { getContractsForUi, getEmployeesForUi } from "@/lib/server/hr";
import { listNoteMonitorOptionsForContracts } from "@/lib/server/note-monitor";

export const metadata: Metadata = {
  title: "New Contract",
};

export default async function NewContractPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (isViewerRole(session.user?.role)) {
    redirect(`/contracts?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "contracts.create")) {
    redirect(redirectTargetForDeniedWriteRoute(role, "/contracts"));
  }

  const [employees, existingContracts, retirementPolicy, gratuitySettings, noteOptions] = await Promise.all([
    getEmployeesForUi(),
    getContractsForUi(),
    getRetirementAgePolicySettings(),
    getGratuitySettings(),
    listNoteMonitorOptionsForContracts({ includeNonConfirmed: true }),
  ]);
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "New Contract" },
        ]}
        backFallbackHref="/contracts"
        title="New Contract"
        icon="file-plus-2"
        description="Create a new employee contract record."
      />
      <ContractForm
        mode="create"
        employees={employees}
        existingContracts={existingContracts}
        retirementPolicy={retirementPolicy}
        gratuitySettings={gratuitySettings}
        noteOptions={noteOptions}
      />
    </div>
  );
}
