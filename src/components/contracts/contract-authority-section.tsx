import Link from "next/link";

import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import {
  buildContractAuthorityDisplay,
  buildContractAuthorityLegacyInfo,
  contractAuthorityNoteInputFromRecord,
} from "@/lib/contracts/contract-authority-display";
import type { ContractRecord } from "@/lib/mock/contracts";

type ContractAuthoritySectionProps = {
  contract: ContractRecord;
  embedded?: boolean;
};

function AuthorityFields({
  authority,
}: {
  authority: ReturnType<typeof buildContractAuthorityDisplay>;
}) {
  const hasAuthority =
    authority.authorityTypeLabel || authority.authorityReference || authority.sourceLabel;

  if (!hasAuthority) {
    return <p className="text-muted-foreground text-sm">No authority reference recorded.</p>;
  }

  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <dt className="text-muted-foreground">Note type</dt>
        <dd className="text-foreground font-medium">{authority.authorityTypeLabel || "—"}</dd>
      </div>
      <div>
        <dt className="text-muted-foreground">Note reference</dt>
        <dd className="text-foreground font-medium">
          {authority.noteMonitorId && authority.authorityReference ? (
            <Link
              href={`/note-monitor/${authority.noteMonitorId}`}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {authority.authorityReference}
            </Link>
          ) : (
            authority.authorityReference || "—"
          )}
        </dd>
      </div>
      {authority.noteMonitorId ? (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Details</dt>
          <dd className="text-foreground font-medium whitespace-pre-wrap">
            {authority.noteDetails || "—"}
          </dd>
        </div>
      ) : null}
      {authority.noteMonitorId ? (
        <div>
          <dt className="text-muted-foreground">Status</dt>
          <dd className="pt-0.5">
            {authority.noteStatusLabel ? (
              <StatusBadge tone={authority.noteStatusTone}>{authority.noteStatusLabel}</StatusBadge>
            ) : (
              "—"
            )}
          </dd>
        </div>
      ) : null}
      {authority.sourceLabel ? (
        <div>
          <dt className="text-muted-foreground">Source</dt>
          <dd className="text-foreground font-medium">{authority.sourceLabel}</dd>
        </div>
      ) : null}
    </dl>
  );
}

export function ContractAuthoritySection({ contract, embedded = false }: ContractAuthoritySectionProps) {
  const input = contractAuthorityNoteInputFromRecord(contract);
  const authority = buildContractAuthorityDisplay(input);
  const legacy = buildContractAuthorityLegacyInfo(input, authority);

  const authorityContent = <AuthorityFields authority={authority} />;

  if (embedded) {
    return (
      <div className="space-y-6">
        {authorityContent}
        {legacy.showSection ? (
          <div className="border-border space-y-3 border-t pt-4">
            <h3 className="text-foreground text-sm font-semibold">Legacy Information</h3>
            <LegacyFields legacy={legacy} />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard
        title="Authority note"
        description="Note type and reference linked from Note Monitor or entered manually."
      >
        {authorityContent}
      </SectionCard>
      {legacy.showSection ? (
        <SectionCard title="Legacy Information">
          <LegacyFields legacy={legacy} />
        </SectionCard>
      ) : null}
    </div>
  );
}

function LegacyFields({
  legacy,
}: {
  legacy: ReturnType<typeof buildContractAuthorityLegacyInfo>;
}) {
  return (
    <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {legacy.executiveCouncilNoteLabel ? (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Former Executive Council Note</dt>
          <dd className="text-foreground font-medium">
            {legacy.executiveCouncilNoteId ? (
              <Link
                href={`/note-monitor/${legacy.executiveCouncilNoteId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {legacy.executiveCouncilNoteLabel}
              </Link>
            ) : (
              legacy.executiveCouncilNoteLabel
            )}
          </dd>
        </div>
      ) : null}
      {legacy.secretaryNoteLabel ? (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Former Secretary Note</dt>
          <dd className="text-foreground font-medium">
            {legacy.secretaryNoteId ? (
              <Link
                href={`/note-monitor/${legacy.secretaryNoteId}`}
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {legacy.secretaryNoteLabel}
              </Link>
            ) : (
              legacy.secretaryNoteLabel
            )}
          </dd>
        </div>
      ) : null}
      {legacy.storedMinuteNumber ? (
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Stored Minute #</dt>
          <dd className="text-foreground font-medium">{legacy.storedMinuteNumber}</dd>
        </div>
      ) : null}
    </dl>
  );
}
