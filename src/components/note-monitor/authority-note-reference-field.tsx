"use client";

import { useMemo, type ReactNode } from "react";

import { StatusBadge } from "@/components/status-badge";
import { NoteMonitorCombobox } from "@/components/note-monitor/note-monitor-combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { AuthorityReferenceMode } from "@/lib/mock/contracts";
import {
  formatNoteStatusLabel,
  getNoteStatusTone,
  NOTE_TYPE_OPTIONS,
  type NoteTypeValue,
} from "@/lib/note-monitor/constants";
import type { NoteMonitorDropdownOption } from "@/lib/server/note-monitor";
import { cn } from "@/lib/utils";

const selectClass =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

function AuthorityField({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
    </div>
  );
}

type AuthorityNoteFieldsProps = {
  noteType: NoteTypeValue | "";
  onNoteTypeChange: (value: NoteTypeValue | "") => void;
  noteTypeError?: string;
  options: NoteMonitorDropdownOption[];
  referenceMode: AuthorityReferenceMode | "";
  onReferenceModeChange: (value: AuthorityReferenceMode) => void;
  monitorRecordId: string;
  onMonitorRecordIdChange: (value: string) => void;
  manualReference: string;
  onManualReferenceChange: (value: string) => void;
  monitorError?: string;
  manualError?: string;
  disabled?: boolean;
};

export function AuthorityNoteFields({
  noteType,
  onNoteTypeChange,
  noteTypeError,
  options,
  referenceMode,
  onReferenceModeChange,
  monitorRecordId,
  onMonitorRecordIdChange,
  manualReference,
  onManualReferenceChange,
  monitorError,
  manualError,
  disabled = false,
}: AuthorityNoteFieldsProps) {
  const useManualReference = referenceMode === "manual";

  const filteredOptions = useMemo(() => {
    if (!noteType) return [];
    const filtered = options.filter((option) => option.noteType === noteType);
    const selected = options.find((option) => option.value === monitorRecordId);
    if (selected && !filtered.some((option) => option.value === selected.value)) {
      return [selected, ...filtered];
    }
    return filtered;
  }, [monitorRecordId, noteType, options]);

  const selectedOption = useMemo(
    () => filteredOptions.find((option) => option.value === monitorRecordId) ?? null,
    [filteredOptions, monitorRecordId],
  );

  const showStatusPreview = !useManualReference && Boolean(selectedOption);

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="size-4 rounded border border-input"
          checked={useManualReference}
          disabled={disabled || !noteType}
          onChange={(event) =>
            onReferenceModeChange(event.target.checked ? "manual" : "note_monitor")
          }
        />
        Use manual / legacy authority note reference
      </label>

      <div
        className={cn(
          "grid gap-4 md:items-start",
          showStatusPreview
            ? "md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
            : "md:grid-cols-2",
        )}
      >
        <AuthorityField label="Authority Note Type" required error={noteTypeError}>
          <select
            className={selectClass}
            value={noteType}
            disabled={disabled}
            onChange={(event) => onNoteTypeChange(event.target.value as NoteTypeValue | "")}
          >
            <option value="">Select…</option>
            {NOTE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.value === "executive_council_note" ? "EC" : option.shortLabel}
              </option>
            ))}
          </select>
        </AuthorityField>

        <AuthorityField
          label={useManualReference ? "Manual / Legacy Reference" : "Authority Note Reference"}
          error={useManualReference ? manualError : monitorError}
        >
          {useManualReference ? (
            <Input
              className="h-10 rounded-md"
              value={manualReference}
              disabled={disabled || !noteType}
              placeholder="Enter minute number or legacy authority reference"
              onChange={(event) => onManualReferenceChange(event.target.value)}
            />
          ) : (
            <NoteMonitorCombobox
              options={filteredOptions}
              value={monitorRecordId}
              onChange={onMonitorRecordIdChange}
              disabled={disabled || !noteType}
              placeholder={
                noteType
                  ? "Search note number, details, or status"
                  : "Select a note type first"
              }
            />
          )}
        </AuthorityField>

        {showStatusPreview && selectedOption ? (
          <AuthorityField label="Status" className="lg:min-w-[7.5rem]">
            <div className="flex h-10 items-center">
              <StatusBadge tone={getNoteStatusTone(selectedOption.status)}>
                {formatNoteStatusLabel(selectedOption.status)}
              </StatusBadge>
            </div>
          </AuthorityField>
        ) : null}
      </div>
    </div>
  );
}
