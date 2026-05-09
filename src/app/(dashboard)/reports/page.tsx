import type { Metadata } from "next";

import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getAuditExportSecuritySettings } from "@/lib/security-settings";
import { getReportDefinitions, getReportFilterOptions } from "@/lib/server/reports";

import { ReportsClient } from "./reports-client";

export const metadata: Metadata = {
  title: "Reports",
};

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const [definitions, filterOptions, auditExportSettings] = await Promise.all([
    getReportDefinitions(),
    getReportFilterOptions(),
    getAuditExportSecuritySettings(),
  ]);
  const canExport = canPerformAction(role, "reports.export");

  return (
    <ReportsClient
      categories={definitions.categories}
      reports={definitions.reports}
      filterOptions={filterOptions}
      canExport={canExport}
      requireExportReason={auditExportSettings.requireExportReason}
      includeExportMetadata={auditExportSettings.includeExportMetadata}
    />
  );
}
