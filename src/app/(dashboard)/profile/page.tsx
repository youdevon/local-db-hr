import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordAction } from "@/components/profile/change-password-action";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSession } from "@/lib/get-session";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";
import { getProfileDataForUser } from "@/lib/server/profile";
import { buttonVariants } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage() {
  const session = await getSession();
  const rawSession = session as unknown as Record<string, unknown>;
  const sessionUser =
    rawSession?.user && typeof rawSession.user === "object"
      ? (rawSession.user as Record<string, unknown>)
      : null;

  const sessionUserId =
    (sessionUser?.userId as string | undefined)?.trim() ||
    (sessionUser?.id as string | undefined)?.trim() ||
    (rawSession?.id as string | undefined)?.trim() ||
    "";
  const sessionEmail =
    (sessionUser?.email as string | undefined)?.trim() ||
    (rawSession?.email as string | undefined)?.trim() ||
    "";

  if (!sessionUserId && !sessionEmail) {
    redirect(LOGIN_SESSION_EXPIRED_HREF);
  }
  const data = await getProfileDataForUser(sessionUserId, sessionEmail);
  if (!data) redirect("/login");

  const remainingTone = (status: "Healthy" | "Low" | "Exhausted" | "Overused") => {
    if (status === "Healthy") return "bg-emerald-500/10 text-emerald-300";
    if (status === "Low") return "bg-amber-500/10 text-amber-300";
    if (status === "Exhausted") return "bg-neutral-500/15 text-neutral-300";
    return "bg-rose-500/10 text-rose-300";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Profile" },
        ]}
        title="Profile"
        icon="user-circle"
        description="View your employee information, current contract, leave balances, and manage your login password."
        actions={<ChangePasswordAction />}
      />

      {data.employee ? (
        <>
          <SectionCard title="Employee Profile">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Full Name" value={data.employee.fullName} />
              <Field label="File #" value={data.employee.fileNumber} />
              <Field label="Email" value={data.employee.email} />
              <Field label="Department" value={data.employee.department} />
              <Field label="Position" value={data.employee.position} />
              <Field label="Role" value={data.account.role} />
            </dl>
          </SectionCard>

          <div className="grid gap-6 xl:grid-cols-2">
            <SectionCard title="Current Contract">
              {data.contract ? (
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Minute #" value={data.contract.minuteNumber} />
                  <Field label="Contract #" value={data.contract.contractNumber} />
                  <Field label="Start Date" value={data.contract.startDate} />
                  <Field label="End Date" value={data.contract.endDate} />
                  <Field label="Contract Duration" value={data.contract.durationMonths} />
                  <Field label="Salary" value={data.contract.salaryText} />
                  <Field label="Expected Gratuity" value={data.contract.gratuityText} />
                  <div className="space-y-1">
                    <dt className="text-muted-foreground text-xs font-medium">Contract Status</dt>
                    <dd>
                      <StatusBadge tone="default">{data.contract.status}</StatusBadge>
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">No contract record found.</p>
              )}
            </SectionCard>

            <SectionCard title="Leave Summary">
              {data.leaveSummary ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Your current leave balance for the active contract year:{" "}
                    <span className="font-medium">{data.leaveSummary.contractYearLabel}</span>
                  </p>
                  <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contract Year</TableHead>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Entitlement</TableHead>
                        <TableHead>Rollover In</TableHead>
                        <TableHead>Used</TableHead>
                        <TableHead>Remaining</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <TableRow>
                        <TableCell>{data.leaveSummary.contractYearLabel}</TableCell>
                        <TableCell className="font-medium">Vacation / Casual</TableCell>
                        <TableCell>{data.leaveSummary.vacation.entitlementText}</TableCell>
                        <TableCell>{data.leaveSummary.vacation.rolloverInText}</TableCell>
                        <TableCell>{data.leaveSummary.vacation.usedText}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-xs font-medium ${remainingTone(data.leaveSummary.vacation.status)}`}>
                            {data.leaveSummary.vacation.remainingText}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone="default">{data.leaveSummary.vacation.status}</StatusBadge>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>{data.leaveSummary.contractYearLabel}</TableCell>
                        <TableCell className="font-medium">Sick</TableCell>
                        <TableCell>{data.leaveSummary.sick.entitlementText}</TableCell>
                        <TableCell>{data.leaveSummary.sick.rolloverInText}</TableCell>
                        <TableCell>{data.leaveSummary.sick.usedText}</TableCell>
                        <TableCell>
                          <span className={`rounded-md px-2 py-1 text-xs font-medium ${remainingTone(data.leaveSummary.sick.status)}`}>
                            {data.leaveSummary.sick.remainingText}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusBadge tone="default">{data.leaveSummary.sick.status}</StatusBadge>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No leave summary available for the current contract year.</p>
              )}
            </SectionCard>
          </div>

          <SectionCard title="Recent Leave Transactions">
            {data.recentLeaveTransactions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leave transactions recorded.</p>
            ) : (
              <div className="space-y-3">
                <div className="overflow-hidden rounded-xl border border-border bg-card">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Leave Type</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Return to Work Date</TableHead>
                        <TableHead>Days Used</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.recentLeaveTransactions.map((row) => (
                        <TableRow key={row.id}>
                          <TableCell>{row.leaveType}</TableCell>
                          <TableCell>{row.startDate}</TableCell>
                          <TableCell>{row.endDate}</TableCell>
                          <TableCell>{row.returnToWorkDate}</TableCell>
                          <TableCell>{row.daysUsed}</TableCell>
                          <TableCell>{row.status}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {data.hasMoreLeaveTransactions && data.account.employeeId ? (
                  <div className="flex justify-end">
                    <Link
                      href={`/leave/employee/${data.account.employeeId}/transactions`}
                      className={buttonVariants({
                        variant: "outline",
                        className: "h-9 rounded-md text-xs font-medium",
                      })}
                    >
                      View all leave transactions
                    </Link>
                  </div>
                ) : null}
              </div>
            )}
          </SectionCard>
        </>
      ) : (
        <>
          <SectionCard title="Account Information">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full Name" value={data.account.fullName} />
              <Field label="Email" value={data.account.email} />
              <Field label="Role" value={data.account.role} />
              <Field label="Department" value={data.account.department} />
            </dl>
          </SectionCard>
          <SectionCard title="Employee Profile">
            <p className="text-sm text-muted-foreground">
              No employee record attached. Your user account has not yet been linked to an employee record. Please contact an administrator.
            </p>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground text-xs font-medium">{label}</dt>
      <dd className="text-foreground text-sm font-medium">{value || "—"}</dd>
    </div>
  );
}
