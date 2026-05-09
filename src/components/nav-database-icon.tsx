"use client";

import Link from "next/link";
import { Database } from "lucide-react";

import { cn } from "@/lib/utils";

export function NavDatabaseIcon({
  className,
  onClick,
}: {
  className?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href="/dashboard"
      className={cn(
        "focus-visible:ring-ring inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
        className,
      )}
      aria-label="Go to dashboard"
      onClick={onClick}
    >
      <Database className="h-5 w-5" />
    </Link>
  );
}
