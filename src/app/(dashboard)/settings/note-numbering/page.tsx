import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { NoteNumberingSettingsForm } from "@/components/settings/note-numbering-settings-form";
import { requireUser } from "@/lib/auth-server";
import { normalizeUserRole } from "@/lib/roles";
import { listNoteNumberSequenceForYear } from "@/lib/server/note-monitor-numbering";

export const metadata: Metadata = {
  title: "Note Numbering",
};

export const dynamic = "force-dynamic";

export default async function NoteNumberingSettingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ year?: string }>;
}) {
  const user = await requireUser();
  if (normalizeUserRole(user.role) !== "administrator") {
    redirect("/unauthorized");
  }

  const params = (await searchParams) ?? {};
  const y = Number(params.year ?? new Date().getFullYear());
  const year = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();

  const row = await listNoteNumberSequenceForYear(year);
  const sequence = {
    nextNumber: row?.next_number ?? 1,
    autoResetYearly: row?.auto_reset_yearly ?? true,
    updatedAt: row?.updated_at?.toISOString() ?? null,
    updatedByName: row?.updated_by_user?.profile?.full_name ?? row?.updated_by_user?.email ?? null,
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Note Numbering" },
        ]}
        backFallbackHref="/settings"
        title="Note Monitor / Note Numbering"
        icon="notebook-pen"
        description="Manage the shared yearly note number sequence used by all note types."
      />
      <NoteNumberingSettingsForm year={year} sequence={sequence} />
      <p className="text-muted-foreground text-xs">
        Tip: append <code className="text-foreground">?year={year + 1}</code> to manage another year.
      </p>
    </div>
  );
}
