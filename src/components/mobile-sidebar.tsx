"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import * as React from "react";

import { NavDatabaseIcon } from "@/components/nav-database-icon";
import { SidebarFooter } from "@/components/sidebar-footer";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { getSidebarNavForRole } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function MobileSidebar({
  role,
  licenseIndicator = null,
}: {
  role: string;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const navItems = getSidebarNavForRole(role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={<Button variant="outline" size="icon" className="lg:hidden" />}
      >
        <Menu className="size-4" />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetHeader className="border-border border-b px-4 py-4 text-left">
          <SheetTitle className="font-heading text-base font-bold">
            <NavDatabaseIcon onClick={() => setOpen(false)} />
          </SheetTitle>
        </SheetHeader>
        <nav className="max-h-[calc(100vh-12rem)] space-y-0.5 overflow-y-auto px-2 py-4">
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
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground",
                )}
              >
                <Icon className="size-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <SidebarFooter licenseIndicator={licenseIndicator} />
      </SheetContent>
    </Sheet>
  );
}
