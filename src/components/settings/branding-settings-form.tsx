"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  resetBrandingLogoAction,
  saveBrandingSettingsAction,
} from "@/actions/branding";
import { AppBrand } from "@/components/app-brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { notifyError, notifySuccess } from "@/lib/notify";

const DEFAULT_COMPANY_NAME = "Local DB HR";

type BrandingSettingsFormProps = {
  initialCompanyName: string | null;
};

const cardClass =
  "rounded-xl border border-border bg-card p-5 shadow-[0_6px_18px_rgba(15,23,42,0.08)] dark:shadow-[0_6px_18px_rgba(0,0,0,0.35)]";

export function BrandingSettingsForm({
  initialCompanyName,
}: BrandingSettingsFormProps) {
  const router = useRouter();
  const [companyName, setCompanyName] = useState(initialCompanyName ?? DEFAULT_COMPANY_NAME);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  async function submitBranding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const formData = new FormData();
      formData.set("companyName", companyName ?? "");
      const result = await saveBrandingSettingsAction(formData);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      setCompanyName(result.settings.companyName ?? DEFAULT_COMPANY_NAME);
      notifySuccess(result.message);
      window.dispatchEvent(new Event("branding-updated"));
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function resetLogo() {
    setResetting(true);
    try {
      const result = await resetBrandingLogoAction();
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      setCompanyName(DEFAULT_COMPANY_NAME);
      notifySuccess(result.message);
      window.dispatchEvent(new Event("branding-updated"));
      router.refresh();
    } finally {
      setResetting(false);
    }
  }

  return (
    <section className={cardClass}>
      <form className="space-y-6" onSubmit={submitBranding}>
        <div className="space-y-2">
          <Label htmlFor="company-name" className="text-sm font-medium">
            Application name
          </Label>
          <Input
            id="company-name"
            className="h-10 rounded-md"
            value={companyName ?? ""}
            onChange={(event) => setCompanyName(event.target.value)}
            placeholder="Local DB HR"
            maxLength={120}
          />
          <p className="text-muted-foreground text-xs">
            This name appears on the login page and in the application header.
          </p>
        </div>

        <div className="space-y-2 rounded-lg border border-border bg-muted/30 px-4 py-4 dark:bg-muted/15">
          <p className="text-muted-foreground text-xs font-medium">Preview</p>
          <p className="text-muted-foreground text-xs">
            Matches header typography (login uses the same typeface at a larger size).
          </p>
          <div className="border-border bg-sidebar/95 rounded-md border px-4 py-3">
            <AppBrand disableFetch branding={{ displayName: companyName }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" className="h-10 rounded-md text-sm font-medium" disabled={saving || resetting}>
            {saving ? "Saving..." : "Save Branding"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-md text-sm font-medium"
            disabled={saving || resetting}
            onClick={() => void resetLogo()}
          >
            {resetting ? "Resetting..." : "Reset to Default Branding"}
          </Button>
        </div>
      </form>
    </section>
  );
}
