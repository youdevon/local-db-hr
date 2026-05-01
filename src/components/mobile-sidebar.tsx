"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import * as React from "react";

import { SidebarFooter } from "@/components/sidebar-footer";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { brandIcon, getSidebarNavForRole } from "@/config/navigation";
import { cn } from "@/lib/utils";

const BrandIcon = brandIcon;

export function MobileSidebar({ role }: { role: string }) {
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
          <SheetTitle className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary inline-flex size-9 items-center justify-center rounded-lg">
              <BrandIcon className="size-5" />
            </span>
            <span className="truncate">Local DB HR</span>
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
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
