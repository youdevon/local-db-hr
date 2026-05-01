import type { Metadata } from "next";

import { ContractsClient } from "./contracts-client";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole, VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE } from "@/lib/roles";
import { getContractRowsForUi } from "@/lib/server/hr";

export const metadata: Metadata = {
  title: "Contracts",
};

export default async function ContractsPage() {
  const [rows, session] = await Promise.all([getContractRowsForUi(), getSession()]);
  const role = normalizeUserRole(session.user?.role);
  return (
    <>
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <ContractsClient rows={rows} canCreate={canPerformAction(role, "contracts.create")} />
    </>
  );
}
