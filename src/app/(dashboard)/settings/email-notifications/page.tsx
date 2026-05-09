import type { Metadata } from "next";

import {
  getEmailNotificationSettingsForPage,
} from "@/actions/email-notification-settings";
import { EmailNotificationSettingsForm } from "@/components/settings/email-notification-settings-form";
import { PageHeader } from "@/components/page-header";
import { getRecentEmailNotificationLogs } from "@/lib/email/email-settings";

export const metadata: Metadata = {
  title: "Email Notifications",
};

export default async function EmailNotificationSettingsPage() {
  const [{ settings, encryptionError }, logs] = await Promise.all([
    getEmailNotificationSettingsForPage(),
    getRecentEmailNotificationLogs(30),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Email Notifications" },
        ]}
        backFallbackHref="/settings"
        title="Email Notifications"
        icon="bell-ring"
        description="Configure SMTP email delivery, test email sending, and HR alert notifications."
      />
      <EmailNotificationSettingsForm
        initialSettings={settings}
        encryptionError={encryptionError}
        recentLogs={logs}
      />
    </div>
  );
}
