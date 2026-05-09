"use client";

import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { ThemeToggle } from "@/components/theme-toggle";
import { getVersionLabel } from "@/lib/version";

export type SidebarLicenseIndicator = {
  href?: string | null;
  text: string;
  fullText?: string;
  tone: "success" | "caution" | "danger";
};

type SidebarFooterTrayProps = {
  collapsed?: boolean;
  licenseIndicator?: SidebarLicenseIndicator | null;
};

export function SidebarFooterTray({ collapsed = false, licenseIndicator = null }: SidebarFooterTrayProps) {
  const indicatorClass = licenseToneClass(
    licenseIndicator?.tone ?? "caution",
    collapsed
      ? "flex w-full items-center justify-center rounded-md border px-2 py-1.5 text-center text-xs font-medium leading-tight transition-colors"
      : "flex w-full max-w-full items-center justify-center rounded-md border px-3 py-1.5 text-center text-xs font-medium leading-tight transition-colors",
  );

  return (
    <div className="bg-sidebar/95 text-muted-foreground supports-backdrop-filter:backdrop-blur-xs sticky bottom-0 z-20 shrink-0">
      {licenseIndicator ? (
        <div className="px-3 pb-2">
          {licenseIndicator.href ? (
            <Link
              href={licenseIndicator.href}
              title={licenseIndicator.fullText ?? licenseIndicator.text}
              className={`${indicatorClass} cursor-pointer`}
            >
              {collapsed ? <ShieldCheck className="size-3.5 shrink-0" /> : <span>{licenseIndicator.text}</span>}
            </Link>
          ) : (
            <div
              title={licenseIndicator.fullText ?? licenseIndicator.text}
              aria-disabled="true"
              className={`${indicatorClass} cursor-default`}
            >
              {collapsed ? <ShieldCheck className="size-3.5 shrink-0" /> : <span>{licenseIndicator.text}</span>}
            </div>
          )}
        </div>
      ) : null}
      <div className="border-border border-t px-3">
        <div
          className={
            collapsed
              ? "flex h-12 items-center justify-center"
              : "grid h-12 grid-cols-[1fr_auto_1fr] items-center"
          }
        >
          {!collapsed ? (
            <span className="col-start-2 min-w-0 truncate text-center text-xs leading-none whitespace-nowrap">
              {getVersionLabel()}
            </span>
          ) : null}
          <div className={collapsed ? "" : "col-start-3 justify-self-end"}>
            <ThemeToggle compact />
          </div>
        </div>
      </div>
    </div>
  );
}

function licenseToneClass(
  tone: SidebarLicenseIndicator["tone"],
  base: string,
): string {
  if (tone === "danger") {
    return `${base} border-red-300/70 bg-red-50/80 text-red-800 dark:border-red-900/70 dark:bg-red-950/40 dark:text-red-200`;
  }
  if (tone === "success") {
    return `${base} border-emerald-300/70 bg-emerald-50/70 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/35 dark:text-emerald-200`;
  }
  return `${base} border-amber-300/70 bg-amber-50/80 text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-200`;
}
