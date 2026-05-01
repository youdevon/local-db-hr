import type { Metadata } from "next";

import { ContractsDirectoryClient } from "./page-client";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getContractRowsForUi } from "@/lib/server/hr";

export const metadata: Metadata = {
  title: "Contract Directory",
};

export default async function ContractDirectoryPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canCreateContract = canPerformAction(role, "contracts.create");

  const rows = await getContractRowsForUi();
  return <ContractsDirectoryClient rows={rows} canCreateContract={canCreateContract} />;
}
