"use client";

import { useState } from "react";
import Link from "next/link";

import {
  resetAuditExportSecuritySettingsAction,
  resetLoginNoticeSettingsAction,
  resetLoginProtectionSettingsAction,
  resetPasswordPolicySettingsAction,
  resetRoleSafetySettingsAction,
  resetSessionSettingsAction,
  saveAuditExportSecuritySettingsAction,
  saveLoginNoticeSettingsAction,
  saveLoginProtectionSettingsAction,
  savePasswordPolicySettingsAction,
  saveRoleSafetySettingsAction,
  saveSessionSettingsAction,
} from "@/actions/security-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import type {
  AuditExportSecuritySettings,
  LoginNoticeSettings,
  LoginProtectionSettings,
  PasswordPolicySettings,
  RoleSafetySettings,
  SessionSettings,
} from "@/lib/security-settings";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

type Props = {
  initialSessionSettings: SessionSettings;
  initialLoginProtectionSettings: LoginProtectionSettings;
  initialPasswordPolicySettings: PasswordPolicySettings;
  initialAuditExportSecuritySettings: AuditExportSecuritySettings;
  initialLoginNoticeSettings: LoginNoticeSettings;
  initialRoleSafetySettings: RoleSafetySettings;
};

export function SecuritySettingsForm({
  initialSessionSettings,
  initialLoginProtectionSettings,
  initialPasswordPolicySettings,
  initialAuditExportSecuritySettings,
  initialLoginNoticeSettings,
  initialRoleSafetySettings,
}: Props) {
  const [sessionSettings, setSessionSettings] = useState(initialSessionSettings);
  const [loginProtection, setLoginProtection] = useState(initialLoginProtectionSettings);
  const [passwordPolicy, setPasswordPolicy] = useState(initialPasswordPolicySettings);
  const [auditExport, setAuditExport] = useState(initialAuditExportSecuritySettings);
  const [loginNotice, setLoginNotice] = useState(initialLoginNoticeSettings);
  const [roleSafety, setRoleSafety] = useState(initialRoleSafetySettings);
  const [savingSection, setSavingSection] = useState<string | null>(null);

  async function saveSection(
    sectionKey: string,
    action: () => Promise<{ success: boolean; message: string }>,
  ) {
    setSavingSection(sectionKey);
    try {
      const result = await action();
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      notifySuccess("Security settings saved successfully.");
    } finally {
      setSavingSection(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">1. Session Management</h2>
          <p className="text-muted-foreground text-sm">
            Control inactivity timeout, absolute session duration, and warning behaviour.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Idle timeout (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={240}
              value={sessionSettings.idleTimeoutMinutes}
              onChange={(e) =>
                setSessionSettings((prev) => ({
                  ...prev,
                  idleTimeoutMinutes: Number(e.target.value || 30),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Maximum session duration (hours)</Label>
            <Input
              type="number"
              min={1}
              max={24}
              value={sessionSettings.absoluteSessionHours}
              onChange={(e) =>
                setSessionSettings((prev) => ({
                  ...prev,
                  absoluteSessionHours: Number(e.target.value || 8),
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={sessionSettings.showTimeoutWarning}
              onChange={(e) =>
                setSessionSettings((prev) => ({ ...prev, showTimeoutWarning: e.target.checked }))
              }
            />
            Show timeout warning before automatic logout
          </label>
          <div className="space-y-2">
            <Label>Warning before timeout (minutes)</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={sessionSettings.warningBeforeMinutes}
              onChange={(e) =>
                setSessionSettings((prev) => ({
                  ...prev,
                  warningBeforeMinutes: Number(e.target.value || 2),
                }))
              }
            />
            <p className="text-muted-foreground text-xs">Must be less than idle timeout.</p>
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("session", () => saveSessionSettingsAction(sessionSettings))
            }
            disabled={savingSection === "session"}
          >
            {savingSection === "session" ? "Saving..." : "Save Session Settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("session-reset", async () => {
                const result = await resetSessionSettingsAction();
                if (result.success) {
                  setSessionSettings((prev) => ({
                    ...prev,
                    idleTimeoutMinutes: 30,
                    absoluteSessionHours: 8,
                    showTimeoutWarning: true,
                    warningBeforeMinutes: 2,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "session-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">2. Login Protection</h2>
          <p className="text-muted-foreground text-sm">
            Configure failed-login lockout thresholds and automatic reset behaviour.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={loginProtection.enableLockout}
              onChange={(e) =>
                setLoginProtection((prev) => ({ ...prev, enableLockout: e.target.checked }))
              }
            />
            Enable failed login lockout
          </label>
          <div className="space-y-2">
            <Label>Maximum failed attempts</Label>
            <Input
              type="number"
              min={3}
              max={10}
              value={loginProtection.maxFailedAttempts}
              onChange={(e) =>
                setLoginProtection((prev) => ({
                  ...prev,
                  maxFailedAttempts: Number(e.target.value || 5),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Lockout duration (minutes)</Label>
            <Input
              type="number"
              min={5}
              max={60}
              value={loginProtection.lockoutMinutes}
              onChange={(e) =>
                setLoginProtection((prev) => ({
                  ...prev,
                  lockoutMinutes: Number(e.target.value || 15),
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={loginProtection.resetOnSuccessfulLogin}
              onChange={(e) =>
                setLoginProtection((prev) => ({
                  ...prev,
                  resetOnSuccessfulLogin: e.target.checked,
                }))
              }
            />
            Reset failed attempts after successful login
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("login-protection", () => saveLoginProtectionSettingsAction(loginProtection))
            }
            disabled={savingSection === "login-protection"}
          >
            {savingSection === "login-protection" ? "Saving..." : "Save Login Protection"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("login-protection-reset", async () => {
                const result = await resetLoginProtectionSettingsAction();
                if (result.success) {
                  setLoginProtection((prev) => ({
                    ...prev,
                    enableLockout: true,
                    maxFailedAttempts: 5,
                    lockoutMinutes: 15,
                    resetOnSuccessfulLogin: true,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "login-protection-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">3. Password Policy</h2>
          <p className="text-muted-foreground text-sm">
            Define password strength and expiry policy used for create/reset/change password flows.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Minimum password length</Label>
            <Input
              type="number"
              min={8}
              max={32}
              value={passwordPolicy.minimumLength}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({
                  ...prev,
                  minimumLength: Number(e.target.value || 10),
                }))
              }
            />
          </div>
          <div className="space-y-2">
            <Label>Password expiry days</Label>
            <Input
              type="number"
              min={30}
              max={365}
              value={passwordPolicy.passwordExpiryDays}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({
                  ...prev,
                  passwordExpiryDays: Number(e.target.value || 90),
                }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={passwordPolicy.requireUppercase}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({ ...prev, requireUppercase: e.target.checked }))
              }
            />
            Require uppercase letter
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={passwordPolicy.requireLowercase}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({ ...prev, requireLowercase: e.target.checked }))
              }
            />
            Require lowercase letter
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={passwordPolicy.requireNumber}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({ ...prev, requireNumber: e.target.checked }))
              }
            />
            Require number
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={passwordPolicy.requireSpecialCharacter}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({
                  ...prev,
                  requireSpecialCharacter: e.target.checked,
                }))
              }
            />
            Require special character
          </label>
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={passwordPolicy.passwordExpiryEnabled}
              onChange={(e) =>
                setPasswordPolicy((prev) => ({
                  ...prev,
                  passwordExpiryEnabled: e.target.checked,
                }))
              }
            />
            Enable password expiry
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("password-policy", () => savePasswordPolicySettingsAction(passwordPolicy))
            }
            disabled={savingSection === "password-policy"}
          >
            {savingSection === "password-policy" ? "Saving..." : "Save Password Policy"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("password-policy-reset", async () => {
                const result = await resetPasswordPolicySettingsAction();
                if (result.success) {
                  setPasswordPolicy((prev) => ({
                    ...prev,
                    minimumLength: 10,
                    requireUppercase: true,
                    requireLowercase: true,
                    requireNumber: true,
                    requireSpecialCharacter: true,
                    passwordExpiryEnabled: false,
                    passwordExpiryDays: 90,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "password-policy-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">4. Audit & Export Security</h2>
          <p className="text-muted-foreground text-sm">
            Configure which events are audited and how report exports are governed.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["logSuccessfulLogins", "Log successful logins"],
            ["logFailedLogins", "Log failed logins"],
            ["logLogouts", "Log logouts"],
            ["logPasswordChanges", "Log password changes"],
            ["logRoleChanges", "Log role changes"],
            ["logEmployeeProfileChanges", "Log employee profile changes"],
            ["logReportExports", "Log report exports"],
            ["requireExportReason", "Require export reason"],
            ["includeExportMetadata", "Include exported by/date on reports"],
          ].map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={Boolean(auditExport[field as keyof AuditExportSecuritySettings])}
                onChange={(e) =>
                  setAuditExport((prev) => ({
                    ...prev,
                    [field]: e.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-muted-foreground mt-3 text-xs">
          Audit retention is managed via{" "}
          <Link href="/settings/audit-retention" className="underline underline-offset-4">
            Audit Retention Settings
          </Link>
          .
        </p>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("audit-export", () => saveAuditExportSecuritySettingsAction(auditExport))
            }
            disabled={savingSection === "audit-export"}
          >
            {savingSection === "audit-export" ? "Saving..." : "Save Audit & Export Security"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("audit-export-reset", async () => {
                const result = await resetAuditExportSecuritySettingsAction();
                if (result.success) {
                  setAuditExport((prev) => ({
                    ...prev,
                    logSuccessfulLogins: true,
                    logFailedLogins: true,
                    logLogouts: true,
                    logPasswordChanges: true,
                    logRoleChanges: true,
                    logEmployeeProfileChanges: true,
                    logReportExports: true,
                    requireExportReason: false,
                    includeExportMetadata: true,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "audit-export-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">5. Login Security Notice</h2>
          <p className="text-muted-foreground text-sm">
            Display a notice on the login page and optionally require acknowledgement.
          </p>
        </div>
        <div className="grid gap-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={loginNotice.enabled}
              onChange={(e) => setLoginNotice((prev) => ({ ...prev, enabled: e.target.checked }))}
            />
            Enable login notice
          </label>
          <div className="space-y-2">
            <Label>Notice text</Label>
            <textarea
              className="border-input bg-background min-h-24 w-full rounded-md border px-3 py-2 text-sm"
              maxLength={1200}
              value={loginNotice.noticeText}
              onChange={(e) =>
                setLoginNotice((prev) => ({ ...prev, noticeText: e.target.value }))
              }
            />
          </div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="size-4 rounded border border-input"
              checked={loginNotice.requireAcknowledgement}
              onChange={(e) =>
                setLoginNotice((prev) => ({
                  ...prev,
                  requireAcknowledgement: e.target.checked,
                }))
              }
            />
            Require acknowledgement before login
          </label>
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("login-notice", () => saveLoginNoticeSettingsAction(loginNotice))
            }
            disabled={savingSection === "login-notice"}
          >
            {savingSection === "login-notice" ? "Saving..." : "Save Login Notice"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("login-notice-reset", async () => {
                const result = await resetLoginNoticeSettingsAction();
                if (result.success) {
                  setLoginNotice((prev) => ({
                    ...prev,
                    enabled: false,
                    noticeText:
                      "This system is for authorised users only. Activity may be monitored.",
                    requireAcknowledgement: false,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "login-notice-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <div className="mb-5 space-y-1">
          <h2 className="font-heading text-base font-bold tracking-tight">6. Role Safety / Admin Protection</h2>
          <p className="text-muted-foreground text-sm">
            Reuse and control role safety guards that prevent administrator lockout.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["preventLastAdminRemoval", "Prevent last administrator removal"],
            ["preventAdminSelfDemotion", "Prevent administrator self-demotion"],
            ["requireRoleChangeConfirmation", "Require confirmation for role changes"],
            ["requirePermissionChangeReason", "Require reason for permission changes"],
          ].map(([field, label]) => (
            <label key={field} className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                className="size-4 rounded border border-input"
                checked={Boolean(roleSafety[field as keyof RoleSafetySettings])}
                onChange={(e) =>
                  setRoleSafety((prev) => ({
                    ...prev,
                    [field]: e.target.checked,
                  }))
                }
              />
              {label}
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Button
            type="button"
            onClick={() =>
              saveSection("role-safety", () => saveRoleSafetySettingsAction(roleSafety))
            }
            disabled={savingSection === "role-safety"}
          >
            {savingSection === "role-safety" ? "Saving..." : "Save Role Safety Settings"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              saveSection("role-safety-reset", async () => {
                const result = await resetRoleSafetySettingsAction();
                if (result.success) {
                  setRoleSafety((prev) => ({
                    ...prev,
                    preventLastAdminRemoval: true,
                    preventAdminSelfDemotion: true,
                    requireRoleChangeConfirmation: true,
                    requirePermissionChangeReason: true,
                  }));
                }
                return result;
              })
            }
            disabled={savingSection === "role-safety-reset"}
          >
            Reset to Default
          </Button>
        </div>
      </section>
    </div>
  );
}
