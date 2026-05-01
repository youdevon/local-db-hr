"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import type { EmployeeFilterOption } from "@/lib/reports/report-definitions";

type EmployeeComboboxProps = {
  options: EmployeeFilterOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  allowClear?: boolean;
};

export function EmployeeCombobox({
  options,
  value,
  onChange,
  placeholder = "Search by name or file number",
  disabled = false,
  allowClear = true,
}: EmployeeComboboxProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = useMemo(() => options.find((option) => option.value === value) ?? null, [options, value]);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const normalizedQuery = useDebouncedValue(query.trim().toLowerCase(), 300);
  const filtered = useMemo(() => {
    if (!normalizedQuery) return options.slice(0, 20);
    if (normalizedQuery.length < 2) return [];
    return options
      .filter((option) => option.searchText.includes(normalizedQuery))
      .slice(0, 20);
  }, [options, normalizedQuery]);

  const emptyLabel = options.length === 0 ? "No employees found." : "No matching employees found.";

  const inputValue = open ? query : selected?.label ?? "";
  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          className="h-10 rounded-md pr-16 text-sm"
          onFocus={() => {
            setOpen(true);
            setQuery(selected?.label ?? "");
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange("");
            setOpen(true);
          }}
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-1">
          {allowClear && value ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7 rounded-md"
              onClick={() => {
                onChange("");
                setQuery("");
                setOpen(false);
              }}
              disabled={disabled}
              aria-label="Clear employee selection"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <ChevronsUpDown className="text-muted-foreground h-4 w-4" />
        </div>
      </div>
      {open ? (
        <div className="border-border bg-popover text-popover-foreground absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border shadow-lg">
          {filtered.length ? (
            <ul className="py-1">
              {filtered.map((option) => {
                const isActive = option.value === value;
                return (
                  <li key={option.value}>
                    <button
                      type="button"
                      className={cn(
                        "hover:bg-muted/60 flex w-full items-start gap-2 px-3 py-2 text-left text-sm",
                        isActive ? "bg-muted/40" : "",
                      )}
                      onClick={() => {
                        onChange(option.value);
                        setQuery("");
                        setOpen(false);
                      }}
                    >
                      <Check className={cn("mt-0.5 h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-0")} />
                      <div className="min-w-0">
                        <p className="truncate">{option.fullName} - File # {option.fileNumber || "N/A"}</p>
                        <p className="text-muted-foreground truncate text-xs">{option.label}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="text-muted-foreground px-3 py-3 text-sm">{emptyLabel}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
