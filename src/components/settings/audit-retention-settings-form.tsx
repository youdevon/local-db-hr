"use client";

import { useState } from "react";

import {
  resetAuditRetentionSettingsAction,
  saveAuditRetentionSettingsAction,
  type AuditRetentionFormInput,
} from "@/actions/audit-retention";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function AuditRetentionSettingsForm({
  initialSettings,
}: {
  initialSettings: AuditRetentionFormInput;
}) {
  const [settings, setSettings] = useState<AuditRetentionFormInput>(initialSettings);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof AuditRetentionFormInput>(key: K, value: AuditRetentionFormInput[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveAuditRetentionSettingsAction(settings);
      if (result.success) {
        notifySuccess("Audit retention settings updated successfully.");
      } else {
        notifyError(result.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    setSaving(true);
    try {
      const result = await resetAuditRetentionSettingsAction();
      if (result.success) {
        setSettings({
          liveRetentionMonths: 24,
          totalRetentionYears: 7,
          archiveEnabled: true,
          legalHoldEnabled: true,
          autoDeleteEnabled: false,
          deleteOnlyIfNotOnLegalHold: true,
        });
        notifySuccess("Audit retention settings reset to default.");
      } else {
        notifyError(result.message);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Live audit log retention</Label>
          <Input
            className="h-10 rounded-md"
            type="number"
            min="1"
            step="1"
            value={settings.liveRetentionMonths}
            onChange={(e) => update("liveRetentionMonths", Number(e.target.value || 1))}
          />
          <p className="text-muted-foreground text-xs">
            Logs newer than this remain visible in the active audit views. (months)
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-medium">Total audit log retention</Label>
          <Input
            className="h-10 rounded-md"
            type="number"
            min="1"
            step="1"
            value={settings.totalRetentionYears}
            onChange={(e) => update("totalRetentionYears", Number(e.target.value || 1))}
          />
          <p className="text-muted-foreground text-xs">
            Logs should not be removed before this period unless policy changes. (years)
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.archiveEnabled}
            onChange={(e) => update("archiveEnabled", e.target.checked)}
          />
          Archive logs older than the live retention period
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.legalHoldEnabled}
            onChange={(e) => update("legalHoldEnabled", e.target.checked)}
          />
          Enable legal or investigation hold
        </label>
        <p className="text-muted-foreground text-xs md:col-span-2">
          Logs under hold are not deleted even after the retention period.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.autoDeleteEnabled}
            onChange={(e) => update("autoDeleteEnabled", e.target.checked)}
          />
          Automatically delete logs after total retention period
        </label>
        <p className="text-muted-foreground text-xs md:col-span-2">
          Recommended to keep this off until an archival process is approved.
        </p>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.deleteOnlyIfNotOnLegalHold}
            onChange={(e) => update("deleteOnlyIfNotOnLegalHold", e.target.checked)}
          />
          Delete only if not on legal hold
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="button" className="h-10 rounded-md text-sm font-medium" onClick={save} disabled={saving}>
          Save Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-md text-sm font-medium"
          onClick={resetDefault}
          disabled={saving}
        >
          Reset to Default
        </Button>
      </div>
    </section>
  );
}
