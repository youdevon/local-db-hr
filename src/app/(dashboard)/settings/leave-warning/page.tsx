import type { Metadata } from "next";

import { LeaveWarningSettingsForm } from "@/components/settings/leave-warning-settings-form";
import { PageHeader } from "@/components/page-header";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";

export const metadata: Metadata = {
  title: "Leave Warning Settings",
};

export default async function LeaveWarningSettingsPage() {
  const settings = await getLeaveWarningSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Leave Warning Settings" },
        ]}
        backFallbackHref="/settings"
        title="Leave Warning Settings"
        icon="bell-ring"
        description="Configure low leave warning thresholds used in leave results and detail pages."
      />
      <LeaveWarningSettingsForm initialSettings={settings} />
    </div>
  );
}
