import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "default" | "success" | "warning" | "danger" | "muted";

const toneClass: Record<StatusTone, string> = {
  default: "border-transparent bg-primary/10 text-primary",
  success: "border-transparent bg-[color:var(--success)]/15 text-[color:var(--success)]",
  warning: "border-transparent bg-[color:var(--warning)]/15 text-[color:var(--warning)]",
  danger: "border-transparent bg-destructive/10 text-destructive",
  muted: "border-transparent bg-muted text-muted-foreground",
};

export function StatusBadge({
  children,
  tone = "default",
  className,
}: {
  children: React.ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium", toneClass[tone], className)}
    >
      {children}
    </Badge>
  );
}
