import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

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
import { getContractForUiById, getContractsForUi, getEmployeesForUi } from "@/lib/server/hr";
import { listNoteMonitorOptionsForContracts } from "@/lib/server/note-monitor";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const contract = await getContractForUiById(id);
  const contractLabel =
    contract?.contractNumber && !contract.contractNumber.startsWith("UNASSIGNED-")
      ? contract.contractNumber
      : "No assigned contract number";
  return {
    title: contract ? `Edit · ${contractLabel}` : "Edit Contract",
  };
}

export default async function EditContractPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canDeleteContract = canPerformAction(role, "contracts.delete");
  if (isViewerRole(session.user?.role)) {
    redirect(`/contracts/${id}?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "contracts.edit")) {
    redirect(redirectTargetForDeniedWriteRoute(role, `/contracts/${id}`));
  }

  const [contract, employees, existingContracts, retirementPolicy, gratuitySettings, noteOptions] = await Promise.all([
    getContractForUiById(id),
    getEmployeesForUi(),
    getContractsForUi(),
    getRetirementAgePolicySettings(),
    getGratuitySettings(),
    listNoteMonitorOptionsForContracts({ includeNonConfirmed: true }),
  ]);
  if (!contract) notFound();
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "Contract Detail", href: `/contracts/${id}` },
          { label: "Edit" },
        ]}
        backFallbackHref={`/contracts/${id}`}
        title="Edit Contract"
        icon="file-pen-line"
        description="Update contract terms, dates, leave entitlement, and allowances."
      />
      <ContractForm
        mode="edit"
        contractId={id}
        employees={employees}
        existingContracts={existingContracts}
        retirementPolicy={retirementPolicy}
        gratuitySettings={gratuitySettings}
        initialContract={contract}
        canDelete={canDeleteContract}
        noteOptions={noteOptions}
      />
    </div>
  );
}
