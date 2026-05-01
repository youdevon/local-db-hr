"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";

import { cn } from "@/lib/utils";

type DataTableColumnHeaderProps<TData, TValue> = {
  column: Column<TData, TValue>;
  title: string;
  className?: string;
};

export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return (
      <span className={cn("text-muted-foreground font-medium", className)}>
        {title}
      </span>
    );
  }

  const sorted = column.getIsSorted();

  return (
    <button
      type="button"
      className={cn(
        "text-muted-foreground hover:text-foreground inline-flex h-8 max-w-full cursor-pointer items-center gap-1 rounded-md px-1 text-left text-xs font-medium transition-colors",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        column.getToggleSortingHandler()?.(event);
      }}
    >
      <span className="truncate">{title}</span>
      {sorted === "asc" ? (
        <ArrowUp className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : sorted === "desc" ? (
        <ArrowDown className="text-foreground size-3.5 shrink-0 opacity-80" aria-hidden />
      ) : (
        <ChevronsUpDown className="size-3.5 shrink-0 opacity-50" aria-hidden />
      )}
    </button>
  );
}
