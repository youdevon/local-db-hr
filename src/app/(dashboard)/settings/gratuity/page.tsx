import type { Metadata } from "next";

import { GratuitySettingsForm } from "@/components/settings/gratuity-settings-form";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  title: "Gratuity Calculation",
};

export default function GratuitySettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Gratuity Calculation" },
        ]}
        backFallbackHref="/settings"
        title="Gratuity Calculation"
        icon="calculator"
        description="Manage the default rates used to calculate contract gratuity."
      />
      <GratuitySettingsForm />
    </div>
  );
}
