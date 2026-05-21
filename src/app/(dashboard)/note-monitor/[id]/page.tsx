import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { NoteMonitorDetailClient } from "@/components/note-monitor/note-monitor-detail-client";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { getNoteMonitorHistory, getNoteMonitorRecordById } from "@/lib/server/note-monitor";

export const metadata: Metadata = {
  title: "Note Details",
};

export const dynamic = "force-dynamic";

type NoteMonitorDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoteMonitorDetailPage({ params }: NoteMonitorDetailPageProps) {
  const { id } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!canPerformAction(role, "noteMonitor.view")) {
    redirect("/unauthorized");
  }

  const [record, history] = await Promise.all([getNoteMonitorRecordById(id), getNoteMonitorHistory(id)]);
  if (!record) notFound();

  const canEdit = canPerformAction(role, "noteMonitor.edit");
  const canDelete =
    canPerformAction(role, "noteMonitor.delete") || canPerformAction(role, "noteMonitor.edit");
  const canExport = canPerformAction(role, "noteMonitor.view");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Note Monitor", href: "/note-monitor" },
          { label: record.displayReference },
        ]}
        backFallbackHref="/note-monitor"
        title={`${record.noteTypeLabel} ${record.displayReference}`}
        icon="notebook-pen"
        description={record.details}
        actions={
          canEdit ? (
            <Link href={`/note-monitor/${record.id}/edit`} className={buttonVariants({ className: "h-10 rounded-md" })}>
              Edit Note
            </Link>
          ) : null
        }
      />
      <NoteMonitorDetailClient
        record={record}
        history={history}
        canEdit={canEdit}
        canDelete={canDelete}
        canExport={canExport}
      />
    </div>
  );
}
