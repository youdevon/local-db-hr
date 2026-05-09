"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useEffect, useState } from "react";

import { NavDatabaseIcon } from "@/components/nav-database-icon";
import { SidebarFooter } from "@/components/sidebar-footer";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";
import { Button } from "@/components/ui/button";
import { getSidebarNavForRole } from "@/config/navigation";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "local-db-hr-sidebar-collapsed";

export function Sidebar({
  role,
  licenseIndicator = null,
}: {
  role: string;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const navItems = getSidebarNavForRole(role);

  useEffect(() => {
    const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
    // Hydrate from localStorage after mount (server render uses default width).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional post-hydration sync
    setCollapsed(saved === "true");
  }, []);

  function toggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      return next;
    });
  }

  return (
    <aside
      className={cn(
        "border-border bg-sidebar text-sidebar-foreground relative flex h-full min-h-0 shrink-0 flex-col border-r transition-all duration-200 ease-in-out",
        collapsed ? "w-20" : "w-64",
      )}
    >
      <div
        className={cn(
          "border-border bg-sidebar/95 supports-backdrop-filter:backdrop-blur-xs sticky top-0 z-20 flex h-16 shrink-0 items-center border-b",
          collapsed ? "justify-between px-2" : "gap-2 px-4",
        )}
      >
        <NavDatabaseIcon className={collapsed ? "" : "shrink-0"} />
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn(
            "inline-flex h-9 w-9 items-center justify-center rounded-md text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:outline-none dark:text-neutral-700 dark:hover:bg-neutral-800 dark:hover:text-neutral-400",
            collapsed ? "" : "ml-auto",
          )}
          onClick={toggleSidebar}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <PanelLeftClose className="h-4 w-4" strokeWidth={1.75} />
          )}
        </Button>
      </div>
      <nav className="min-h-0 flex-1 space-y-0.5 overflow-y-auto overscroll-contain px-2 py-2 pb-2">
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "h-10 rounded-md text-sm font-medium transition-colors",
                collapsed ? "flex w-full items-center justify-center px-0" : "flex items-center justify-start gap-3 px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed ? <span className="truncate text-sm font-medium">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
      <SidebarFooter collapsed={collapsed} licenseIndicator={licenseIndicator} />
    </aside>
  );
}
