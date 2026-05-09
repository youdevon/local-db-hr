"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { updateOwnEmployeePersonalInfoAction } from "@/actions/profile-self-service";
import { SectionCard } from "@/components/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ProfilePersonalInfoFields } from "@/lib/types/profile-personal-info";
import { notifyError, notifySuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";

export type ProfilePersonalInfo = ProfilePersonalInfoFields;

type Props = {
  initialValues: ProfilePersonalInfo;
  /** When false, omit the outer SectionCard title wrapper (e.g. dialog). */
  showSectionCard?: boolean;
  /** Dialog uses a scrollable body and sticky-style footer for actions. */
  variant?: "default" | "dialog";
  onSaved?: () => void;
};

export function ProfilePersonalInfoForm({
  initialValues,
  showSectionCard = true,
  variant = "default",
  onSaved,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<ProfilePersonalInfo>(initialValues);
  const [saving, setSaving] = useState(false);

  const hasChanges = useMemo(
    () => JSON.stringify(values) !== JSON.stringify(initialValues),
    [initialValues, values],
  );

  function setField<K extends keyof ProfilePersonalInfo>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function reset() {
    setValues(initialValues);
  }

  async function save() {
    setSaving(true);
    try {
      const result = await updateOwnEmployeePersonalInfoAction(values);
      if (!result.success) {
        notifyError(result.message);
        return;
      }
      notifySuccess(result.message);
      onSaved?.();
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const sections = (
    <div className={cn("space-y-6", variant === "dialog" && "pb-1")}>
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Contact Information</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="pf-mobileNumber"
            label="Primary Phone"
            value={values.mobileNumber}
            onChange={(v) => setField("mobileNumber", v)}
          />
          <Field
            id="pf-homeNumber"
            label="Secondary Phone"
            value={values.homeNumber}
            onChange={(v) => setField("homeNumber", v)}
          />
          <Field
            id="pf-personalEmail"
            label="Personal Email"
            type="email"
            value={values.personalEmail}
            onChange={(v) => setField("personalEmail", v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Address</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="pf-addressLine1"
            label="Address Line 1"
            value={values.addressLine1}
            onChange={(v) => setField("addressLine1", v)}
          />
          <Field
            id="pf-addressLine2"
            label="Address Line 2"
            value={values.addressLine2}
            onChange={(v) => setField("addressLine2", v)}
          />
          <Field
            id="pf-communityCity"
            label="City"
            value={values.communityCity}
            onChange={(v) => setField("communityCity", v)}
          />
          <Field
            id="pf-country"
            label="Country"
            value={values.country}
            onChange={(v) => setField("country", v)}
          />
          <Field
            id="pf-regionMunicipality"
            label="Region/Municipality"
            value={values.regionMunicipality}
            onChange={(v) => setField("regionMunicipality", v)}
          />
          <Field
            id="pf-postalCode"
            label="Postal Code"
            value={values.postalCode}
            onChange={(v) => setField("postalCode", v)}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Next of Kin</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="pf-nextOfKinFullName"
            label="Full Name"
            value={values.nextOfKinFullName}
            onChange={(v) => setField("nextOfKinFullName", v)}
          />
          <Field
            id="pf-nextOfKinRelationship"
            label="Relationship"
            value={values.nextOfKinRelationship}
            onChange={(v) => setField("nextOfKinRelationship", v)}
          />
          <Field
            id="pf-nextOfKinMobileNumber"
            label="Phone"
            value={values.nextOfKinMobileNumber}
            onChange={(v) => setField("nextOfKinMobileNumber", v)}
          />
          <Field
            id="pf-nextOfKinAlternativeNumber"
            label="Alternate Phone"
            value={values.nextOfKinAlternativeNumber}
            onChange={(v) => setField("nextOfKinAlternativeNumber", v)}
          />
          <Field
            id="pf-nextOfKinEmail"
            label="Email"
            type="email"
            value={values.nextOfKinEmail}
            onChange={(v) => setField("nextOfKinEmail", v)}
            className="sm:col-span-2"
          />
          <Field
            id="pf-nextOfKinAddress"
            label="Address"
            value={values.nextOfKinAddress}
            onChange={(v) => setField("nextOfKinAddress", v)}
            className="sm:col-span-2"
          />
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Emergency Contact</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            id="pf-emergencyContactName"
            label="Full Name"
            value={values.emergencyContactName}
            onChange={(v) => setField("emergencyContactName", v)}
          />
          <Field
            id="pf-emergencyContactRelationship"
            label="Relationship"
            value={values.emergencyContactRelationship}
            onChange={(v) => setField("emergencyContactRelationship", v)}
          />
          <Field
            id="pf-emergencyContactMobileNumber"
            label="Phone"
            value={values.emergencyContactMobileNumber}
            onChange={(v) => setField("emergencyContactMobileNumber", v)}
          />
          <Field
            id="pf-emergencyContactAlternativeNumber"
            label="Alternate Phone"
            value={values.emergencyContactAlternativeNumber}
            onChange={(v) => setField("emergencyContactAlternativeNumber", v)}
          />
          <Field
            id="pf-emergencyContactEmail"
            label="Email"
            type="email"
            value={values.emergencyContactEmail}
            onChange={(v) => setField("emergencyContactEmail", v)}
            className="sm:col-span-2"
          />
          <Field
            id="pf-emergencyContactAddress"
            label="Address"
            value={values.emergencyContactAddress}
            onChange={(v) => setField("emergencyContactAddress", v)}
            className="sm:col-span-2"
          />
        </div>
      </section>
    </div>
  );

  const actions = (
    <div className="flex flex-wrap gap-2">
      <Button type="button" className="h-10 rounded-md" onClick={() => void save()} disabled={saving || !hasChanges}>
        {saving ? "Saving..." : "Save changes"}
      </Button>
      <Button type="button" variant="outline" className="h-10 rounded-md" onClick={reset} disabled={saving || !hasChanges}>
        Cancel
      </Button>
    </div>
  );

  if (variant === "dialog") {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">{sections}</div>
        <div className="shrink-0 border-t border-border bg-muted/40 px-6 py-4">{actions}</div>
      </div>
    );
  }

  const inner = (
    <div className="grid gap-6">
      {sections}
      {actions}
    </div>
  );

  if (!showSectionCard) {
    return inner;
  }

  return <SectionCard title="Edit Personal Information">{inner}</SectionCard>;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
  className,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "email";
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>
      <Input
        id={id}
        type={type}
        className="h-10 rounded-md"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
