"use client";

import { useMemo, useState } from "react";
import { History, ScrollText } from "lucide-react";

import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";

import { AuditTable, type AuditRow } from "./audit-table";
import { SystemAuditTable, type SystemAuditRow } from "./system-audit-table";

type TrailKey = "system" | "login";

type AuditTrailsClientProps = {
  loginRows: AuditRow[];
  systemRows: SystemAuditRow[];
};

type TrailCard = {
  key: TrailKey;
  title: string;
};

const TRAILS: TrailCard[] = [
  {
    key: "login",
    title: "Login Audit Trail",
  },
  {
    key: "system",
    title: "System Activity Audit Trail",
  },
];

export function AuditTrailsClient({ loginRows, systemRows }: AuditTrailsClientProps) {
  const [selected, setSelected] = useState<TrailKey>("system");
  const selectedCard = useMemo(() => TRAILS.find((item) => item.key === selected) ?? TRAILS[0], [selected]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        {TRAILS.map((trail) => {
          const active = selected === trail.key;
          return (
            <button
              key={trail.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(trail.key)}
              className={cn(
                "rounded-xl border p-5 text-left shadow-sm transition-colors",
                "hover:bg-muted/30 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-2",
                active
                  ? "border-blue-200 bg-blue-50/60 dark:border-neutral-700 dark:bg-neutral-800/70"
                  : "border-border bg-card",
              )}
            >
              <h3 className="text-foreground text-sm font-semibold">{trail.title}</h3>
            </button>
          );
        })}
      </section>

      <SectionCard title={selectedCard.title}>
        {selected === "login" ? (
          loginRows.length > 0 ? (
            <AuditTable rows={loginRows} />
          ) : (
            <EmptyState
              icon={ScrollText}
              title="No login audit records loaded"
              description="Login activity will appear here once records are available."
            />
          )
        ) : systemRows.length > 0 ? (
          <SystemAuditTable rows={systemRows} />
        ) : (
          <EmptyState
            icon={History}
            title="No system activity recorded."
            description="System changes and attempted actions will appear here."
          />
        )}
      </SectionCard>
    </div>
  );
}
