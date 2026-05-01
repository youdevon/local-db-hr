"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  className?: string;
};

const linkClass =
  "text-muted-foreground hover:text-primary rounded-md text-sm transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus:outline-none";

const currentClass = "text-foreground text-sm font-medium";

export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          const showLink = Boolean(item.href) && !isLast;

          return (
            <li key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-2">
              {showLink ? (
                <Link href={item.href!} className={linkClass}>
                  {item.label}
                </Link>
              ) : (
                <span
                  className={cn(
                    isLast ? currentClass : "text-muted-foreground text-sm",
                    "max-w-[min(100vw-8rem,20rem)] truncate",
                  )}
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <span className="text-border shrink-0 select-none" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
