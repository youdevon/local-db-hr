"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Download, Printer } from "lucide-react";

import { deleteNoteMonitorRecordAction } from "@/actions/note-monitor";
import { exportNoteMonitorNoteAction } from "@/actions/note-monitor-reports";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { downloadBase64File } from "@/lib/download-base64";
import { getNoteStatusTone } from "@/lib/note-monitor/constants";
import { notifyError, notifySuccess } from "@/lib/notify";
import type { NoteMonitorDetailRecord, NoteMonitorHistoryRow } from "@/lib/server/note-monitor";

function formatDisplayDate(value: string | null): string {
  if (!value) return "—";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("en-TT", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function linkedContractRoleLabel(role: NoteMonitorDetailRecord["linkedContracts"][number]["role"]): string {
  switch (role) {
    case "executive_council":
      return "Executive Council Note";
    case "secretary":
      return "Secretary Note";
    case "authority":
      return "Authority Note";
  }
}

type NoteMonitorDetailClientProps = {
  record: NoteMonitorDetailRecord;
  history: NoteMonitorHistoryRow[];
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
};

export function NoteMonitorDetailClient({
  record,
  history,
  canEdit,
  canDelete,
  canExport,
}: NoteMonitorDetailClientProps) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const deleteBlocked = record.linkedContractCount > 0;
  const deleteDescription = deleteBlocked
    ? "This note cannot be deleted because it is linked to one or more contracts. Remove the contract links before deleting this note."
    : `This will remove the note from the active list. Note number ${record.displayReference} will become available for reuse when creating new notes in ${record.noteYear}. This action cannot be undone.`;

  async function confirmDelete() {
    setDeleting(true);
    try {
      const result = await deleteNoteMonitorRecordAction(record.id);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      notifySuccess(result.message);
      setDeleteOpen(false);
      router.push("/note-monitor");
      router.refresh();
    } catch {
      notifyError("Could not delete note record. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  async function exportNote() {
    setExporting(true);
    try {
      const result = await exportNoteMonitorNoteAction(record.id);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      downloadBase64File(result.contentBase64, result.fileName, result.mimeType);
      notifySuccess(`Exported note ${record.displayReference}.`);
    } catch {
      notifyError("Failed to export note record. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  function printNote() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="no-print flex flex-wrap gap-2">
        {canEdit ? (
          <Link href={`/note-monitor/${record.id}/edit`} className={buttonVariants({ className: "h-10 rounded-md" })}>
            Edit Note
          </Link>
        ) : null}
        {canDelete ? (
          <Button
            type="button"
            variant="destructive"
            className="h-10 rounded-md"
            disabled={deleteBlocked}
            onClick={() => setDeleteOpen(true)}
          >
            Delete Note
          </Button>
        ) : null}
        {canExport ? (
          <Button type="button" variant="outline" className="h-10 rounded-md" disabled={exporting} onClick={exportNote}>
            <Download className="mr-2 h-4 w-4" />
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
        ) : null}
        {canExport ? (
          <Button type="button" variant="outline" className="h-10 rounded-md" onClick={printNote}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        ) : null}
        <Link href="/note-monitor" className={buttonVariants({ variant: "outline", className: "h-10 rounded-md" })}>
          Back to Note Monitor
        </Link>
      </div>

      {canDelete && deleteBlocked ? (
        <p className="no-print text-muted-foreground text-sm">
          This note cannot be deleted because it is linked to {record.linkedContractCount}{" "}
          {record.linkedContractCount === 1 ? "contract" : "contracts"}.
        </p>
      ) : null}

      <div id="printable-note-detail" className="space-y-6">
        <div className="print-only hidden space-y-1">
          <h2 className="font-heading text-lg font-bold tracking-tight">
            {record.noteTypeLabel} {record.displayReference}
          </h2>
          <p className="text-sm">{record.details}</p>
        </div>

        <SectionCard title="Note Details">
          <dl className="grid gap-4 md:grid-cols-2">
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Note Year</dt>
              <dd className="text-foreground font-medium">{record.noteYear}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Note Number</dt>
              <dd className="text-foreground font-medium">{record.displayReference}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Note Type</dt>
              <dd className="text-foreground font-medium">{record.noteTypeLabel}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Note Status</dt>
              <dd>
                <StatusBadge tone={getNoteStatusTone(record.status)}>{record.statusLabel}</StatusBadge>
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Note Preparation Date</dt>
              <dd className="text-foreground font-medium">{formatDisplayDate(record.notePreparationDate)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Due Date</dt>
              <dd className="text-foreground font-medium">{formatDisplayDate(record.dueDate)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Details</dt>
              <dd className="text-foreground mt-1 whitespace-pre-wrap">{record.details}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Date Returned from Secretary</dt>
              <dd className="text-foreground font-medium">{formatDisplayDate(record.dateReturnedFromSecretary)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Date Sent to Executive Council</dt>
              <dd className="text-foreground font-medium">{formatDisplayDate(record.dateSentToExecutiveCouncil)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">Date Received from Executive Council</dt>
              <dd className="text-foreground font-medium">{formatDisplayDate(record.dateReceivedFromExecutiveCouncil)}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Linked Contracts">
          {record.linkedContracts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No contract has been linked to this note yet.</p>
          ) : (
            <div className="space-y-3">
              {record.linkedContracts.map((contract) => (
                <div
                  key={`${contract.id}-${contract.role}`}
                  className="border-border flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div>
                    <p className="text-foreground font-medium">
                      {contract.employeeName} · File #{contract.fileNumber}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {linkedContractRoleLabel(contract.role)} · Contract #{contract.contractNumber} ·{" "}
                      {contract.status.replaceAll("_", " ")}
                    </p>
                  </div>
                  <Link
                    href={`/contracts/${contract.id}`}
                    className={buttonVariants({ variant: "outline", className: "no-print h-9 rounded-md" })}
                  >
                    View Contract
                  </Link>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Edit History">
          {history.length === 0 ? (
            <p className="text-muted-foreground text-sm">No edit history recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-muted/40 border-b">
                  <tr>
                    {["Date/Time", "Edited By", "Action", "Field", "Previous Value", "New Value"].map((heading) => (
                      <th
                        key={heading}
                        className="text-muted-foreground px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide"
                      >
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{formatDateTime(entry.editedAt)}</td>
                      <td className="px-3 py-2">{entry.editedByName ?? "—"}</td>
                      <td className="px-3 py-2">{entry.action}</td>
                      <td className="px-3 py-2">{entry.fieldLabel ?? "—"}</td>
                      <td className="px-3 py-2">{entry.oldValue ?? "—"}</td>
                      <td className="px-3 py-2">{entry.newValue ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete Note"
        description={deleteDescription}
        confirmLabel="Delete Note"
        cancelLabel="Cancel"
        confirmVariant="destructive"
        pending={deleting}
        onConfirm={confirmDelete}
      />

      <style jsx global>{`
        @media print {
          .no-print,
          nav,
          aside,
          header .shrink-0,
          .sidebar,
          .top-header {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
}
