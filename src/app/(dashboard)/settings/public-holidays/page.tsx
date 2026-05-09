import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { PublicHolidaysSettingsForm } from "@/components/settings/public-holidays-settings-form";
import { requireUser } from "@/lib/auth-server";
import { normalizeUserRole } from "@/lib/roles";
import { listPublicHolidaysByYear } from "@/lib/server/public-holidays";

export const metadata: Metadata = {
  title: "Public Holidays",
};

export default async function PublicHolidaysSettingsPage({
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

  const holidays = await listPublicHolidaysByYear(year);

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings", href: "/settings" },
          { label: "Public Holidays" },
        ]}
        backFallbackHref="/settings"
        title="Public Holidays"
        icon="calendar-days"
        description="Maintain Trinidad and Tobago public holidays used for working-day leave calculations."
      />
      <PublicHolidaysSettingsForm year={year} holidays={holidays} />
      <p className="text-muted-foreground text-xs">
        Tip: append <code className="text-foreground">?year=2027</code> to the URL to manage another year.
      </p>
    </div>
  );
}
