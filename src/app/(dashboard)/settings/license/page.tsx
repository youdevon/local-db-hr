import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { LicenseSettingsForm } from "@/components/settings/license-settings-form";
import { requireUser } from "@/lib/auth-server";
import { getLicenseStatus } from "@/lib/license";
import { normalizeUserRole } from "@/lib/roles";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Licence & Activation",
};

export default async function LicenseSettingsPage() {
  const user = await requireUser();
  if (normalizeUserRole(user.role) !== "administrator") {
    redirect("/unauthorized");
  }

  const license = await getLicenseStatus();
  const providerControlsEnabled = process.env.ENABLE_PROVIDER_LICENSE_CONTROLS === "true";

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Licence & Activation" },
        ]}
        backFallbackHref="/settings"
        title="Licence & Activation"
        icon="shield-check"
        description="View current licence details and activate/update with a signed D3HR licence key."
      />
      <LicenseSettingsForm
        license={license}
        providerControlsEnabled={providerControlsEnabled}
      />
    </div>
  );
}

