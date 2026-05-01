"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  defaultGratuitySettings,
  loadGratuitySettings,
  saveGratuitySettings,
  type GratuityCalculationSettings,
} from "@/lib/gratuity-settings";
import { notifyError, notifySuccess } from "@/lib/notify";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function GratuitySettingsForm() {
  const [settings, setSettings] = useState<GratuityCalculationSettings>(defaultGratuitySettings);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync saved settings after hydration (localStorage unavailable on server)
    setSettings(loadGratuitySettings());
  }, []);

  function update<K extends keyof GratuityCalculationSettings>(
    key: K,
    value: GratuityCalculationSettings[K],
  ) {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }

  function save() {
    try {
      saveGratuitySettings(settings);
      notifySuccess("Gratuity settings updated successfully.");
    } catch {
      notifyError("Failed to update gratuity settings. Please try again.");
    }
  }

  function resetDefault() {
    setSettings(defaultGratuitySettings);
    saveGratuitySettings(defaultGratuitySettings);
    notifySuccess("Gratuity settings reset to default.");
  }

  return (
    <section className={cardClass}>
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
        <Button type="button" onClick={save}>
          Save Settings
        </Button>
        <Button type="button" variant="outline" onClick={resetDefault}>
          Reset to Default
        </Button>
      </div>
    </section>
  );
}
