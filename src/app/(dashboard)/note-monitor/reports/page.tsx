import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { NoteMonitorReportsClient } from "@/components/note-monitor/note-monitor-reports-client";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { listNoteMonitorCreatorOptions } from "@/lib/server/note-monitor-reports";

export const metadata: Metadata = {
  title: "Note Monitor Reports",
};

export const dynamic = "force-dynamic";

export default async function NoteMonitorReportsPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (!canPerformAction(role, "noteMonitor.view")) {
    redirect("/unauthorized");
  }

  const currentYear = new Date().getFullYear();
  const creators = await listNoteMonitorCreatorOptions();

  return <NoteMonitorReportsClient initialYear={currentYear} creators={creators} />;
}
