import type { Metadata } from "next";

import { AuditRetentionSettingsForm } from "@/components/settings/audit-retention-settings-form";
import { PageHeader } from "@/components/page-header";
import { getAuditRetentionSettings } from "@/lib/audit-retention";

export const metadata: Metadata = {
  title: "Audit Retention",
};

export default async function AuditRetentionSettingsPage() {
  const settings = await getAuditRetentionSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Audit Retention" },
        ]}
        backFallbackHref="/settings"
        title="Audit Retention"
        icon="shield-check"
        description="Manage how long audit logs are kept, archived, and protected from deletion."
      />
      <AuditRetentionSettingsForm initialSettings={settings} />
    </div>
  );
}
