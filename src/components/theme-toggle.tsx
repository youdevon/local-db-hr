"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const emptySubscribe = () => () => {};

function useHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export type ThemeToggleProps = {
  /** Compact pill switch for tight spaces (e.g. sidebar footer). */
  compact?: boolean;
};

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const hydrated = useHydrated();
  const { theme, setTheme, resolvedTheme } = useTheme();

  if (!hydrated) {
    if (compact) {
      return (
        <div
          className="border-border bg-muted/40 h-[18px] w-8 shrink-0 rounded-md border opacity-50"
          aria-hidden
        />
      );
    }
    return (
      <Button type="button" variant="outline" size="icon" aria-label="Toggle theme">
        <Sun className="size-4 opacity-0" />
      </Button>
    );
  }

  const isDark = resolvedTheme === "dark" || theme === "dark";
  const toggle = () => setTheme(isDark ? "light" : "dark");

  if (compact) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label="Toggle theme"
        onClick={toggle}
        className={cn(
          "border-border/80 bg-sidebar-accent/25 hover:bg-sidebar-accent/35 relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-md border px-0.5 transition-colors",
          "focus-visible:ring-sidebar-ring focus-visible:ring-offset-sidebar focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        )}
      >
        <span
          className={cn(
            "bg-background text-foreground pointer-events-none absolute top-1/2 flex size-[12px] -translate-y-1/2 items-center justify-center rounded-sm shadow-sm ring-1 ring-border/40 transition-[left,right] duration-200 ease-out",
            isDark ? "right-0.5 left-auto" : "left-0.5 right-auto",
          )}
        >
          {isDark ? (
            <Moon className="size-[9px] shrink-0" aria-hidden />
          ) : (
            <Sun className="size-[9px] shrink-0" aria-hidden />
          )}
        </span>
      </button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={toggle}
    >
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
