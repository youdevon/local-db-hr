import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ChangePasswordAction } from "@/components/profile/change-password-action";
import { ProfileContractTabPanel } from "@/components/profile/profile-contract-tab-panel";
import { ProfileContractPeriodSection } from "@/components/profile/profile-contract-period-section";
import { ProfileLeaveBreakdownPanel } from "@/components/profile/profile-leave-breakdown-panel";
import { ProfilePersonalInformationTab } from "@/components/profile/profile-personal-information-tab";
import { ProfileQualificationsTab } from "@/components/profile/profile-qualifications-tab";
import { ProfileSelfServiceBody } from "@/components/profile/profile-self-service-body";
import { ProfileUpdatePersonalDialog } from "@/components/profile/profile-update-personal-dialog";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { getSession } from "@/lib/get-session";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";
import { getProfileSelfServiceData } from "@/lib/server/profile-self-service-page";
import { getLeaveTransactionBreakdownForContract } from "@/lib/server/leave-transaction-breakdown";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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

  const params = await searchParams;
  const contractIdRaw = params.contractId;
  const contractIdParam = (Array.isArray(contractIdRaw) ? contractIdRaw[0] : contractIdRaw)?.trim() ?? "";
  const changePasswordRaw = params.changePassword;
  const changePasswordParam = (Array.isArray(changePasswordRaw) ? changePasswordRaw[0] : changePasswordRaw)?.trim() ?? "";
  const requirePasswordChange =
    session.user?.mustChangePassword === true || changePasswordParam === "required";

  const data = await getProfileSelfServiceData(sessionUserId, sessionEmail);
  if (!data) redirect("/login");

  const validContractIds = new Set(data.contracts.map((c) => c.contractId));
  let selectedContractId = data.defaultContractId ?? "";
  if (contractIdParam && validContractIds.has(contractIdParam)) {
    selectedContractId = contractIdParam;
  }
  if (!selectedContractId && data.contracts[0]) {
    selectedContractId = data.contracts[0].contractId;
  }

  const selectedContract = data.contracts.find((c) => c.contractId === selectedContractId) ?? null;

  const breakdown =
    data.account.employeeId && selectedContractId
      ? await getLeaveTransactionBreakdownForContract(data.account.employeeId, selectedContractId)
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Profile" },
        ]}
        title="Profile"
        icon="user-circle"
        description="Your employment summary, contracts, leave, and personal contact details for self-service updates."
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <ChangePasswordAction requirePasswordChange={requirePasswordChange} />
            {data.employee ? (
              <ProfileUpdatePersonalDialog initialValues={data.employee.personal} />
            ) : null}
          </div>
        }
      />

      {!data.employee ? (
        <>
          <SectionCard title="Account">
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Full name" value={data.account.fullName} />
              <Field label="Email" value={data.account.email} />
              <Field label="Role" value={data.account.role} />
              <Field label="Department" value={data.account.department} />
            </dl>
          </SectionCard>
          <SectionCard title="Employee record">
            <p className="text-muted-foreground text-sm">
              No employee record is linked to your account yet. Please contact an administrator to attach your employee
              profile.
            </p>
          </SectionCard>
        </>
      ) : (
        <>
          <ProfileContractPeriodSection contracts={data.contracts} selectedContractId={selectedContractId} />

          <ProfileSelfServiceBody
            personal={
              <ProfilePersonalInformationTab
                fullName={data.employee.fullName}
                fileNumber={data.employee.fileNumber}
                workEmail={data.employee.workEmail}
                userEmail={data.employee.userEmail}
                department={data.employee.department}
                position={data.employee.position}
                accountRole={data.account.role}
                personal={data.employee.personal}
              />
            }
            contract={
              selectedContract ? (
                <ProfileContractTabPanel contract={selectedContract} />
              ) : (
                <EmptyState title="No contract selected" description="Select a contract period above." />
              )
            }
            leave={<ProfileLeaveBreakdownPanel breakdown={breakdown} />}
            qualifications={<ProfileQualificationsTab bundle={data.qualificationsBundle} />}
          />

          {data.account.employeeId ? (
            <p className="text-muted-foreground text-sm">
              <Link
                href={`/leave/transactions?employeeId=${encodeURIComponent(data.account.employeeId)}&from=employee-details`}
                className={cn(buttonVariants({ variant: "link" }), "h-auto p-0 text-sm font-medium")}
              >
                Open full leave transactions
              </Link>{" "}
              (opens the leave directory).
            </p>
          ) : null}
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
