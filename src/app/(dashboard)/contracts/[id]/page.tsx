import type { Metadata } from "next";
import Link from "next/link";

import { ContractAllowancesTable } from "@/components/contracts/contract-allowances-table";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { buttonVariants } from "@/components/ui/button";
import { getContractDisplayStatus, getContractDisplayStatusTone } from "@/lib/contract-display-status";
import { calculateDaysToExpiry, formatContractDate, formatCurrencyTTD } from "@/lib/mock/contracts";
import { calculateGratuity, contractMonthsBetween, getGratuitySettings } from "@/lib/gratuity-settings";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole, VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE } from "@/lib/roles";
import { FileText } from "lucide-react";
import { getContractForUiById, getContractEmployeeNameById, getEmployeeForUiById } from "@/lib/server/hr";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const c = await getContractForUiById(id);
  const label = c?.contractNumber && !c.contractNumber.startsWith("UNASSIGNED-") ? c.contractNumber : "No assigned number";
  return { title: c ? `Contract ${label}` : "Contract" };
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  const canEditContract = canPerformAction(role, "contracts.edit");

  const contract = await getContractForUiById(id);
  if (!contract) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Contracts", href: "/contracts" },
            { label: "Contract Detail" },
          ]}
          backFallbackHref="/contracts"
          title="Contract Detail"
          icon="file-check"
          description="View contract terms, compensation, leave entitlement, allowances, and related employee information."
        />
        <EmptyState
          icon={FileText}
          title="Contract not found."
          description="The contract record may have been removed or the link is invalid."
          action={
            <Link href="/contracts" className={buttonVariants()}>
              Back to Contracts
            </Link>
          }
        />
      </div>
    );
  }
  const employee = await getEmployeeForUiById(contract.employeeId);
  const employeeName = employee ? `${employee.firstName} ${employee.lastName}` : await getContractEmployeeNameById(contract.employeeId);
  const displayContractStatus = getContractDisplayStatus({
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
  });
  const statusTone = getContractDisplayStatusTone(displayContractStatus);
  const isExpiredContract = displayContractStatus === "Expired";
  const gratuitySettings = await getGratuitySettings();

  const daysToExpiry = calculateDaysToExpiry(contract.endDate);
  const daysToExpiryLabel =
    displayContractStatus === "Expired"
      ? "Expired"
      : daysToExpiry < 0
        ? "Expired"
        : daysToExpiry === 0
          ? "Expires today"
          : Number.isFinite(daysToExpiry)
            ? `${daysToExpiry} days remaining`
            : "—";

  const contractNumberLabel =
    contract.contractNumber && !contract.contractNumber.startsWith("UNASSIGNED-")
      ? contract.contractNumber
      : "No assigned number";
  const minuteNumberLabel = contract.minuteNumber?.trim() || "—";
  const durationMonths = contractMonthsBetween(contract.startDate, contract.endDate);
  const gratuityBreakdown = calculateGratuity({
    monthlySalary: contract.salary,
    contractMonths: durationMonths,
    gratuityRate: gratuitySettings.gratuityRate,
    governmentTaxRate: gratuitySettings.governmentTaxRate,
  });

  return (
    <div className="space-y-6">
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Contracts", href: "/contracts" },
          { label: "Contract Detail" },
        ]}
        backFallbackHref="/contracts"
        title="Contract Detail"
        icon="file-check"
        description="View contract terms, compensation, leave entitlement, allowances, and related employee information."
        actions={
          <div className="flex flex-wrap gap-2">
            {canEditContract ? (
              <Link href={`/contracts/${id}/edit`} className={buttonVariants()}>
                Edit Contract
              </Link>
            ) : null}
            <Link href={`/contracts/employee/${contract.employeeId}`} className={buttonVariants({ variant: "outline" })}>
              All Contracts
            </Link>
          </div>
        }
      />

      <SectionCard title="Contract Summary">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Employee name</dt>
            <dd className="text-foreground font-medium">
              {contract.employeeId ? (
                <Link
                  href={`/employees/${contract.employeeId}`}
                  className="text-blue-600 hover:text-blue-700 hover:underline focus-visible:ring-ring rounded-sm underline-offset-4 focus-visible:outline-none focus-visible:ring-2 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {employeeName || "—"}
                </Link>
              ) : (
                employeeName || "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Minute #</dt>
            <dd className="text-foreground font-medium">{minuteNumberLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contract number</dt>
            <dd className="text-foreground font-medium">{contractNumberLabel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Department</dt>
            <dd className="text-foreground font-medium">{employee?.department || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Position</dt>
            <dd className="text-foreground font-medium">{employee?.position || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Start date</dt>
            <dd className="text-foreground font-medium">{formatContractDate(contract.startDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">End date</dt>
            <dd className="text-foreground font-medium">{formatContractDate(contract.endDate)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Contract status</dt>
            <dd className="pt-1">
              <StatusBadge tone={statusTone}>{displayContractStatus}</StatusBadge>
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Days to expiry</dt>
            <dd className="text-foreground font-medium tabular-nums">{daysToExpiryLabel}</dd>
          </div>
        </dl>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Compensation">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Salary</dt>
              <dd className="font-medium">{formatCurrencyTTD(contract.salary)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gross contract salary</dt>
              <dd className="font-medium">{formatCurrencyTTD(gratuityBreakdown.grossContractSalary)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gratuity rate</dt>
              <dd className="font-medium">{gratuitySettings.gratuityRate}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Gross gratuity</dt>
              <dd className="font-medium">{formatCurrencyTTD(gratuityBreakdown.grossGratuity)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Government tax rate</dt>
              <dd className="font-medium">{gratuitySettings.governmentTaxRate}%</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Tax deduction</dt>
              <dd className="font-medium">{formatCurrencyTTD(gratuityBreakdown.taxDeduction)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Net gratuity</dt>
              <dd className="font-medium">{formatCurrencyTTD(gratuityBreakdown.netGratuity)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Net gratuity / gratuity</dt>
              <dd className="font-medium">{formatCurrencyTTD(contract.gratuity)}</dd>
            </div>
          </dl>
          {isExpiredContract ? (
            <p className="text-muted-foreground mt-3 text-sm">
              Gratuity retained from expired contract settings.
            </p>
          ) : null}
        </SectionCard>

        <SectionCard title="Leave Entitlement">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Vacation leave entitlement</dt>
              <dd className="font-medium">{contract.vacationLeaveEntitlement}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sick leave entitlement</dt>
              <dd className="font-medium">{contract.sickLeaveEntitlement}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Vacation leave rollover rule</dt>
              <dd className="font-medium">
                {contract.vacationRolloverAllowed ? "Allowed within contract period only" : "Not allowed"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Sick leave rollover rule</dt>
              <dd className="font-medium">Not allowed</dd>
            </div>
          </dl>
          <p className="text-muted-foreground mt-3 text-sm">
            Vacation leave rolls over only within this contract period. Sick leave does not roll over.
          </p>
        </SectionCard>
      </div>

      <SectionCard title="Allowances">
        <ContractAllowancesTable allowances={contract.allowances} />
      </SectionCard>

      {contract.retirementOverrideRequired ? (
        <SectionCard title="Retirement Age Override">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Retirement cutoff date</dt>
              <dd className="font-medium">
                {contract.retirementCutoffDate ? formatContractDate(contract.retirementCutoffDate) : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Approval reference / Minute number</dt>
              <dd className="font-medium">{contract.retirementOverrideApprovalReference?.trim() || "—"}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Override reason</dt>
              <dd className="font-medium whitespace-pre-wrap">
                {contract.retirementOverrideReason?.trim() || "—"}
              </dd>
            </div>
          </dl>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Notes">
          <p className="text-sm">{contract.notes || "No notes recorded."}</p>
        </SectionCard>

        <SectionCard title="Record Information">
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Created at</dt>
              <dd className="font-medium">{formatContractDate(contract.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Updated at</dt>
              <dd className="font-medium">{formatContractDate(contract.updatedAt)}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
