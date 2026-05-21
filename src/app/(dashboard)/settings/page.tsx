import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getSession } from "@/lib/get-session";
import { getLicenseStatus, getLicenseStatusLabel } from "@/lib/license";
import { normalizeUserRole } from "@/lib/roles";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Global Settings",
};

export default async function SettingsPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const showAdminSettingsCards = role === "administrator";
  const showLicenseCard = showAdminSettingsCards;
  const license = showLicenseCard ? await getLicenseStatus() : null;

  const licenseSummary = !license
    ? ""
    : license.status === "permanent"
      ? "Permanent licence"
      : license.status === "trial_grace"
        ? `Grace period: ${Math.max(0, license.graceDaysRemaining ?? 0)} days remaining`
        : license.status === "expired"
          ? "Licence expired"
          : license.daysRemaining != null
            ? `${Math.max(0, license.daysRemaining)} days remaining`
            : license.message;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Global Settings" },
        ]}
        title="Global settings"
        icon="settings"
        description="Configure organization-wide HR policies, integrations, and security controls."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Link
          href="/settings/branding"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Branding</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Upload your company logo and update organization branding shown across the app.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/security"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Security Settings</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure session timeout, login protection, password policy, notices, and role safety controls.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/users"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">User Accounts</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Create, manage, deactivate, and assign roles to application users.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/gratuity"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Gratuity Calculation</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure gratuity and government tax rates used for contract gratuity calculations.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/retirement-policy"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Retirement Age Policy</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure retirement age rules used when validating employee contract periods.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        {showAdminSettingsCards ? (
          <Link
            href="/settings/public-holidays"
            className={cn(
              "group block rounded-xl border border-border bg-card p-5",
              "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-foreground text-sm font-semibold">Public Holidays</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  Maintain Trinidad and Tobago public holidays used when calculating working-day leave (weekends excluded
                  automatically).
                </p>
              </div>
              <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </div>
          </Link>
        ) : null}

        {showAdminSettingsCards ? (
          <Link
            href="/settings/note-numbering"
            className={cn(
              "group block rounded-xl border border-border bg-card p-5",
              "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-foreground text-sm font-semibold">Note Monitor / Note Numbering</h3>
                <p className="text-muted-foreground mt-1 text-sm">
                  View the shared next note number for each year, reset the yearly sequence, or set the next starting number manually.
                </p>
              </div>
              <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </div>
          </Link>
        ) : null}

        <Link
          href="/settings/leave-warning"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Leave Warning Settings</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure when the system warns that employee leave balances are low.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/email-notifications"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Email Notifications</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure SMTP email delivery, test email sending, and HR alert notifications.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>

        <Link
          href="/settings/audit-retention"
          className={cn(
            "group block rounded-xl border border-border bg-card p-5",
            "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
            "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
            "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-foreground text-sm font-semibold">Audit Retention</h3>
              <p className="text-muted-foreground mt-1 text-sm">
                Configure how long login and system activity audit logs are retained.
              </p>
            </div>
            <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
          </div>
        </Link>
        {showLicenseCard ? (
          <Link
            href="/settings/license"
            className={cn(
              "group block rounded-xl border border-border bg-card p-5",
              "shadow-[0_6px_18px_rgba(15,23,42,0.08)] transition-[transform,box-shadow,border-color] duration-200",
              "hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-[0_10px_24px_rgba(15,23,42,0.12)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
              "dark:hover:border-neutral-700 dark:focus-visible:ring-offset-neutral-950 dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-foreground text-sm font-semibold">Licence & Updates</h3>
                  {license ? (
                    <span className="rounded-full border border-border bg-muted px-2 py-0.5 text-xs">
                      {getLicenseStatusLabel(license.status)}
                    </span>
                  ) : null}
                </div>
                <p className="text-muted-foreground mt-1 text-sm">
                  Manage trial status, licence key, expiry, activation, and approved update checks (manual upgrades only).
                </p>
                {license ? <p className="text-muted-foreground mt-1 text-xs">{licenseSummary}</p> : null}
              </div>
              <ChevronRight className="text-muted-foreground mt-0.5 h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 group-hover:text-blue-600 dark:group-hover:text-blue-400" />
            </div>
          </Link>
        ) : null}
      </div>

      <SectionCard title="Coming soon">
        <p className="text-muted-foreground text-sm">
          Additional administrative settings will be gated by role when those modules are implemented.
        </p>
      </SectionCard>
    </div>
  );
}
