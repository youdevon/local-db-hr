"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Label } from "@/components/ui/label";

type Option = { contractId: string; label: string };

type ProfileContractSelectProps = {
  options: Option[];
  value: string;
  disabled?: boolean;
  /** When false, omit the visible label (e.g. when the parent card already shows "Contract Period"). */
  showLabel?: boolean;
};

export function ProfileContractSelect({
  options,
  value,
  disabled,
  showLabel = true,
}: ProfileContractSelectProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">No contracts on file.</p>
    );
  }

  return (
    <div className="space-y-2">
      {showLabel ? <Label htmlFor="profile-contract-select">Contract Period</Label> : null}
      <select
        id="profile-contract-select"
        aria-label={showLabel ? undefined : "Contract period"}
        className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-10 w-full max-w-xl rounded-md border px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50"
        value={value}
        disabled={disabled || pending}
        onChange={(e) => {
          const id = e.target.value;
          startTransition(() => {
            const qs = new URLSearchParams();
            if (id) qs.set("contractId", id);
            router.push(qs.toString() ? `/profile?${qs.toString()}` : "/profile");
          });
        }}
      >
        {options.map((o) => (
          <option key={o.contractId} value={o.contractId}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
