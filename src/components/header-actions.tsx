"use client";

import Link from "next/link";

import type { SessionUser } from "@/lib/session";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";

import { LogoutButton } from "@/components/logout-button";
import { MobileSidebar } from "@/components/mobile-sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function HeaderActions({
  user,
  licenseIndicator = null,
}: {
  user: SessionUser;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  return (
    <div className="flex items-center gap-2">
      <MobileSidebar role={user.role} licenseIndicator={licenseIndicator} />
      <Separator orientation="vertical" className="hidden h-8 sm:block" />
      <Link
        href="/profile"
        aria-label="View my profile"
        className="border-border bg-card text-card-foreground hover:bg-accent/40 flex h-10 w-10 cursor-pointer items-center gap-2 overflow-hidden rounded-md border px-1.5 shadow-[var(--shadow-card)] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:w-[220px] sm:px-3"
      >
        <Avatar className="size-7 shrink-0 rounded-full">
          <AvatarFallback className="rounded-full bg-primary/10 text-primary text-xs font-semibold">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        <div className="hidden min-w-0 leading-tight sm:block">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
      </Link>
      <LogoutButton />
    </div>
  );
}
