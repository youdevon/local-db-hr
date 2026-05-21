import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import type { ProfileContractForSelfService } from "@/lib/server/profile-self-service-page";
import type { StatusTone } from "@/components/status-badge";

function toneForContractStatus(label: string): StatusTone {
  const n = label.trim().toLowerCase();
  if (n === "current") return "success";
  if (n === "expired" || n === "closed") return "muted";
  if (n === "expiring") return "warning";
  if (n === "upcoming") return "default";
  return "default";
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <p className="text-foreground text-sm font-medium">{value || "—"}</p>
    </div>
  );
}

export function ProfileContractTabPanel({ contract }: { contract: ProfileContractForSelfService }) {
  return (
    <div className="space-y-6">
      <SectionCard title="Contract overview">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Contract Status</span>
          <StatusBadge tone={toneForContractStatus(contract.statusLabel)}>{contract.statusLabel}</StatusBadge>
        </div>
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Authority Type" value={contract.authorityTypeLabel} />
          <Field label="Authority Reference" value={contract.authorityReference} />
          <Field label="Contract Number" value={contract.contractNumber} />
          <Field label="Start Date" value={contract.startDate} />
          <Field label="End Date" value={contract.endDate} />
          <Field label="Contract duration" value={contract.contractDurationLabel} />
          <Field label="Monthly Salary" value={contract.monthlySalaryText} />
          <Field label="Annual Salary" value={contract.annualSalaryText} />
          <Field label="Contract Period Gross Salary" value={contract.contractPeriodGrossSalaryText} />
          <Field label="Gratuity" value={contract.gratuityText} />
          <Field label="Vacation Leave Entitlement" value={contract.vacationEntitlementText} />
          <Field label="Sick Leave Entitlement" value={contract.sickEntitlementText} />
        </dl>
      </SectionCard>
    </div>
  );
}
