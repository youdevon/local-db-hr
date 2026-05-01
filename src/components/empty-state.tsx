import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border bg-card text-card-foreground flex flex-col items-center justify-center rounded-xl border border-dashed px-6 py-16 text-center shadow-sm",
        className,
      )}
    >
      {Icon ? (
        <div className="bg-muted text-muted-foreground mb-4 inline-flex size-12 items-center justify-center rounded-full">
          <Icon className="size-6" />
        </div>
      ) : null}
      <h3 className="text-foreground text-base font-semibold">{title}</h3>
      {description ? (
        <p className="text-muted-foreground mt-2 max-w-md text-sm">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
