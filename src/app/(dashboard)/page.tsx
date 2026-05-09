import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Cake,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  FileClock,
  FileWarning,
  ShieldAlert,
  UserCheck,
  Users,
} from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";
import { getDashboardMetrics } from "@/lib/server/dashboard-metrics";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getRetirementWarningTitle(years: number): string {
  if (years <= 0) return "At Retirement Age";
  if (years === 1) return "Reaching Retirement Age Within 1 Year";
  return `Reaching Retirement Age Within ${years} Years`;
}

const metricSurface = cn(
  "rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] transition-[box-shadow,transform] duration-200",
  "hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.12)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.45)]",
);

export default async function DashboardPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (role === "member") {
    return (
      <div className="space-y-6">
        <PageHeader
          hideBreadcrumbNav
          title="Dashboard"
          icon="layout-dashboard"
          description="Welcome. Use your profile to view your information and update your contact details when an employee record is linked to your account."
        />
        <section className="grid gap-4 sm:grid-cols-2">
          <Link
            href="/profile"
            className={cn(
              metricSurface,
              "block cursor-pointer rounded-xl border p-4 sm:p-5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
            )}
          >
            <p className="text-sm font-medium text-muted-foreground">My profile</p>
            <p className="mt-1 text-lg font-semibold text-foreground">View or update your details</p>
            <p className="text-muted-foreground mt-2 text-xs">Personal information, contract & leave (if linked)</p>
          </Link>
        </section>
      </div>
    );
  }

  const metrics = await getDashboardMetrics();

  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbNav
        title="Dashboard"
        icon="layout-dashboard"
        description="HR overview, leave visibility, contract compliance, and retirement planning indicators."
      />

      <section className="space-y-5">
        <SectionCard title="People & Workforce">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <MetricCard
              title="Total Employees"
              value={metrics.people.totalEmployees}
              subtext="All employee records"
              icon={Users}
              href="/dashboard/details/total-employees"
            />
            <MetricCard
              title="Birthdays This Month"
              value={metrics.people.birthdaysThisMonth}
              subtext="Birthdays this month"
              icon={Cake}
              href="/dashboard/details/birthdays-this-month"
            />
          </div>
        </SectionCard>
      </section>

      <section className="space-y-5">
        <SectionCard title="Age & Retirement Planning">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              title="Employees Over Retirement Age"
              value={metrics.employeesOverRetirementAge}
              subtext="Based on configured retirement age"
              icon={UserCheck}
              href="/dashboard/details/employees-over-retirement-age"
            />
            <MetricCard
              title={getRetirementWarningTitle(metrics.retirement.warningYearsBeforeRetirement)}
              value={metrics.employeesReachingRetirementWithinOneYear}
              subtext={
                metrics.retirement.warningYearsBeforeRetirement <= 0
                  ? `Based on retirement age ${metrics.retirement.retirementAge}`
                  : `Based on retirement age ${metrics.retirement.retirementAge} and a ${metrics.retirement.warningYearsBeforeRetirement}-year warning period`
              }
              icon={CalendarClock}
              href="/dashboard/details/retirement-within-one-year"
            />
            <MetricCard
              title="Contracts Beyond Retirement Cutoff"
              value={metrics.contractsBeyondRetirementCutoff}
              subtext="Contracts extending beyond retirement cutoff"
              icon={ShieldAlert}
              href="/dashboard/details/contracts-beyond-retirement-cutoff"
            />
          </div>
        </SectionCard>
      </section>

      <section className="space-y-5">
        <SectionCard title="Contracts & Compliance">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              title="Contracts Expiring in 90 Days"
              value={metrics.contractsExpiringIn90Days}
              subtext="Contracts ending within 90 days"
              icon={FileClock}
              href="/dashboard/details/contracts-expiring-90-days"
            />
            <MetricCard
              title="Expired Contracts - No New Contract"
              value={metrics.contracts.expiredContractsNoNew}
              subtext="Employees with expired latest contracts and no active or future renewal"
              icon={AlertTriangle}
              href="/contracts/expired-no-new"
            />
            <MetricCard
              title="Employees With No Contract on File"
              value={metrics.contracts.employeesWithNoContract}
              subtext="Employees without contract records"
              icon={FileWarning}
              href="/dashboard/details/employees-with-no-contract"
            />
          </div>
        </SectionCard>
      </section>

      <section className="space-y-5">
        <SectionCard title="Leave & Attendance">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <MetricCard
              title="Currently on Leave Today"
              value={metrics.leave.onLeaveToday}
              subtext="Employees on leave today"
              icon={CalendarDays}
              href="/dashboard/details/on-leave-today"
            />
            <MetricCard
              title="Most Used Leave Type"
              value={metrics.leave.mostUsedLeaveTypeLabel}
              subtext={
                metrics.leave.mostUsedLeaveTypeDays === null
                  ? "No leave records yet"
                  : `Based on days used (${metrics.leave.mostUsedLeaveTypeDays} days)`
              }
              icon={CalendarCheck}
              href="/dashboard/details/most-used-leave-type"
            />
            <MetricCard
              title="Low Leave Balances"
              value={metrics.leave.lowLeaveBalances}
              subtext="Employees with low leave balances"
              icon={AlertTriangle}
              href="/dashboard/details/low-leave-balances"
            />
          </div>
        </SectionCard>
      </section>

    </div>
  );
}

function MetricCard({
  title,
  value,
  subtext,
  icon: Icon,
  href,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        metricSurface,
        "block cursor-pointer rounded-xl border p-4 sm:p-5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2",
      )}
    >
      <article>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
            <p className="text-xs leading-relaxed text-muted-foreground">{subtext}</p>
          </div>
          <span className="mt-0.5 inline-flex size-9 items-center justify-center rounded-md border border-border bg-muted/30 text-muted-foreground">
            <Icon className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </article>
    </Link>
  );
}

