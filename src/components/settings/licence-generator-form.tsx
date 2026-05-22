"use client";

import { useMemo, useState } from "react";
import { Copy, ShieldAlert } from "lucide-react";

import {
  generateProviderLicenseKeyAction,
  verifyProviderLicenseKeyAction,
} from "@/actions/license-generator";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HR_PRODUCT_NAME } from "@/lib/licensing/license-payload";
import type { SignedLicenseClaims } from "@/lib/license-key-verification";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

const PRIVATE_KEY_MISSING_MESSAGE =
  "Private signing key is not configured. Set LICENSE_PRIVATE_KEY_PEM or LICENSE_PRIVATE_KEY_PATH on the server.";

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";
const selectClass =
  "border-input bg-background flex h-10 w-full rounded-md border px-3 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";
const textareaClass =
  "border-input bg-background min-h-[120px] w-full rounded-md border px-3 py-2 text-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring/50 dark:bg-input/30";

type LicenseType = "trial" | "active" | "permanent" | "suspended";

type StatusPreview = {
  summary: string;
  hardStopDateIso: string | null;
  daysUntilExpiry: number | null;
};

type Props = {
  privateKeyConfigured: boolean;
  publicKeyConfigured: boolean;
};

function formatDateTime(value: string | null | undefined): string {
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

function formatLimit(value: number | null | undefined): string {
  return value == null ? "Unlimited" : String(value);
}

export function LicenceGeneratorForm({ privateKeyConfigured, publicKeyConfigured }: Props) {
  const [organizationName, setOrganizationName] = useState("");
  const [licenseType, setLicenseType] = useState<LicenseType>("trial");
  const [expiresAt, setExpiresAt] = useState("");
  const [gracePeriodDays, setGracePeriodDays] = useState("14");
  const [maxUsers, setMaxUsers] = useState("");
  const [maxEmployees, setMaxEmployees] = useState("");
  const [issuedBy, setIssuedBy] = useState("D3 Services");
  const [notes, setNotes] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");
  const [decodedClaims, setDecodedClaims] = useState<SignedLicenseClaims | null>(null);
  const [statusPreview, setStatusPreview] = useState<StatusPreview | null>(null);
  const [generating, setGenerating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const expiryRequired = licenseType === "trial" || licenseType === "active";

  const clientValidationError = useMemo(() => {
    if (!organizationName.trim()) return "Organization name is required.";
    if (expiryRequired && !expiresAt.trim()) return "Expiry date is required for trial and active licences.";
    const grace = Number(gracePeriodDays);
    if (!Number.isFinite(grace) || grace < 0 || grace > 3650) return "Grace days must be between 0 and 3650.";
    return null;
  }, [organizationName, expiryRequired, expiresAt, gracePeriodDays]);

  async function handleGenerate() {
    if (clientValidationError) {
      notifyError(clientValidationError);
      return;
    }
    if (!privateKeyConfigured) {
      notifyError(PRIVATE_KEY_MISSING_MESSAGE);
      return;
    }

    setGenerating(true);
    try {
      const result = await generateProviderLicenseKeyAction({
        organizationName,
        licenseType,
        expiresAt: expiresAt.trim() || undefined,
        gracePeriodDays,
        maxUsers: maxUsers.trim() || "",
        maxEmployees: maxEmployees.trim() || "",
        issuedBy,
        notes,
      });

      if (!result.success) {
        notifyError(result.message);
        return;
      }

      setGeneratedKey(result.licenseKey);
      setDecodedClaims(result.claims);
      setStatusPreview(result.statusPreview);
      notifySuccess("Licence key generated successfully.");

      if (publicKeyConfigured) {
        void handleVerify(result.licenseKey, true);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleVerify(keyOverride?: string, silent = false) {
    const key = (keyOverride ?? generatedKey).trim();
    if (!key) {
      if (!silent) notifyError("Generate a licence key first, or paste one to verify.");
      return;
    }
    if (!publicKeyConfigured) {
      if (!silent) {
        notifyError(
          "Licence verification is not configured. Set LICENSE_PUBLIC_KEY_PEM on the server with the Ed25519 public key PEM.",
        );
      }
      return;
    }

    setVerifying(true);
    try {
      const result = await verifyProviderLicenseKeyAction(key);
      if (!result.success) {
        if (!silent) notifyError(result.message);
        return;
      }
      setDecodedClaims(result.claims);
      setStatusPreview(result.statusPreview);
      if (!silent) notifySuccess("Licence key verified successfully.");
    } finally {
      setVerifying(false);
    }
  }

  async function copyGeneratedKey() {
    if (!generatedKey.trim()) {
      notifyError("Nothing to copy yet.");
      return;
    }
    try {
      await navigator.clipboard.writeText(generatedKey);
      notifySuccess("Licence key copied to clipboard.");
    } catch {
      notifyError("Could not copy to clipboard.");
    }
  }

  return (
    <div className="space-y-6">
      <section
        className={cn(
          cardClass,
          "border-amber-300/70 bg-amber-50/80 dark:border-amber-900/70 dark:bg-amber-950/40",
        )}
      >
        <div className="flex gap-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <h2 className="font-heading text-base font-bold tracking-tight text-amber-950 dark:text-amber-100">
              Provider tool only
            </h2>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">
              Do not enable this page on customer installations. The private signing key must remain confidential.
            </p>
          </div>
        </div>
      </section>

      {!privateKeyConfigured ? (
        <section className={cn(cardClass, "border-destructive/40")}>
          <h2 className="font-heading text-base font-bold tracking-tight">Setup required</h2>
          <p className="text-muted-foreground mt-2 text-sm">{PRIVATE_KEY_MISSING_MESSAGE}</p>
        </section>
      ) : null}

      <section className={cardClass}>
        <h2 className="font-heading mb-4 text-base font-bold tracking-tight">Generate licence key</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Organization name" required>
            <Input value={organizationName} onChange={(e) => setOrganizationName(e.target.value)} maxLength={180} />
          </Field>

          <Field label="Licence type" required>
            <select
              className={selectClass}
              value={licenseType}
              onChange={(e) => setLicenseType(e.target.value as LicenseType)}
            >
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="permanent">Permanent</option>
              <option value="suspended">Suspended</option>
            </select>
          </Field>

          <Field label="Expiry date" required={expiryRequired}>
            <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          </Field>

          <Field label="Grace days">
            <Input
              type="number"
              min={0}
              max={3650}
              value={gracePeriodDays}
              onChange={(e) => setGracePeriodDays(e.target.value)}
            />
          </Field>

          <Field label="Max users">
            <Input
              type="number"
              min={0}
              value={maxUsers}
              onChange={(e) => setMaxUsers(e.target.value)}
              placeholder="Unlimited"
            />
          </Field>

          <Field label="Max employees">
            <Input
              type="number"
              min={0}
              value={maxEmployees}
              onChange={(e) => setMaxEmployees(e.target.value)}
              placeholder="Unlimited"
            />
          </Field>

          <Field label="Issued by">
            <Input value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} maxLength={180} />
          </Field>

          <Field label="Product">
            <Input value={HR_PRODUCT_NAME} readOnly disabled className="bg-muted/40" />
          </Field>

          <div className="sm:col-span-2">
            <Field label="Notes">
              <textarea
                className={textareaClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                maxLength={4000}
                rows={3}
              />
            </Field>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void handleGenerate()} disabled={generating || !privateKeyConfigured}>
            {generating ? "Generating..." : "Generate licence key"}
          </Button>
        </div>
      </section>

      {generatedKey ? (
        <section className={cardClass}>
          <h2 className="font-heading mb-2 text-base font-bold tracking-tight">Generated licence key</h2>
          <p className="text-muted-foreground mb-4 text-sm">
            Copy this key and send it to the customer for activation on Settings → Licence & Updates.
          </p>
          <textarea className={cn(textareaClass, "min-h-[160px] font-mono text-xs")} readOnly value={generatedKey} />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void copyGeneratedKey()}>
              <Copy className="mr-2 h-4 w-4" />
              Copy
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleVerify()}
              disabled={verifying || !publicKeyConfigured}
            >
              {verifying ? "Verifying..." : "Verify generated key"}
            </Button>
          </div>
        </section>
      ) : null}

      {decodedClaims ? (
        <section className={cardClass}>
          <h2 className="font-heading mb-4 text-base font-bold tracking-tight">Decoded licence details</h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <DetailRow label="Organization" value={decodedClaims.organizationName} />
            <DetailRow label="Product" value={decodedClaims.productName} />
            <DetailRow label="Licence type" value={decodedClaims.licenseType} />
            <DetailRow label="Issued date" value={formatDateTime(decodedClaims.issuedAt)} />
            <DetailRow label="Expiry date" value={formatDateTime(decodedClaims.expiresAt)} />
            <DetailRow label="Grace days" value={String(decodedClaims.gracePeriodDays)} />
            <DetailRow label="Max users" value={formatLimit(decodedClaims.maxUsers)} />
            <DetailRow label="Max employees" value={formatLimit(decodedClaims.maxEmployees)} />
            <DetailRow label="Issued by" value={decodedClaims.issuedBy ?? "—"} />
            <DetailRow label="Generated at" value={formatDateTime(decodedClaims.generatedAt)} />
            {decodedClaims.notes ? (
              <div className="sm:col-span-2">
                <DetailRow label="Notes" value={decodedClaims.notes} />
              </div>
            ) : null}
            {statusPreview ? (
              <div className="sm:col-span-2">
                <DetailRow label="Status preview" value={statusPreview.summary} />
                {statusPreview.hardStopDateIso ? (
                  <DetailRow label="Hard stop date" value={formatDateTime(statusPreview.hardStopDateIso)} />
                ) : null}
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium">
        {label}
        {required ? <span className="text-destructive ml-1">*</span> : null}
      </Label>
      {children}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border/60 border-b pb-3 last:border-0 last:pb-0 sm:border-0 sm:pb-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="mt-0.5 font-medium">{value || "—"}</dd>
    </div>
  );
}
