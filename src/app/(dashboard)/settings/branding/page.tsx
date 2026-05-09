import type { Metadata } from "next";

import { BrandingSettingsForm } from "@/components/settings/branding-settings-form";
import { PageHeader } from "@/components/page-header";
import { getBrandingSettings, resolveCompanyName } from "@/lib/branding";

export const metadata: Metadata = {
  title: "Branding Settings",
};

export default async function BrandingSettingsPage() {
  const settings = await getBrandingSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Branding Settings" },
        ]}
        backFallbackHref="/settings"
        title="Branding Settings"
        icon="settings"
        description="Manage the application/company display name shown across login and header branding."
      />
      <BrandingSettingsForm
        initialCompanyName={resolveCompanyName(settings)}
      />
    </div>
  );
}
