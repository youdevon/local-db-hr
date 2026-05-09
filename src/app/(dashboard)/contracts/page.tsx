import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ContractsClient } from "./contracts-client";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole, VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE } from "@/lib/roles";
import { getContractRowsForUi } from "@/lib/server/hr";

export const metadata: Metadata = {
  title: "Contracts",
};

type ContractsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ContractsPage({ searchParams }: ContractsPageProps) {
  const params = (await searchParams) ?? {};
  const statusParam = params.status;
  const normalizedStatus =
    typeof statusParam === "string" ? statusParam.trim().toLowerCase() : "";

  if (normalizedStatus === "expired-no-new") {
    redirect("/contracts/expired-no-new");
  }

  const [rows, session] = await Promise.all([getContractRowsForUi(), getSession()]);
  const role = normalizeUserRole(session.user?.role);
  return (
    <>
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <ContractsClient rows={rows} canCreate={canPerformAction(role, "contracts.create")} />
    </>
  );
}
