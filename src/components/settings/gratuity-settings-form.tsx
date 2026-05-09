"use client";

import { useState } from "react";

import { saveGratuitySettingsAction } from "@/actions/gratuity-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultGratuitySettings,
  type GratuityCalculationSettings,
} from "@/lib/gratuity-settings";
import { notifyError, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function GratuitySettingsForm({
  initialSettings = defaultGratuitySettings,
}: {
  initialSettings?: GratuityCalculationSettings;
}) {
  const [settings, setSettings] = useState<GratuityCalculationSettings>(initialSettings);
  const [saving, setSaving] = useState(false);

  function update<K extends keyof GratuityCalculationSettings>(
    key: K,
    value: GratuityCalculationSettings[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    setSaving(true);
    try {
      const result = await saveGratuitySettingsAction(settings);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      setSettings(result.settings);
      notifySuccess(result.message);
    } finally {
      setSaving(false);
    }
  }

  function resetDefault() {
    setSettings(defaultGratuitySettings);
    notifySuccess("Gratuity settings reset to default.");
  }

  return (
    <section className={cardClass}>
      <p className="text-muted-foreground mb-4 text-sm">
        Changes to global gratuity settings apply to new and current contracts. Expired contracts retain the gratuity
        settings that applied when they expired.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Gratuity rate percentage</Label>
          <Input
            className="h-10 rounded-md"
            type="number"
            min="0"
            step="0.01"
            value={settings.gratuityRate}
            onChange={(e) => update("gratuityRate", Number(e.target.value || 0))}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Government tax rate percentage</Label>
          <Input
            className="h-10 rounded-md"
            type="number"
            min="0"
            step="0.01"
            value={settings.governmentTaxRate}
            onChange={(e) => update("governmentTaxRate", Number(e.target.value || 0))}
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label className="text-sm font-medium">Calculation method description</Label>
          <Input
            className="h-10 rounded-md"
            value="20% of gross salary for the entire contract period, less 25% government tax."
            disabled
            readOnly
          />
        </div>
        <div className="space-y-2">
          <Label className="text-sm font-medium">Effective from date</Label>
          <Input
            className="h-10 rounded-md"
            type="date"
            value={settings.effectiveFrom}
            onChange={(e) => update("effectiveFrom", e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium md:pt-8">
          <input
            type="checkbox"
            className="size-4 rounded border border-input"
            checked={settings.active}
            onChange={(e) => update("active", e.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={() => void save()} disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
        <Button type="button" variant="outline" onClick={resetDefault}>
          Reset to Default
        </Button>
      </div>
    </section>
  );
}
