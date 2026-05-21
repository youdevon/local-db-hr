import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { NoteMonitorForm } from "@/components/note-monitor/note-monitor-form";
import { PageHeader } from "@/components/page-header";
import { getSession } from "@/lib/get-session";
import {
  canPerformAction,
  isViewerRole,
  normalizeUserRole,
  redirectTargetForDeniedWriteRoute,
  VIEW_ONLY_ERROR_PARAM,
  VIEW_ONLY_ERROR_VALUE,
} from "@/lib/roles";
import { getNoteMonitorRecordById } from "@/lib/server/note-monitor";

export const metadata: Metadata = {
  title: "Edit Note",
};

export const dynamic = "force-dynamic";

type NoteMonitorEditPageProps = {
  params: Promise<{ id: string }>;
};

export default async function NoteMonitorEditPage({ params }: NoteMonitorEditPageProps) {
  const { id } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (isViewerRole(session.user?.role)) {
    redirect(`/note-monitor/${id}?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "noteMonitor.edit")) {
    redirect(redirectTargetForDeniedWriteRoute(role, `/note-monitor/${id}`));
  }

  const record = await getNoteMonitorRecordById(id);
  if (!record) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Note Monitor", href: "/note-monitor" },
          { label: record.displayReference, href: `/note-monitor/${record.id}` },
          { label: "Edit" },
        ]}
        backFallbackHref={`/note-monitor/${record.id}`}
        title={`Edit ${record.displayReference}`}
        icon="file-pen-line"
        description="Update note details, workflow dates, and status."
      />
      <NoteMonitorForm mode="edit" record={record} canEdit />
    </div>
  );
}
