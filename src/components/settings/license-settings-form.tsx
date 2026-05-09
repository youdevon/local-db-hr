"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { applySignedLicenseKeyAction } from "@/actions/license";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import { maskLicenseKey } from "@/lib/license";
import type { ComputedLicenseStatus } from "@/lib/license";
import { LicenseUpdatesSection } from "@/components/settings/license-updates-section";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

function getLicenseStatusLabel(status: ComputedLicenseStatus["status"]): string {
  if (status === "trial_active") return "Trial Active";
  if (status === "trial_grace") return "Grace Period";
  if (status === "active") return "Active";
  if (status === "permanent") return "Permanent";
  if (status === "expired") return "Expired";
  if (status === "suspended") return "Suspended";
  return "Invalid";
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

type Props = {
  license: ComputedLicenseStatus;
  providerControlsEnabled: boolean;
  installedVersion: string;
  updateManifestUrl: string;
};

export function LicenseSettingsForm({ license, providerControlsEnabled, installedVersion, updateManifestUrl }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  const settings = license.settings;
  const [signedKeyInput, setSignedKeyInput] = useState("");

  async function applySignedKey() {
    setSaving(true);
    try {
      const result = await applySignedLicenseKeyAction(signedKeyInput);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      notifySuccess(result.message);
      setSignedKeyInput("");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const licenceDetailsSection = !settings ? (
    <section className={cardClass}>
      <div className="space-y-3">
        <h2 className="font-heading text-base font-bold tracking-tight">Current licence</h2>
        <p className="text-muted-foreground text-sm">
          Licence details are controlled by the signed licence key.
        </p>
        <dl>
          <LicenceSummaryRow label="Licence status" value={getLicenseStatusLabel(license.status)} />
        </dl>
      </div>
    </section>
  ) : (
    <section className={cardClass}>
      <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Current licence</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Summary of your activated licence. Administrative controls remain enforced server-side.
      </p>
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <LicenceSummaryRow label="Organization" value={settings.organizationName} />
        <LicenceSummaryRow label="Licence status" value={getLicenseStatusLabel(license.status)} />
        <LicenceSummaryRow label="Licence type" value={settings.licenseType} />
        <LicenceSummaryRow label="Expiry date" value={formatDateTime(settings.expiresAt)} />
        <LicenceSummaryRow label="Issued date" value={formatDateTime(settings.issuedAt)} />
        <LicenceSummaryRow
          label="Days remaining"
          value={license.daysRemaining == null ? "—" : String(license.daysRemaining)}
        />
        <LicenceSummaryRow label="Issued by" value={settings.issuedBy ?? "—"} />
        <LicenceSummaryRow label="Activated at" value={formatDateTime(settings.activatedAt)} />
        <div className="sm:col-span-2">
          <LicenceSummaryRow label="Licence key" value={maskLicenseKey(settings.licenseKey) ?? "—"} mono />
        </div>
      </dl>
      <p className="text-muted-foreground mt-4 text-xs">
        Installed application version is shown under Updates below.
      </p>
      {license.clockTamperDetected ? (
        <p className="mt-4 rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
          The server date/time appears to be incorrect. Please correct the server date and time to continue.
        </p>
      ) : null}
    </section>
  );

  const activateSection = (
    <ActivateKeyCard
      signedKeyInput={signedKeyInput}
      setSignedKeyInput={setSignedKeyInput}
      onApply={applySignedKey}
      saving={saving}
    />
  );

  const updatesSection = (
    <LicenseUpdatesSection key={updateManifestUrl} installedVersion={installedVersion} initialManifestUrl={updateManifestUrl} />
  );

  const providerSection =
    providerControlsEnabled ? (
      <section className={cardClass}>
        <p className="text-muted-foreground text-sm">Provider controls are enabled for this environment.</p>
      </section>
    ) : null;

  if (!settings) {
    return (
      <div className="space-y-6">
        {licenceDetailsSection}
        {updatesSection}
        {activateSection}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {licenceDetailsSection}
      {updatesSection}
      {activateSection}
      {providerSection}
    </div>
  );
}

function LicenceSummaryRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="border-border/60 border-b pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`mt-0.5 font-medium ${mono ? "break-all font-mono text-xs sm:text-sm" : ""}`}>{value || "—"}</dd>
    </div>
  );
}

function ActivateKeyCard({
  signedKeyInput,
  setSignedKeyInput,
  onApply,
  saving,
}: {
  signedKeyInput: string;
  setSignedKeyInput: (value: string) => void;
  onApply: () => Promise<void>;
  saving: boolean;
}) {
  return (
    <section className={cardClass}>
      <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Activate / update licence</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Paste a vendor-issued licence key. The server verifies the signature and updates licence details from the signed
        payload.
      </p>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Licence key</Label>
        <textarea
          className="border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 font-mono text-sm"
          spellCheck={false}
          value={signedKeyInput}
          onChange={(e) => setSignedKeyInput(e.target.value)}
          placeholder='D3HR.eyJ...'
        />
        <Button type="button" onClick={() => void onApply()} disabled={saving}>
          {saving ? "Activating..." : "Activate licence"}
        </Button>
      </div>
    </section>
  );
}
