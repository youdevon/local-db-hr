"use client";

import { useState } from "react";

import {
  resetRetirementPolicySettingsAction,
  saveRetirementPolicySettingsAction,
  type RetirementPolicyFormInput,
} from "@/actions/retirement-policy";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function RetirementPolicySettingsForm({
  initialSettings,
}: {
  initialSettings: RetirementPolicyFormInput;
}) {
  const [settings, setSettings] = useState<RetirementPolicyFormInput>(initialSettings);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof RetirementPolicyFormInput>(key: K, value: RetirementPolicyFormInput[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveRetirementPolicySettingsAction(settings);
      if (result.success) {
        notifySuccess("Retirement age policy updated successfully.");
      } else {
        notifyError("Failed to update retirement age policy. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    setSaving(true);
    try {
      const result = await resetRetirementPolicySettingsAction();
      if (result.success) {
        setSettings({
          retirementAge: 60,
          enforceRetirementCheck: true,
          allowOverride: true,
          requireOverrideReason: true,
          requireApprovalReference: true,
          defaultStopDayBeforeBirthday: true,
        });
        notifySuccess("Retirement age policy reset to default.");
      } else {
        notifyError("Failed to update retirement age policy. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={cardClass}>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Retirement age</Label>
          <Input
            className="h-10 rounded-md"
            type="number"
            min="18"
            max="100"
            step="1"
            value={settings.retirementAge}
            onChange={(e) => update("retirementAge", Number(e.target.value || 60))}
          />
          <p className="text-muted-foreground text-xs">
            Contracts are checked against this age when calculating the employee&apos;s retirement cutoff date.
          </p>
        </div>

        <label className="flex items-center gap-2 text-sm font-medium md:pt-8">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.enforceRetirementCheck}
            onChange={(e) => update("enforceRetirementCheck", e.target.checked)}
          />
          Check contract periods against retirement age
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.allowOverride}
            onChange={(e) => update("allowOverride", e.target.checked)}
          />
          Allow contracts beyond retirement age with approval
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.requireOverrideReason}
            onChange={(e) => update("requireOverrideReason", e.target.checked)}
          />
          Require override reason
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.requireApprovalReference}
            onChange={(e) => update("requireApprovalReference", e.target.checked)}
          />
          Require approval reference or minute number
        </label>

        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.defaultStopDayBeforeBirthday}
            onChange={(e) => update("defaultStopDayBeforeBirthday", e.target.checked)}
          />
          Recommend contract end date as day before retirement birthday
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

