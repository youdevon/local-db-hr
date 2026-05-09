import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { APP_CONFIG } from "@/lib/app-config";
import { getSession } from "@/lib/get-session";
import { getLicenseStatus, getLicenseStatusLabel } from "@/lib/license";
import { normalizeUserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Licence Status",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export default async function LicenseExpiredPage() {
  const [license, session] = await Promise.all([getLicenseStatus(), getSession()]);
  const isAdmin = normalizeUserRole(session.user?.role) === "administrator";
  const settings = license.settings;

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center px-6 py-12">
      <section className="w-full max-w-2xl space-y-5 rounded-xl border border-border bg-card p-6 shadow-[0_8px_24px_rgba(15,23,42,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)]">
        <div>
          <h1 className="font-heading text-xl font-bold tracking-tight">{APP_CONFIG.name}</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Your demo period has expired. Please contact the system provider to activate your licence.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Info label="Organisation" value={settings?.organizationName ?? "—"} />
          <Info label="Licence Status" value={getLicenseStatusLabel(license.status)} />
          <Info label="Expiry Date" value={formatDate(settings?.expiresAt ?? null)} />
          <Info label="Grace Period (Days)" value={String(settings?.gracePeriodDays ?? "—")} />
          <Info label="Hard Stop Date" value={formatDate(license.hardStopDateIso)} />
        </div>
        {isAdmin ? (
          <div className="pt-1">
            <Link href="/settings/license" className={cn(buttonVariants())}>
              Manage Licence
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

