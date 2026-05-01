import type { Metadata } from "next";
import Link from "next/link";

import { EmployeeDetailTabs } from "@/components/employees/employee-detail-tabs";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { buttonVariants } from "@/components/ui/button";
import {
  calculateAge,
  getFullName,
  type EmployeePositionHistoryRow,
} from "@/lib/mock/employees";
import { cn } from "@/lib/utils";
import { Users } from "lucide-react";
import { getSession } from "@/lib/get-session";
import {
  canEditEmployees,
  VIEW_ONLY_CANNOT_EDIT_EMPLOYEE_MESSAGE,
  VIEWER_NOTICE_MESSAGES,
  VIEWER_NOTICE_PARAM,
} from "@/lib/roles";
import { getEmployeeCurrentOrLatestContract, getEmployeeForUiById } from "@/lib/server/hr";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

const floating =
  "rounded-xl border border-border bg-card shadow-[0_8px_24px_rgba(15,23,42,0.08)] ring-1 ring-foreground/[0.04] dark:shadow-[0_8px_24px_rgba(0,0,0,0.35)] dark:ring-white/[0.06]";

function resolveCurrentRole(
  history: EmployeePositionHistoryRow[] | undefined,
  field: "department" | "position",
  fallback: string,
  currentContractNumber?: string | null,
): string {
  const rows = history ?? [];
  if (rows.length === 0) return fallback?.trim() || "—";

  if (currentContractNumber) {
    const matched = rows.find((row) => row.relatedContractNumber === currentContractNumber);
    const fromMatched = matched?.[field]?.trim();
    if (fromMatched) return fromMatched;
  }

  const ranked = [...rows].sort((a, b) => {
    const aCurrent = a.endDate === null ? 1 : 0;
    const bCurrent = b.endDate === null ? 1 : 0;
    if (aCurrent !== bCurrent) return bCurrent - aCurrent;
    const aDate = a.endDate ?? a.startDate;
    const bDate = b.endDate ?? b.startDate;
    return bDate.localeCompare(aDate);
  });
  return ranked[0]?.[field]?.trim() || fallback?.trim() || "—";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const employee = await getEmployeeForUiById(id);
  return {
    title: employee ? getFullName(employee) : "Employee",
  };
}

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const session = await getSession();
  const roleInput = session.user?.role ?? null;
  const canMutateEmployeeData = canEditEmployees(roleInput);
  const sp = (await searchParams) ?? {};
  const noticeRaw = sp[VIEWER_NOTICE_PARAM];
  const viewerNotice =
    typeof noticeRaw === "string" && noticeRaw in VIEWER_NOTICE_MESSAGES ? noticeRaw : undefined;
  const viewerNoticeMessage = viewerNotice ? VIEWER_NOTICE_MESSAGES[viewerNotice] : undefined;

  const [employee, contract] = await Promise.all([
    getEmployeeForUiById(id),
    getEmployeeCurrentOrLatestContract(id),
  ]);
  if (!employee) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Employees", href: "/employees" },
            { label: "Employee Detail" },
          ]}
          backFallbackHref="/employees"
          title="Employee Detail"
          icon="user-round"
          description="View employee bio-data and identification records."
        />
        <EmptyState icon={Users} title="Employee not found." description="" />
      </div>
    );
  }

  const displayName = getFullName(employee);
  const age = calculateAge(employee.dateOfBirth);
  const displayAge = employee.dateOfBirth ? age : "—";
  const resolvedDepartment = resolveCurrentRole(
    employee.positionHistory,
    "department",
    employee.department,
    contract?.contractNumber,
  );
  const resolvedPosition = resolveCurrentRole(
    employee.positionHistory,
    "position",
    employee.position,
    contract?.contractNumber,
  );
  const initials =
    `${employee.firstName?.[0] ?? ""}${employee.lastName?.[0] ?? ""}`.trim().toUpperCase() || "?";

  return (
    <div className="space-y-6">
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_EDIT_EMPLOYEE_MESSAGE} />
      {viewerNoticeMessage ? (
        <div className="border-border bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100 flex flex-col gap-2 rounded-lg border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm" role="status">
            {viewerNoticeMessage}
          </p>
          <Link
            href={`/employees/${id}`}
            className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0 self-start sm:self-auto" })}
            scroll={false}
          >
            Dismiss
          </Link>
        </div>
      ) : null}
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Employees", href: "/employees" },
          { label: displayName },
        ]}
        backFallbackHref="/employees"
        title="Employee Detail"
        icon="user-round"
        description="View employee bio-data and identification records."
        actions={
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {contract ? (
                <Link
                  href={`/contracts/${contract.id}`}
                  className={buttonVariants({ variant: "outline" })}
                  title="Opens current/latest contract"
                >
                  View Contract
                </Link>
              ) : (
                <button
                  type="button"
                  className={cn(
                    buttonVariants({ variant: "outline" }),
                    "cursor-not-allowed rounded-md opacity-50",
                  )}
                  title="No contract attached"
                  disabled
                  aria-disabled="true"
                >
                  View Contract
                </button>
              )}
              {canMutateEmployeeData ? (
                <Link href={`/employees/${id}/edit`} className={buttonVariants()}>
                  Edit Employee
                </Link>
              ) : null}
            </div>
            <p className="text-muted-foreground text-xs">
              {contract ? "Opens current/latest contract" : "No contract attached"}
            </p>
          </div>
        }
      />

      <section className={cn(floating, "flex flex-col gap-6 p-6 sm:flex-row sm:items-center")}>
        <div className="border-border bg-muted/30 relative mx-auto flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-full border shadow-sm sm:mx-0 sm:size-28">
          {employee.photoUrl?.trim() ? (
            // eslint-disable-next-line @next/next/no-img-element -- arbitrary employee photo URL (mock / future CDN)
            <img
              src={employee.photoUrl.trim()}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="text-primary text-2xl font-semibold">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-4 text-center sm:text-left">
          <div>
            <h2 className="text-foreground text-xl font-semibold tracking-tight">{displayName}</h2>
            <p className="text-muted-foreground mt-1 text-sm">File #{employee.fileNumber || "—"}</p>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground text-xs font-medium">Department</dt>
              <dd className="text-foreground text-sm font-semibold">{resolvedDepartment || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium">Position</dt>
              <dd className="text-foreground text-sm font-semibold">{resolvedPosition || "—"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium">Age</dt>
              <dd className="text-foreground text-sm font-semibold tabular-nums">
                {displayAge}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <EmployeeDetailTabs employee={employee} allowMutations={canMutateEmployeeData} />
    </div>
  );
}
