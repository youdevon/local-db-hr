import type { Metadata } from "next";

import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getExpiredContractsNoNewForUi } from "@/lib/server/hr";
import { ExpiredNoNewContractsClient } from "./page-client";

export const metadata: Metadata = {
  title: "Expired Contracts - No New Contract",
};

export const dynamic = "force-dynamic";

export default async function ExpiredNoNewContractsPage() {
  const [rows, session] = await Promise.all([getExpiredContractsNoNewForUi(), getSession()]);
  const role = normalizeUserRole(session.user?.role);
  const canCreateContract = canPerformAction(role, "contracts.create");

  return <ExpiredNoNewContractsClient rows={rows} canCreateContract={canCreateContract} />;
}

