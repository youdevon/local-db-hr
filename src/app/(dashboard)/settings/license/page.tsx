import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { LicenseSettingsForm } from "@/components/settings/license-settings-form";
import { requireUser } from "@/lib/auth-server";
import { getLicenseStatus } from "@/lib/license";
import { normalizeUserRole } from "@/lib/roles";
import { getUpdateCheckSettings } from "@/lib/update-check-settings";
import { getInstalledAppVersion } from "@/lib/version-server";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Licence & Updates",
};

export default async function LicenseSettingsPage() {
  const user = await requireUser();
  if (normalizeUserRole(user.role) !== "administrator") {
    redirect("/unauthorized");
  }

  const license = await getLicenseStatus();
  const providerControlsEnabled = process.env.ENABLE_PROVIDER_LICENSE_CONTROLS === "true";
  const installedVersion = getInstalledAppVersion();
  const { manifestUrl: updateManifestUrl } = await getUpdateCheckSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Licence & Updates" },
        ]}
        backFallbackHref="/settings"
        title="Licence & Updates"
        icon="shield-check"
        description="Review licence status, check for approved GitHub releases, and install updates when permitted. Full release notes are on GitHub."
      />
      <LicenseSettingsForm
        license={license}
        providerControlsEnabled={providerControlsEnabled}
        installedVersion={installedVersion}
        updateManifestUrl={updateManifestUrl}
      />
    </div>
  );
}

