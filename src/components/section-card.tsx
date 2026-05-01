import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SectionCardProps = {
  title: string;
  description?: string;
  /** e.g. primary link or button aligned with the section title on larger screens. */
  headerActions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
};

export function SectionCard({
  title,
  description,
  headerActions,
  className,
  children,
}: SectionCardProps) {
  return (
    <Card className={cn("rounded-xl border shadow-sm", className)}>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-foreground text-base font-semibold tracking-tight">{title}</CardTitle>
            {description ? (
              <p className="text-muted-foreground mt-1 text-sm">{description}</p>
            ) : null}
          </div>
          {headerActions ? <div className="shrink-0">{headerActions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="text-sm leading-relaxed">{children}</CardContent>
    </Card>
  );
}
