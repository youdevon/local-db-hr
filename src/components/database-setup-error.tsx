import { AlertTriangle } from "lucide-react";

import { PageHeader } from "@/components/page-header";

type Props = {
  message: string;
  details: string[];
};

export function DatabaseSetupError({ message, details }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader
        hideBreadcrumbNav
        title="Database setup required"
        icon="alert"
        description="The application cannot load HR data until the database schema is initialized."
      />
      <section className="border-destructive/30 bg-destructive/5 rounded-xl border p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="bg-destructive/10 text-destructive inline-flex size-10 shrink-0 items-center justify-center rounded-full">
            <AlertTriangle className="size-5" aria-hidden />
          </span>
          <div className="space-y-3">
            <p className="text-foreground text-sm font-medium">{message}</p>
            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
              {details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
