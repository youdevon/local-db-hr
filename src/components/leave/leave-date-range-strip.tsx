"use client";

import { useMemo } from "react";

import { eachLocalDayInclusive, formatLocalIsoDate, isWeekdayLocal, parseIsoLocal } from "@/lib/leave-days";
import { cn } from "@/lib/utils";

type Props = {
  startDate: string;
  endDate: string;
  /** ISO date → holiday name */
  holidays: Record<string, string>;
  className?: string;
};

export function LeaveDateRangeStrip({ startDate, endDate, holidays, className }: Props) {
  const days = useMemo(() => {
    const start = parseIsoLocal(startDate);
    const end = parseIsoLocal(endDate);
    if (!start || !end || end < start) return [];
    return eachLocalDayInclusive(start, end);
  }, [startDate, endDate]);

  if (days.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-muted-foreground text-xs font-medium">Days in selected range</p>
      <div className="flex flex-wrap gap-1">
        {days.map((d) => {
          const iso = formatLocalIsoDate(d);
          const weekend = !isWeekdayLocal(d);
          const hol = holidays[iso];
          const countsAsLeave = isWeekdayLocal(d) && !hol;
          return (
            <span
              key={iso}
              title={
                hol
                  ? `${iso}: ${hol} (public holiday — excluded from working-day total)`
                  : weekend
                    ? `${iso}: Weekend (excluded)`
                    : `${iso}: Working day (included)`
              }
              className={cn(
                "inline-flex min-w-[2.75rem] flex-col rounded-md border px-1.5 py-1 text-center text-[10px] leading-tight sm:text-xs",
                hol
                  ? "border-orange-400/80 bg-orange-500/15 text-orange-950 dark:border-orange-600 dark:bg-orange-950/40 dark:text-orange-100"
                  : weekend
                    ? "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                    : countsAsLeave
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/35 dark:text-emerald-100"
                      : "border-border bg-card",
              )}
            >
              <span className="font-mono">{iso.slice(5)}</span>
              {hol ? <span className="truncate text-[9px] opacity-90">{hol}</span> : null}
            </span>
          );
        })}
      </div>
      <p className="text-muted-foreground text-[11px]">
        Orange = public holiday (excluded). Grey = weekend (excluded). Green = counts toward working-day leave.
      </p>
    </div>
  );
}
