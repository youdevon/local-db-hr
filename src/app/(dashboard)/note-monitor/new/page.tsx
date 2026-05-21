import type { Metadata } from "next";
import { redirect } from "next/navigation";

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

export const metadata: Metadata = {
  title: "Create Note Number",
};

export const dynamic = "force-dynamic";

export default async function NewNoteMonitorPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (isViewerRole(session.user?.role)) {
    redirect(`/note-monitor?${VIEW_ONLY_ERROR_PARAM}=${VIEW_ONLY_ERROR_VALUE}`);
  }
  if (!canPerformAction(role, "noteMonitor.create")) {
    redirect(redirectTargetForDeniedWriteRoute(role, "/note-monitor"));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Note Monitor", href: "/note-monitor" },
          { label: "Create New Note Number" },
        ]}
        backFallbackHref="/note-monitor"
        title="Create New Note Number"
        icon="notebook-pen"
        description="Generate the next available note number for the selected type and preparation year."
      />
      <NoteMonitorForm mode="create" canEdit />
    </div>
  );
}
