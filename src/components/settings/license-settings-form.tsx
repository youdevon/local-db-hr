"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  applySignedLicenseKeyAction,
} from "@/actions/license";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";
import { maskLicenseKey } from "@/lib/license";
import type { ComputedLicenseStatus } from "@/lib/license";

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
};

export function LicenseSettingsForm({ license, providerControlsEnabled }: Props) {
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

  if (!settings) {
    return (
      <div className="space-y-6">
        <section className={cardClass}>
          <div className="space-y-3">
            <h2 className="font-heading text-base font-bold tracking-tight">Current Licence</h2>
            <p className="text-muted-foreground text-sm">
              Licence details are controlled by the signed licence key.
            </p>
            <Info label="Licence Status" value={getLicenseStatusLabel(license.status)} />
          </div>
        </section>
        <ActivateKeyCard
          signedKeyInput={signedKeyInput}
          setSignedKeyInput={setSignedKeyInput}
          onApply={applySignedKey}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={cardClass}>
        <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Current Licence</h2>
        <p className="text-muted-foreground mb-4 text-sm">Licence details are controlled by the signed licence key.</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Info label="Organization Name" value={settings.organizationName} />
          <Info label="Product Name" value={settings.productName} />
          <Info label="Licence Status" value={getLicenseStatusLabel(license.status)} />
          <Info label="Licence Type" value={settings.licenseType} />
          <Info label="Issued Date" value={formatDateTime(settings.issuedAt)} />
          <Info label="Expiry Date" value={formatDateTime(settings.expiresAt)} />
          <Info label="Grace Period Days" value={String(settings.gracePeriodDays)} />
          <Info label="Hard Stop Date" value={formatDateTime(license.hardStopDateIso)} />
          <Info label="Days Remaining" value={license.daysRemaining == null ? "—" : String(license.daysRemaining)} />
          <Info label="Grace Days Remaining" value={license.graceDaysRemaining == null ? "—" : String(license.graceDaysRemaining)} />
          <Info label="Max Users" value={settings.maxUsers == null ? "Unlimited" : String(settings.maxUsers)} />
          <Info label="Max Employees" value={settings.maxEmployees == null ? "Unlimited" : String(settings.maxEmployees)} />
          <Info label="Issued By" value={settings.issuedBy ?? "—"} />
          <Info label="Activated At" value={formatDateTime(settings.activatedAt)} />
          <Info label="Stored licence key" value={maskLicenseKey(settings.licenseKey) ?? "—"} />
          <Info label="Last Valid Check" value={formatDateTime(settings.lastValidCheckAt)} />
          <Info label="Last Checked" value={formatDateTime(settings.lastCheckedAt)} />
        </div>
        {license.clockTamperDetected ? (
          <p className="mt-4 rounded-md border border-amber-300/70 bg-amber-50/80 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200">
            The server date/time appears to be incorrect. Please correct the server date and time to continue.
          </p>
        ) : null}
      </section>

      <ActivateKeyCard
        signedKeyInput={signedKeyInput}
        setSignedKeyInput={setSignedKeyInput}
        onApply={applySignedKey}
        saving={saving}
      />

      {providerControlsEnabled ? (
        <section className={cardClass}>
          <p className="text-muted-foreground text-sm">
            Provider controls are enabled for this environment.
          </p>
        </section>
      ) : null}
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
      <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Activate / Update Licence</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Paste a vendor-issued D3HR licence key. The server verifies the signature and updates licence details from the
        signed payload.
      </p>
      <div className="space-y-2">
        <Label className="text-sm font-medium">Licence Key</Label>
        <textarea
          className="border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 font-mono text-sm"
          spellCheck={false}
          value={signedKeyInput}
          onChange={(e) => setSignedKeyInput(e.target.value)}
          placeholder='D3HR.eyJ...'
        />
        <Button type="button" onClick={() => void onApply()} disabled={saving}>
          {saving ? "Activating..." : "Activate Licence"}
        </Button>
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1 rounded-md border border-border bg-muted/20 px-3 py-2">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p className="text-sm font-medium">{value || "—"}</p>
    </div>
  );
}
