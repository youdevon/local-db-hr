import { ProfileContractSelect } from "@/components/profile/profile-contract-select";
import { SectionCard } from "@/components/section-card";
import type { ProfileSelfServiceData } from "@/lib/server/profile-self-service-page";

type Props = {
  contracts: ProfileSelfServiceData["contracts"];
  selectedContractId: string;
};

/**
 * Standalone contract selector for /profile (no duplicate employee summary fields).
 */
export function ProfileContractPeriodSection({ contracts, selectedContractId }: Props) {
  const options = contracts.map((c) => ({
    contractId: c.contractId,
    label: c.dropdownLabel,
  }));

  return (
    <SectionCard title="Contract Period">
      <ProfileContractSelect
        options={options}
        value={selectedContractId}
        disabled={options.length === 0}
        showLabel={false}
      />
      <p className="text-muted-foreground mt-3 text-sm">
        Selecting a contract updates the Contract and Leave tabs.
      </p>
    </SectionCard>
  );
}
