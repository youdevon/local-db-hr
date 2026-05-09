"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  runManualEmailAlertCheckAction,
  saveEmailNotificationSettingsAction,
  sendTestEmailAction,
} from "@/actions/email-notification-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
  EmailNotificationLogRow,
  PublicEmailNotificationSettings,
} from "@/lib/email/email-settings";
import { notifyError, notifyInfo, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

type FormState = {
  enabled: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUsername: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  replyToEmail: string;
  sendLowLeaveAlerts: boolean;
  sendEmployeeProfileCreatedAlerts: boolean;
  sendEmployeeProfileUpdatedAlerts: boolean;
  sendNewContractAlerts: boolean;
  sendContractUpdatedAlerts: boolean;
  sendContractExpiryAlerts: boolean;
  sendContractExpiredAlerts: boolean;
  sendLeaveTransactionUpdatedAlerts: boolean;
  sendLeaveTransactionDeletedAlerts: boolean;
  sendLicenceAlerts: boolean;
  sendSecurityAdminAlerts: boolean;
  sendEmployeeSpecificAlertsToEmployeeEmail: boolean;
  sendCopyToHr: boolean;
  hrCopyEmails: string;
  adminAlertEmails: string;
  contractExpiryWarningDays: string;
  repeatLowLeaveAlertsEveryDays: number;
  sendLeaveTakenRecordedAlerts: boolean;
};

function toFormState(settings: PublicEmailNotificationSettings): FormState {
  return {
    enabled: settings.enabled,
    smtpHost: settings.smtpHost,
    smtpPort: settings.smtpPort,
    smtpSecure: settings.smtpSecure,
    smtpUsername: settings.smtpUsername,
    smtpPassword: "",
    fromEmail: settings.fromEmail,
    fromName: settings.fromName,
    replyToEmail: settings.replyToEmail,
    sendLowLeaveAlerts: settings.sendLowLeaveAlerts,
    sendEmployeeProfileCreatedAlerts: settings.sendEmployeeProfileCreatedAlerts,
    sendEmployeeProfileUpdatedAlerts: settings.sendEmployeeProfileUpdatedAlerts,
    sendNewContractAlerts: settings.sendNewContractAlerts,
    sendContractUpdatedAlerts: settings.sendContractUpdatedAlerts,
    sendContractExpiryAlerts: settings.sendContractExpiryAlerts,
    sendContractExpiredAlerts: settings.sendContractExpiredAlerts,
    sendLeaveTransactionUpdatedAlerts: settings.sendLeaveTransactionUpdatedAlerts,
    sendLeaveTransactionDeletedAlerts: settings.sendLeaveTransactionDeletedAlerts,
    sendLicenceAlerts: settings.sendLicenceAlerts,
    sendSecurityAdminAlerts: settings.sendSecurityAdminAlerts,
    sendEmployeeSpecificAlertsToEmployeeEmail: settings.sendEmployeeSpecificAlertsToEmployeeEmail,
    sendCopyToHr: settings.sendCopyToHr,
    hrCopyEmails: settings.hrCopyEmails.join(", "),
    adminAlertEmails: settings.adminAlertEmails.join(", "),
    contractExpiryWarningDays: settings.contractExpiryWarningDays.join(","),
    repeatLowLeaveAlertsEveryDays: settings.repeatLowLeaveAlertsEveryDays,
    sendLeaveTakenRecordedAlerts: settings.sendLeaveTakenRecordedAlerts,
  };
}

export function EmailNotificationSettingsForm({
  initialSettings,
  encryptionError,
  recentLogs,
}: {
  initialSettings: PublicEmailNotificationSettings;
  encryptionError: string | null;
  recentLogs: EmailNotificationLogRow[];
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(toFormState(initialSettings));
  const [saving, setSaving] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [runningCheck, setRunningCheck] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [manualSummary, setManualSummary] = useState<{ sent: number; failed: number; skipped: number } | null>(null);

  const canSubmit = useMemo(() => !saving && !sendingTest && !runningCheck, [runningCheck, saving, sendingTest]);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function saveSettings() {
    if (!canSubmit) return;
    setSaving(true);
    try {
      const result = await saveEmailNotificationSettingsAction(form);
      if (!result.success) {
        notifyError(result.message || "Unable to update email notification settings. Please try again.");
        return;
      }
      notifySuccess("Email notification settings updated successfully.");
      router.refresh();
    } catch {
      notifyError("Unable to update email notification settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function sendTestEmail() {
    if (!canSubmit) return;
    setSendingTest(true);
    try {
      const result = await sendTestEmailAction(testRecipient);
      if (!result.success) {
        if ("disabled" in result && result.disabled) {
          notifyInfo(result.message);
        } else {
          notifyError(result.message || "Unable to send test email. Check SMTP settings.");
        }
        router.refresh();
        return;
      }
      notifySuccess("Test email sent successfully.");
      router.refresh();
    } catch {
      notifyError("Unable to send test email. Check SMTP settings.");
    } finally {
      setSendingTest(false);
    }
  }

  async function runManualCheck() {
    if (!canSubmit) return;
    setRunningCheck(true);
    try {
      const result = await runManualEmailAlertCheckAction();
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      setManualSummary(result.summary);
      notifySuccess(`Alert check complete: ${result.summary.sent} sent, ${result.summary.skipped} skipped, ${result.summary.failed} failed.`);
      router.refresh();
    } catch {
      notifyError("Unable to run manual alert check.");
    } finally {
      setRunningCheck(false);
    }
  }

  return (
    <div className="space-y-6">
      {encryptionError ? (
        <section className={cardClass}>
          <p className="rounded-md border border-red-300/70 bg-red-50/70 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
            {encryptionError}
          </p>
          <p className="text-muted-foreground mt-2 text-xs">
            You can still save settings while email notifications are disabled. An encryption key is required only when storing an SMTP password.
          </p>
        </section>
      ) : null}

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">SMTP Delivery Settings</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Toggle label="Enable email notifications" checked={form.enabled} onChange={(v) => update("enabled", v)} />
          <Toggle label="Secure/TLS" checked={form.smtpSecure} onChange={(v) => update("smtpSecure", v)} />
          <Field label="SMTP host">
            <Input value={form.smtpHost} onChange={(e) => update("smtpHost", e.target.value)} />
          </Field>
          <Field label="SMTP port">
            <Input type="number" value={form.smtpPort} onChange={(e) => update("smtpPort", Number(e.target.value || 587))} />
          </Field>
          <Field label="SMTP username">
            <Input value={form.smtpUsername} onChange={(e) => update("smtpUsername", e.target.value)} />
          </Field>
          <Field label="SMTP password">
            <Input type="password" value={form.smtpPassword} onChange={(e) => update("smtpPassword", e.target.value)} />
            <p className="text-muted-foreground text-xs">Leave blank to keep the existing password.</p>
          </Field>
          <Field label="From email">
            <Input value={form.fromEmail} onChange={(e) => update("fromEmail", e.target.value)} />
          </Field>
          <Field label="From display name">
            <Input value={form.fromName} onChange={(e) => update("fromName", e.target.value)} />
          </Field>
          <Field label="Reply-to email">
            <Input value={form.replyToEmail} onChange={(e) => update("replyToEmail", e.target.value)} />
          </Field>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">Leave confirmations</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Toggle
            label="Send leave taken confirmation emails"
            checked={form.sendLeaveTakenRecordedAlerts}
            onChange={(v) => update("sendLeaveTakenRecordedAlerts", v)}
          />
          <Toggle
            label="Send leave transaction updated emails"
            checked={form.sendLeaveTransactionUpdatedAlerts}
            onChange={(v) => update("sendLeaveTransactionUpdatedAlerts", v)}
          />
          <Toggle
            label="Send leave transaction deleted emails"
            checked={form.sendLeaveTransactionDeletedAlerts}
            onChange={(v) => update("sendLeaveTransactionDeletedAlerts", v)}
          />
          <p className="text-muted-foreground mt-2 text-xs">
            Employees receive an email when leave is recorded. Only sent if email notifications are enabled above.
          </p>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">Alert Rules</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Toggle
            label="Send employee profile created alerts"
            checked={form.sendEmployeeProfileCreatedAlerts}
            onChange={(v) => update("sendEmployeeProfileCreatedAlerts", v)}
          />
          <Toggle
            label="Send employee profile updated alerts"
            checked={form.sendEmployeeProfileUpdatedAlerts}
            onChange={(v) => update("sendEmployeeProfileUpdatedAlerts", v)}
          />
          <Toggle label="Send new contract alerts" checked={form.sendNewContractAlerts} onChange={(v) => update("sendNewContractAlerts", v)} />
          <Toggle
            label="Send contract updated alerts"
            checked={form.sendContractUpdatedAlerts}
            onChange={(v) => update("sendContractUpdatedAlerts", v)}
          />
          <Toggle label="Send low leave alerts" checked={form.sendLowLeaveAlerts} onChange={(v) => update("sendLowLeaveAlerts", v)} />
          <Toggle label="Send contract expiry alerts" checked={form.sendContractExpiryAlerts} onChange={(v) => update("sendContractExpiryAlerts", v)} />
          <Toggle label="Send contract expired alerts" checked={form.sendContractExpiredAlerts} onChange={(v) => update("sendContractExpiredAlerts", v)} />
          <Toggle
            label="Send licence alerts"
            checked={form.sendLicenceAlerts}
            onChange={(v) => update("sendLicenceAlerts", v)}
          />
          <Toggle
            label="Send security/admin alerts"
            checked={form.sendSecurityAdminAlerts}
            onChange={(v) => update("sendSecurityAdminAlerts", v)}
          />
          <Toggle
            label="Send employee-specific alerts to employee email"
            checked={form.sendEmployeeSpecificAlertsToEmployeeEmail}
            onChange={(v) => update("sendEmployeeSpecificAlertsToEmployeeEmail", v)}
          />
          <Toggle label="Send copy to HR" checked={form.sendCopyToHr} onChange={(v) => update("sendCopyToHr", v)} />
          <Field label="HR copy emails (comma-separated)">
            <Input value={form.hrCopyEmails} onChange={(e) => update("hrCopyEmails", e.target.value)} />
          </Field>
          <Field label="Admin alert emails (comma-separated)">
            <Input value={form.adminAlertEmails} onChange={(e) => update("adminAlertEmails", e.target.value)} />
          </Field>
          <Field label="Contract expiry warning days (comma-separated)">
            <Input value={form.contractExpiryWarningDays} onChange={(e) => update("contractExpiryWarningDays", e.target.value)} />
          </Field>
          <Field label="Repeat low leave alerts every X days">
            <Input
              type="number"
              min={1}
              max={365}
              value={form.repeatLowLeaveAlertsEveryDays}
              onChange={(e) => update("repeatLowLeaveAlertsEveryDays", Number(e.target.value || 7))}
            />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" onClick={saveSettings} disabled={!canSubmit}>
            {saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">Test Email</h3>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <Field label="Test recipient email" className="min-w-[280px] flex-1">
            <Input value={testRecipient} onChange={(e) => setTestRecipient(e.target.value)} />
          </Field>
          <Button type="button" onClick={sendTestEmail} disabled={!canSubmit}>
            {sendingTest ? "Sending..." : "Send Test Email"}
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">Manual Alert Check</h3>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" onClick={runManualCheck} disabled={!canSubmit}>
            {runningCheck ? "Running..." : "Run Alert Check Now"}
          </Button>
          {manualSummary ? (
            <p className="text-muted-foreground text-sm">
              sent: {manualSummary.sent}, skipped: {manualSummary.skipped}, failed: {manualSummary.failed}
            </p>
          ) : null}
        </div>
      </section>

      <section className={cardClass}>
        <h3 className="text-sm font-semibold">Recent Email Logs</h3>
        <div className="mt-4 overflow-x-auto rounded-md border border-border">
          <table className="min-w-full text-sm">
            <thead className="bg-muted/40">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Date/Time</th>
                <th className="px-3 py-2 text-left font-medium">Type</th>
                <th className="px-3 py-2 text-left font-medium">Recipient</th>
                <th className="px-3 py-2 text-left font-medium">Status</th>
                <th className="px-3 py-2 text-left font-medium">Error</th>
              </tr>
            </thead>
            <tbody>
              {recentLogs.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-muted-foreground" colSpan={5}>
                    No email logs found.
                  </td>
                </tr>
              ) : (
                recentLogs.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="px-3 py-2">{new Date(log.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{log.notificationType}</td>
                    <td className="px-3 py-2">{log.recipientEmail ?? "—"}</td>
                    <td className="px-3 py-2">{log.status}</td>
                    <td className="px-3 py-2">{log.errorMessage ?? "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className ?? ""}>
      <Label className="text-sm font-medium">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium">
      <input
        type="checkbox"
        className="size-4 rounded border border-input"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
