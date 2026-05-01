import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  title: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  className,
}: StatCardProps) {
  return (
    <Card
      size="sm"
      className={cn(
        "gap-0 overflow-hidden transition-[box-shadow,transform] duration-200",
        className,
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium leading-snug">{title}</CardTitle>
        {Icon ? <Icon className="text-muted-foreground size-4 shrink-0" aria-hidden /> : null}
      </CardHeader>
      <CardContent className="pt-0">
        <div className="text-foreground text-2xl font-semibold tabular-nums tracking-tight sm:text-3xl">
          {value}
        </div>
        {hint ? <p className="text-muted-foreground mt-1.5 text-xs leading-relaxed">{hint}</p> : null}
      </CardContent>
    </Card>
  );
}
