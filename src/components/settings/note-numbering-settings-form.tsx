"use client";

import { useState, useTransition } from "react";

import { resetNoteNumberSequenceAction, updateNoteNumberSequenceAction } from "@/actions/note-monitor-settings";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyError, notifySuccess } from "@/lib/notify";

type SequenceInfo = {
  nextNumber: number;
  autoResetYearly: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
};

type NoteNumberingSettingsFormProps = {
  year: number;
  sequence: SequenceInfo;
};

export function NoteNumberingSettingsForm({ year, sequence }: NoteNumberingSettingsFormProps) {
  const [draft, setDraft] = useState(String(sequence.nextNumber));
  const [isPending, startTransition] = useTransition();

  function saveSequence() {
    startTransition(async () => {
      const nextNumber = Number(draft);
      const result = await updateNoteNumberSequenceAction({ noteYear: year, nextNumber });
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      notifySuccess(result.message);
    });
  }

  function resetSequence() {
    startTransition(async () => {
      const result = await resetNoteNumberSequenceAction({ noteYear: year });
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      setDraft("1");
      notifySuccess(result.message);
    });
  }

  return (
    <SectionCard title={`Note numbering for ${year}`}>
      <p className="text-muted-foreground mb-4 text-sm">
        Note numbers use one shared yearly sequence across all note types. Executive Council Notes, Secretary Notes,
        Cabinet Notes, and Short Term Notes all draw from the same counter.
      </p>

      <dl className="mb-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">Current Year</dt>
          <dd className="text-foreground font-medium">{year}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">Current Next Note Number</dt>
          <dd className="text-foreground font-medium">{sequence.nextNumber}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground text-xs uppercase tracking-wide">Automatic Yearly Reset</dt>
          <dd className="text-foreground font-medium">{sequence.autoResetYearly ? "Enabled" : "Disabled"}</dd>
        </div>
      </dl>

      <div className="border-border grid gap-3 rounded-lg border p-4 md:grid-cols-[1fr_160px_auto_auto] md:items-end">
        <div>
          <p className="text-foreground font-medium">Set next number for {year}</p>
          <p className="text-muted-foreground text-xs">
            {sequence.updatedByName ? `Last updated by ${sequence.updatedByName}` : "Not manually updated yet"}
          </p>
        </div>
        <div>
          <label className="text-muted-foreground mb-1 block text-xs">Next number</label>
          <Input
            type="number"
            min={1}
            className="h-10 rounded-md"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
        </div>
        <Button type="button" className="h-10 rounded-md" disabled={isPending} onClick={saveSequence}>
          Save
        </Button>
        <Button type="button" variant="outline" className="h-10 rounded-md" disabled={isPending} onClick={resetSequence}>
          Reset to 1
        </Button>
      </div>

      <p className="text-muted-foreground mt-4 text-xs">
        Example: if the next number for {year} is set to 25, the next note created—regardless of type—becomes{" "}
        <strong>25 of {year}</strong>, then <strong>26 of {year}</strong>, and so on. The next number cannot be set below
        the highest number already used for that year.
      </p>
    </SectionCard>
  );
}
