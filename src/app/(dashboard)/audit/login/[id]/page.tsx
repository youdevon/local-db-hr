import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { displayAuditDeviceName, displayAuditIp } from "@/lib/audit-display";
import { prisma } from "@/lib/prisma";
import { ScrollText } from "lucide-react";

import { AuditLoginDetailFeedback } from "./audit-login-detail-feedback";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Login Audit Detail",
};

type LoginAuditDetailRow = {
  id: string;
  user_id: string | null;
  email_attempted: string | null;
  action: string;
  success: boolean;
  ip_address: string | null;
  device_name: string | null;
  user_agent: string | null;
  failure_reason: string | null;
  created_at: Date;
  full_name: string | null;
  initials: string | null;
  role: string | null;
  department: string | null;
};

function formatDateTime(value: Date | null | undefined) {
  if (!value) return "—";
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(value);
  return formatted.replace(" am", " AM").replace(" pm", " PM");
}

function formatActionLabel(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "—";
  const known: Record<string, string> = {
    login: "Login",
    failed_login: "Failed Login",
    logout: "Logout",
    password_change: "Password Change",
    account_locked: "Account Locked",
  };
  if (known[normalized]) return known[normalized];
  return normalized
    .split("_")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="text-foreground text-sm font-medium break-words">{value}</div>
    </div>
  );
}

async function fetchLoginAuditDetail(id: string): Promise<LoginAuditDetailRow | null> {
  const rows = await prisma.$queryRaw<LoginAuditDetailRow[]>(Prisma.sql`
    SELECT
      l.id::text AS id,
      l.user_id::text AS user_id,
      l.email_attempted,
      l.action,
      l.success,
      l.ip_address::text AS ip_address,
      l.device_name,
      l.user_agent,
      l.failure_reason,
      l.created_at,
      p.full_name,
      p.initials,
      p.role,
      p.department
    FROM public.login_audit_logs l
    LEFT JOIN public.user_profiles p ON p.user_id = l.user_id
    WHERE l.id = ${id}::uuid
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export default async function LoginAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  let row: LoginAuditDetailRow | null = null;
  let loadError = false;

  try {
    row = await fetchLoginAuditDetail(id);
  } catch {
    loadError = true;
  }

  const ipDisplay = displayAuditIp(row?.ip_address ?? null);
  const deviceDisplay = displayAuditDeviceName(row?.device_name, row?.user_agent ?? null);
  const userName = row?.full_name?.trim() || "Unknown";
  const attemptedEmail = row?.email_attempted?.trim() || "—";
  const actionLabel = formatActionLabel(row?.action);

  if (loadError) {
    return (
      <AuditLoginDetailFeedback loadError>
        <div className="space-y-6">
          <PageHeader
            breadcrumbItems={[
              { label: "Dashboard", href: "/" },
              { label: "Audit", href: "/audit" },
              { label: "Login Audit Detail" },
            ]}
            backFallbackHref="/audit"
            title="Login Audit Detail"
            icon="shield-check"
            description="Review the full login audit record."
          />
          <EmptyState
            icon={ScrollText}
            title="Could not load audit log"
            description="Something went wrong while loading this record. Return to the audit list and try again."
          />
        </div>
      </AuditLoginDetailFeedback>
    );
  }

  if (!row) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Audit", href: "/audit" },
            { label: "Login Audit Detail" },
          ]}
          backFallbackHref="/audit"
          title="Login Audit Detail"
          icon="shield-check"
          description="Review the full login audit record."
        />
        <EmptyState
          icon={ScrollText}
          title="Login audit record not found."
          description="This login audit record does not exist or may have been removed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Audit", href: "/audit" },
          { label: "Login Audit Detail" },
        ]}
        backFallbackHref="/audit"
        title="Login Audit Detail"
        icon="shield-check"
        description="Review the full login audit record."
      />

      <div className="space-y-5">
        <SectionCard title="Login Summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="User Name" value={userName} />
            <Field label="Email" value={attemptedEmail} />
            <Field label="Action" value={actionLabel} />
            <Field label="Date / Time" value={formatDateTime(row.created_at)} />
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Failure & Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Success"
                value={
                  <StatusBadge tone={row.success ? "success" : "danger"}>
                    {row.success ? "Success" : "Failed"}
                  </StatusBadge>
                }
              />
              <Field label="Failure Reason" value={row.failure_reason?.trim() || "—"} />
              <div className="space-y-1">
                <p className="text-muted-foreground text-xs font-medium">Log ID</p>
                <div className="text-foreground bg-muted/30 border-border rounded-md border px-2 py-1.5 font-mono text-xs break-all">
                  {row.id}
                </div>
              </div>
              <Field label="User ID" value={row.user_id ?? "—"} />
            </div>
          </SectionCard>

          <SectionCard title="Network & Device">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="IP Address" value={ipDisplay} />
              <Field label="Device Name" value={deviceDisplay} />
              <div className="space-y-1 sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium">User Agent</p>
                <div className="text-foreground bg-muted/30 border-border rounded-md border p-3 text-sm leading-relaxed break-words whitespace-pre-wrap">
                  {row.user_agent?.trim() ? row.user_agent : "—"}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
