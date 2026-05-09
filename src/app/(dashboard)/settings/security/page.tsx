import type { Metadata } from "next";

import { SecuritySettingsForm } from "@/components/settings/security-settings-form";
import { PageHeader } from "@/components/page-header";
import {
  getAuditExportSecuritySettings,
  getLoginNoticeSettings,
  getLoginProtectionSettings,
  getPasswordPolicySettings,
  getRoleSafetySettings,
  getSessionSettings,
} from "@/lib/security-settings";

export const metadata: Metadata = {
  title: "Security Settings",
};

export default async function SecuritySettingsPage() {
  const [
    sessionSettings,
    loginProtectionSettings,
    passwordPolicySettings,
    auditExportSecuritySettings,
    loginNoticeSettings,
    roleSafetySettings,
  ] = await Promise.all([
    getSessionSettings(),
    getLoginProtectionSettings(),
    getPasswordPolicySettings(),
    getAuditExportSecuritySettings(),
    getLoginNoticeSettings(),
    getRoleSafetySettings(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Security Settings" },
        ]}
        backFallbackHref="/settings"
        title="Security Settings"
        icon="shield-check"
        description="Manage login, session, password, audit, and access-control security policies."
      />
      <SecuritySettingsForm
        initialSessionSettings={sessionSettings}
        initialLoginProtectionSettings={loginProtectionSettings}
        initialPasswordPolicySettings={passwordPolicySettings}
        initialAuditExportSecuritySettings={auditExportSecuritySettings}
        initialLoginNoticeSettings={loginNoticeSettings}
        initialRoleSafetySettings={roleSafetySettings}
      />
    </div>
  );
}
