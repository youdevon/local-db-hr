import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { getLicenseGeneratorPageState } from "@/actions/license-generator";
import { LicenceGeneratorForm } from "@/components/settings/licence-generator-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth-server";
import { isLicenseGeneratorEnabled } from "@/lib/licensing/provider-license-generator";
import { normalizeUserRole } from "@/lib/roles";

export const metadata: Metadata = {
  title: "Licence Generator",
};

export default async function LicenceGeneratorPage() {
  if (!isLicenseGeneratorEnabled()) {
    notFound();
  }

  const user = await requireUser();
  if (normalizeUserRole(user.role) !== "administrator") {
    redirect("/unauthorized");
  }

  const { privateKeyConfigured, publicKeyConfigured } = await getLicenseGeneratorPageState();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Licence Generator" },
        ]}
        backFallbackHref="/settings"
        title="Licence Generator"
        icon="key-round"
        description="Provider-only tool to issue signed D3HR licence keys for customer installations."
      />
      <LicenceGeneratorForm privateKeyConfigured={privateKeyConfigured} publicKeyConfigured={publicKeyConfigured} />
    </div>
  );
}
