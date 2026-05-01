import type { Metadata } from "next";

import { RetirementPolicySettingsForm } from "@/components/settings/retirement-policy-settings-form";
import { PageHeader } from "@/components/page-header";
import { getRetirementAgePolicySettings } from "@/lib/retirement-policy-settings";

export const metadata: Metadata = {
  title: "Retirement Age Policy",
};

export default async function RetirementPolicySettingsPage() {
  const settings = await getRetirementAgePolicySettings();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Retirement Age Policy" },
        ]}
        backFallbackHref="/settings"
        title="Retirement Age Policy"
        icon="calendar-clock"
        description="Configure the retirement age rule used when creating and editing contracts."
      />
      <RetirementPolicySettingsForm initialSettings={settings} />
    </div>
  );
}

