"use client";

import { ThemeToggle } from "@/components/theme-toggle";
import { getVersionLabel } from "@/lib/version";

type SidebarFooterTrayProps = {
  collapsed?: boolean;
};

export function SidebarFooterTray({ collapsed = false }: SidebarFooterTrayProps) {
  return (
    <div className="border-border bg-sidebar/95 text-muted-foreground supports-backdrop-filter:backdrop-blur-xs sticky bottom-0 z-20 h-12 shrink-0 border-t px-3">
      <div
        className={
          collapsed
            ? "flex h-full items-center justify-center"
            : "grid h-full grid-cols-[1fr_auto_1fr] items-center"
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
  );
}
