"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const DEFAULT_BRAND_NAME = "Local DB HR";

type BrandingData = {
  companyName?: string | null;
  displayName?: string | null;
};

function normalizeDisplayName(value: unknown): string {
  if (typeof value !== "string") return DEFAULT_BRAND_NAME;
  const trimmed = value.trim();
  return trimmed || DEFAULT_BRAND_NAME;
}

export function AppBrand({
  className,
  textClassName,
  branding,
  disableFetch = false,
  textElement = "span",
}: {
  className?: string;
  textClassName?: string;
  branding?: BrandingData;
  disableFetch?: boolean;
  textElement?: "span" | "h1" | "h2" | "p";
}) {
  const nameFromProps = useMemo(
    () => normalizeDisplayName(branding?.displayName ?? branding?.companyName),
    [branding?.companyName, branding?.displayName],
  );
  const [fetchedName, setFetchedName] = useState<string | null>(null);

  useEffect(() => {
    if (disableFetch) {
      return;
    }

    async function loadBranding() {
      const response = await fetch("/api/branding", { cache: "no-store" }).catch(() => null);
      if (!response || !response.ok) return;
      const data = (await response.json().catch(() => null)) as BrandingData | null;
      if (!data) return;

      setFetchedName(normalizeDisplayName(data.displayName ?? data.companyName));
    }

    void loadBranding();
    const handleBrandingUpdated = () => {
      void loadBranding();
    };
    window.addEventListener("branding-updated", handleBrandingUpdated);

    return () => {
      window.removeEventListener("branding-updated", handleBrandingUpdated);
    };
  }, [disableFetch]);

  const displayName = disableFetch ? nameFromProps : (fetchedName ?? nameFromProps);

  const TextTag = textElement;

  return (
    <div className={cn("flex h-10 min-w-0 shrink items-center overflow-hidden", className)}>
      <TextTag
        className={cn(
          "block w-full truncate text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100",
          textClassName,
          /* Heading (Manrope) must win over any accidental font-* in textClassName */
          "font-heading",
        )}
      >
        {displayName}
      </TextTag>
    </div>
  );
}
