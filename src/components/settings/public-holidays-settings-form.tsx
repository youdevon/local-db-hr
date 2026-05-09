"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  deletePublicHolidayAction,
  generateTtHolidaysForYearAction,
  savePublicHolidayAction,
} from "@/actions/public-holidays";
import type { PublicHolidayRow } from "@/lib/server/public-holidays";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

type Props = {
  year: number;
  holidays: PublicHolidayRow[];
};

export function PublicHolidaysSettingsForm({ year, holidays }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [genYear, setGenYear] = useState(String(year));
  const [draft, setDraft] = useState({
    holidayDate: "",
    name: "",
  });

  const sorted = useMemo(() => [...holidays].sort((a, b) => a.holidayDate.localeCompare(b.holidayDate)), [holidays]);

  async function saveDraft() {
    setSaving(true);
    try {
      const res = await savePublicHolidayAction({
        holidayDate: draft.holidayDate.trim(),
        name: draft.name.trim(),
      });
      if (!res.success) {
        notifyError(res.message);
        return;
      }
      notifySuccess(res.message);
      setDraft({ holidayDate: "", name: "" });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(row: PublicHolidayRow, active: boolean) {
    setSaving(true);
    try {
      const res = await savePublicHolidayAction({
        id: row.id,
        holidayDate: row.holidayDate,
        name: row.name,
        countryCode: row.countryCode,
        active,
      });
      if (!res.success) {
        notifyError(res.message);
        return;
      }
      notifySuccess(active ? "Holiday activated." : "Holiday deactivated.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function remove(row: PublicHolidayRow) {
    if (!confirm(`Remove “${row.name}” on ${row.holidayDate}?`)) return;
    setSaving(true);
    try {
      const res = await deletePublicHolidayAction(row.id);
      if (!res.success) {
        notifyError(res.message);
        return;
      }
      notifySuccess(res.message);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function generateYear() {
    const y = Number(genYear);
    setSaving(true);
    try {
      const res = await generateTtHolidaysForYearAction(y);
      if (!res.success) {
        notifyError(res.message);
        return;
      }
      notifySuccess(res.message);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Generate template (Trinidad & Tobago)</h2>
        <p className="text-muted-foreground mb-4 text-sm">
          Inserts or refreshes a standard set of movable and fixed-date holidays for the year. Always verify against
          official notices — especially <strong className="text-foreground">Divali</strong> and{" "}
          <strong className="text-foreground">Eid-ul-Fitr</strong>, which vary annually.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label>Year</Label>
            <Input
              className="h-10 w-32 rounded-md"
              value={genYear}
              onChange={(e) => setGenYear(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <Button type="button" variant="secondary" disabled={saving} onClick={() => void generateYear()}>
            Generate / merge year
          </Button>
        </div>
      </section>

      <section className={cardClass}>
        <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Add holiday</h2>
        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <Label>Date</Label>
            <Input
              type="date"
              className="h-10 rounded-md"
              value={draft.holidayDate}
              onChange={(e) => setDraft((d) => ({ ...d, holidayDate: e.target.value }))}
            />
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label>Name</Label>
            <Input
              className="h-10 rounded-md"
              placeholder="e.g. Divali"
              value={draft.name}
              onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            />
          </div>
        </div>
        <Button type="button" className="mt-3" disabled={saving} onClick={() => void saveDraft()}>
          Save holiday
        </Button>
      </section>

      <section className={cardClass}>
        <h2 className="font-heading mb-3 text-base font-bold tracking-tight">Holidays for {year}</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Name</th>
                <th className="py-2 pr-3 font-medium">Region</th>
                <th className="py-2 pr-3 font-medium">Active</th>
                <th className="py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-muted-foreground py-6">
                    No holidays for this year. Generate a template or add manually.
                  </td>
                </tr>
              ) : (
                sorted.map((row) => (
                  <tr key={row.id} className="border-b border-border/80">
                    <td className="py-2 pr-3 font-mono text-xs">{row.holidayDate}</td>
                    <td className="py-2 pr-3">{row.name}</td>
                    <td className="py-2 pr-3">{row.countryCode}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={cn(
                          "rounded-full border px-2 py-0.5 text-xs",
                          row.active
                            ? "border-emerald-600/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                            : "border-muted-foreground/40 bg-muted/50 text-muted-foreground",
                        )}
                      >
                        {row.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="xs"
                          className="h-8"
                          disabled={saving}
                          onClick={() => void toggleActive(row, !row.active)}
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="xs"
                          className="h-8"
                          disabled={saving}
                          onClick={() => void remove(row)}
                        >
                          Delete
                        </Button>
                      </div>
                    </td>
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
