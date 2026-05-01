"use client";

import { useState } from "react";

import {
  resetLeaveWarningSettingsAction,
  saveLeaveWarningSettingsAction,
  type LeaveWarningSettings,
} from "@/actions/leave-warning-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function LeaveWarningSettingsForm({ initialSettings }: { initialSettings: LeaveWarningSettings }) {
  const [settings, setSettings] = useState<LeaveWarningSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof LeaveWarningSettings>(key: K, value: LeaveWarningSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveLeaveWarningSettingsAction(settings);
      if (result.success) notifySuccess("Leave warning settings updated successfully.");
      else notifyError("Failed to update leave warning settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function resetDefaults() {
    setSaving(true);
    try {
      const result = await resetLeaveWarningSettingsAction();
      if (result.success) {
        setSettings({
          lowVacationLeaveThresholdDays: 5,
          lowSickLeaveThresholdDays: 3,
          lowGeneralLeaveThresholdDays: 3,
          warnWhenRemainingAtOrBelowThreshold: true,
          showLowLeaveBadge: true,
        });
        notifySuccess("Leave warning settings reset to default.");
      } else {
        notifyError("Failed to update leave warning settings. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Low vacation leave threshold (days)</Label>
          <Input
            type="number"
            min="0"
            className="h-10 rounded-md"
            value={settings.lowVacationLeaveThresholdDays}
            onChange={(event) => update("lowVacationLeaveThresholdDays", Number(event.target.value || 0))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Low sick leave threshold (days)</Label>
          <Input
            type="number"
            min="0"
            className="h-10 rounded-md"
            value={settings.lowSickLeaveThresholdDays}
            onChange={(event) => update("lowSickLeaveThresholdDays", Number(event.target.value || 0))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Low general leave threshold (days)</Label>
          <Input
            type="number"
            min="0"
            className="h-10 rounded-md"
            value={settings.lowGeneralLeaveThresholdDays}
            onChange={(event) => update("lowGeneralLeaveThresholdDays", Number(event.target.value || 0))}
          />
        </div>
        <label className="flex items-center gap-2 pt-8 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.warnWhenRemainingAtOrBelowThreshold}
            onChange={(event) => update("warnWhenRemainingAtOrBelowThreshold", event.target.checked)}
          />
          Warn when remaining is at or below threshold
        </label>
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.showLowLeaveBadge}
            onChange={(event) => update("showLowLeaveBadge", event.target.checked)}
          />
          Show low leave badge
        </label>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="button" className="h-10 rounded-md text-sm font-medium" onClick={save} disabled={saving}>
          Save Settings
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-md text-sm font-medium"
          onClick={resetDefaults}
          disabled={saving}
        >
          Reset to Default
        </Button>
      </div>
    </section>
  );
}
