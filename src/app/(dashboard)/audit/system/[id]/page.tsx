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

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "System Audit Detail",
};

type SystemAuditDetailRow = {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  module: string | null;
  action: string | null;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  success: boolean;
  failure_reason: string | null;
  ip_address: string | null;
  device_name: string | null;
  user_agent: string | null;
  metadata: unknown;
  created_at: Date;
};

type ResolvedAuditTarget = {
  display: string;
  nameOnly: string;
};

type ResolvedAuditActor = {
  name: string;
  email: string;
};

type MetadataChange = {
  field: string;
  label?: string;
  type: "changed" | "added" | "removed";
  before?: unknown;
  after?: unknown;
  format?: "text" | "currency" | "date" | "number" | "boolean" | "allowance";
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
  return normalized
    .split("_")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

function metadataChangedFields(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object") return [];
  const data = metadata as Record<string, unknown>;
  const changed = data.changedFields;
  if (Array.isArray(changed)) {
    return changed
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
  }
  return [];
}

function getMetadataChanges(metadata: unknown): MetadataChange[] {
  if (!metadata || typeof metadata !== "object") return [];
  const data = metadata as Record<string, unknown>;
  const changes = data.changes;
  if (!Array.isArray(changes)) return [];
  return changes.filter((item): item is MetadataChange => {
    if (!item || typeof item !== "object") return false;
    const row = item as Record<string, unknown>;
    return (
      typeof row.field === "string" &&
      typeof row.type === "string" &&
      (row.type === "changed" || row.type === "added" || row.type === "removed")
    );
  });
}

function formatTtd(value: number): string {
  return new Intl.NumberFormat("en-TT", {
    style: "currency",
    currency: "TTD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatValue(value: unknown, format: MetadataChange["format"], field: string, label?: string): string {
  if (value === null || value === undefined || value === "") return "—";

  if (format === "currency") {
    const n = Number(value);
    return Number.isFinite(n) ? formatTtd(n) : String(value);
  }
  if (format === "date") {
    const raw = String(value);
    const d = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(d.getTime())) return raw;
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(d);
  }
  if (format === "boolean") return value ? "Yes" : "No";
  if (format === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    const l = (label ?? "").toLowerCase();
    return l.includes("leave") || field.includes("entitlement") ? `${n} days` : String(n);
  }
  if (format === "allowance" && typeof value === "object" && value) {
    const row = value as Record<string, unknown>;
    const description = String(row.description ?? "").trim();
    const type = String(row.allowanceType ?? row.allowance_type ?? "").trim();
    const amount = Number(row.amount);
    const frequencyRaw = String(row.frequency ?? "").trim().replaceAll("_", " ");
    const frequency = frequencyRaw ? frequencyRaw.replace(/\b\w/g, (c) => c.toUpperCase()) : "Monthly";
    const allowanceName = description || (type ? `${type.replace(/\b\w/g, (c) => c.toUpperCase())} Allowance` : "Allowance");
    return Number.isFinite(amount) ? `${allowanceName}, ${formatTtd(amount)} ${frequency.toLowerCase()}` : allowanceName;
  }

  if ((field.toLowerCase().includes("id") || (label ?? "").toLowerCase().includes("id")) && typeof value === "string") {
    const clean = value.replace(/\s+/g, "");
    if (clean.length > 4) return `ending ${clean.slice(-4)}`;
  }
  return String(value);
}

function changeLine(change: MetadataChange): string {
  const label = change.label?.trim() || change.field.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (change.type === "changed") {
    return `${label}: ${formatValue(change.before, change.format, change.field, change.label)} -> ${formatValue(change.after, change.format, change.field, change.label)}`;
  }
  if (change.type === "added") {
    return `${label}: ${formatValue(change.after, change.format, change.field, change.label)}`;
  }
  return `${label}: ${formatValue(change.before, change.format, change.field, change.label)}`;
}

function buildUserDisplayName(user: {
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
}): string {
  const first = user.first_name?.trim() || "";
  const last = user.last_name?.trim() || "";
  const employeeName = [first, last].filter(Boolean).join(" ");
  if (employeeName) return employeeName;
  if (user.full_name?.trim()) return user.full_name.trim();
  if (user.email?.trim()) return user.email.trim();
  return "Unknown User";
}

function isRawUserIdLabel(value: string): boolean {
  return /^User ID:\s*[0-9a-f-]{36}$/i.test(value.trim());
}

async function resolveAuditTarget(row: SystemAuditDetailRow): Promise<ResolvedAuditTarget> {
  const targetType = row.target_type?.trim().toLowerCase();
  const targetId = row.target_id?.trim() || null;
  const targetLabel = row.target_label?.trim() || "";

  if (targetType === "employee" && targetId) {
    const employeeRows = await prisma.$queryRaw<Array<{ first_name: string | null; last_name: string | null }>>(
      Prisma.sql`
        SELECT first_name, last_name
        FROM public.employees
        WHERE id = ${targetId}::uuid
        LIMIT 1
      `,
    );
    const employee = employeeRows[0];
    if (employee) {
      const name = [employee.first_name?.trim() || "", employee.last_name?.trim() || ""].filter(Boolean).join(" ");
      if (name) return { display: `Employee: ${name}`, nameOnly: name };
    }
    if (targetLabel) return { display: targetLabel, nameOnly: targetLabel };
    return { display: "Employee: Unknown", nameOnly: "Unknown" };
  }

  if (targetType === "contract" && targetId) {
    const contractRows = await prisma.$queryRaw<
      Array<{
        minute_number: string | null;
        contract_number: string | null;
      }>
    >(
      Prisma.sql`
        SELECT c.minute_number, c.contract_number
        FROM public.contracts c
        WHERE c.id = ${targetId}::uuid
        LIMIT 1
      `,
    );
    const contract = contractRows[0];
    if (contract) {
      const minute = contract.minute_number?.trim() || "";
      const number = contract.contract_number?.trim() || "";
      if (minute && number) return { display: `Contract: ${minute} / ${number}`, nameOnly: `${minute} / ${number}` };
      if (minute) return { display: `Contract: ${minute}`, nameOnly: minute };
      if (number) return { display: `Contract: ${number}`, nameOnly: number };
      return { display: "Contract: No assigned number", nameOnly: "No assigned number" };
    }
    if (targetLabel) return { display: targetLabel, nameOnly: targetLabel };
    return { display: "—", nameOnly: "—" };
  }

  if (targetType === "user" && targetId) {
    const userRows = await prisma.$queryRaw<
      Array<{
        id: string;
        email: string | null;
        full_name: string | null;
        employee_id: string | null;
        first_name: string | null;
        last_name: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          u.id::text AS id,
          u.email,
          p.full_name,
          p.employee_id::text AS employee_id,
          e.first_name,
          e.last_name
        FROM public.users u
        LEFT JOIN public.user_profiles p
          ON p.user_id = u.id
        LEFT JOIN public.employees e
          ON e.id = p.employee_id
        WHERE u.id = ${targetId}::uuid
        LIMIT 1
      `,
    );
    const user = userRows[0];
    if (user) {
      const name = buildUserDisplayName(user);
      return { display: `User: ${name}`, nameOnly: name };
    }
    if (targetLabel && !isRawUserIdLabel(targetLabel)) return { display: targetLabel, nameOnly: targetLabel };
    return { display: "User: Unknown", nameOnly: "Unknown" };
  }

  if (targetType === "settings") {
    if (targetLabel) return { display: targetLabel, nameOnly: targetLabel };
    return { display: "—", nameOnly: "—" };
  }

  if (targetLabel) return { display: targetLabel, nameOnly: targetLabel };
  return { display: "—", nameOnly: "—" };
}

function buildSystemAuditDescription(row: SystemAuditDetailRow, resolvedTarget: ResolvedAuditTarget): string {
  if (row.metadata && typeof row.metadata === "object") {
    const meta = row.metadata as Record<string, unknown>;
    const summary = typeof meta.summary === "string" ? meta.summary.trim() : "";
    if (summary) return summary;
  }

  const action = (row.action ?? "").trim().toLowerCase();
  const changedFields = metadataChangedFields(row.metadata);
  const appendChanged =
    changedFields.length > 0 ? ` Changed: ${changedFields.join(", ")}.` : "";

  const targetName = resolvedTarget.nameOnly === "—" ? "target record" : resolvedTarget.nameOnly;
  const userTargetName =
    !resolvedTarget.nameOnly ||
    resolvedTarget.nameOnly === "—" ||
    resolvedTarget.nameOnly.toLowerCase() === "unknown" ||
    resolvedTarget.nameOnly.toLowerCase() === "unknown user"
      ? "the selected user account"
      : resolvedTarget.nameOnly;

  switch (action) {
    case "created_employee":
      return `Created employee record for ${targetName}.`;
    case "edited_employee":
      return `Edited employee record for ${targetName}.${appendChanged || ""}`.trim();
    case "deleted_employee":
      return `Deleted employee record for ${targetName}.`;
    case "deactivated_employee":
      return `Deactivated employee record for ${targetName}.`;
    case "created_contract":
      return `Created contract for ${targetName}.`;
    case "edited_contract":
      return `Edited contract for ${targetName}.${appendChanged || ""}`.trim();
    case "deleted_contract":
      return `Deleted contract for ${targetName}.`;
    case "terminated_contract":
      return `Terminated contract for ${targetName}.`;
    case "cancelled_contract":
      return `Cancelled contract for ${targetName}.`;
    case "deleted_user":
      return `Deleted user account for ${userTargetName}.`;
    case "created_user":
      return `Created user account for ${userTargetName}.`;
    case "edited_user":
      return `Edited user account for ${userTargetName}.`;
    case "changed_user_role":
      return `Changed user role for ${userTargetName}.`;
    case "attached_employee_to_user":
      return `Attached employee record to user account for ${userTargetName}.`;
    case "removed_employee_from_user":
      return `Removed employee record link from user account for ${userTargetName}.`;
    case "reset_user_password":
      return `Reset password for ${userTargetName}.`;
    case "updated_gratuity_settings":
      return "Updated gratuity calculation settings.";
    case "updated_audit_retention_settings":
      return "Updated audit retention settings.";
    case "changed_password":
      return "Changed password for the logged-in user.";
    case "session_timeout":
      return "User was logged out due to inactivity.";
    case "logged_out":
      return "User logged out.";
    default:
      return `${formatActionLabel(row.action)} was performed for ${targetName}.`;
  }
}

async function resolveAuditActor(row: SystemAuditDetailRow): Promise<ResolvedAuditActor> {
  const actorName = row.actor_name?.trim() || "";
  if (actorName) {
    return {
      name: actorName,
      email: row.actor_email?.trim() || "—",
    };
  }

  const actorId = row.actor_user_id?.trim() || null;
  if (actorId) {
    const actorRows = await prisma.$queryRaw<
      Array<{
        email: string | null;
        full_name: string | null;
        first_name: string | null;
        last_name: string | null;
      }>
    >(
      Prisma.sql`
        SELECT
          u.email,
          p.full_name,
          e.first_name,
          e.last_name
        FROM public.users u
        LEFT JOIN public.user_profiles p
          ON p.user_id = u.id
        LEFT JOIN public.employees e
          ON e.id = p.employee_id
        WHERE u.id = ${actorId}::uuid
        LIMIT 1
      `,
    );
    const actor = actorRows[0];
    if (actor) {
      return {
        name: buildUserDisplayName(actor).replace(/^Unknown User$/i, "Unknown"),
        email: actor.email?.trim() || row.actor_email?.trim() || "—",
      };
    }
  }

  const fallbackEmail = row.actor_email?.trim();
  if (fallbackEmail) {
    return { name: fallbackEmail, email: fallbackEmail };
  }
  return { name: "Unknown", email: "—" };
}

function stringifyMetadata(value: unknown): string {
  if (!value) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "";
  }
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <div className="text-foreground break-words text-sm font-medium">{value}</div>
    </div>
  );
}

async function fetchSystemAuditDetail(id: string): Promise<SystemAuditDetailRow | null> {
  const rows = await prisma.$queryRaw<SystemAuditDetailRow[]>(Prisma.sql`
    SELECT
      id::text AS id,
      actor_user_id::text AS actor_user_id,
      actor_email,
      actor_name,
      module,
      action,
      target_type,
      target_id::text AS target_id,
      target_label,
      success,
      failure_reason,
      ip_address::text AS ip_address,
      device_name,
      user_agent,
      metadata,
      created_at
    FROM public.system_audit_logs
    WHERE id = ${id}::uuid
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export default async function SystemAuditDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!z.string().uuid().safeParse(id).success) {
    notFound();
  }

  let row: SystemAuditDetailRow | null = null;
  let loadError = false;

  try {
    row = await fetchSystemAuditDetail(id);
  } catch {
    loadError = true;
  }

  if (loadError) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Audit", href: "/audit" },
            { label: "System Audit Detail" },
          ]}
          backFallbackHref="/audit"
          title="System Audit Detail"
          icon="shield-check"
          description="Review the full system activity audit record."
        />
        <EmptyState
          icon={ScrollText}
          title="Could not load audit log"
          description="Something went wrong while loading this record. Return to the audit list and try again."
        />
      </div>
    );
  }

  if (!row) {
    return (
      <div className="space-y-6">
        <PageHeader
          breadcrumbItems={[
            { label: "Dashboard", href: "/" },
            { label: "Audit", href: "/audit" },
            { label: "System Audit Detail" },
          ]}
          backFallbackHref="/audit"
          title="System Audit Detail"
          icon="shield-check"
          description="Review the full system activity audit record."
        />
        <EmptyState
          icon={ScrollText}
          title="System audit record not found."
          description="This system audit record does not exist or may have been removed."
        />
      </div>
    );
  }

  const actor = await resolveAuditActor(row);
  const moduleValue = row.module?.trim() || "—";
  const resolvedTarget = await resolveAuditTarget(row);
  const actionDescription = buildSystemAuditDescription(row, resolvedTarget);
  const failureReason = row.success || !row.failure_reason?.trim() ? "—" : row.failure_reason.trim();
  const ipDisplay = displayAuditIp(row.ip_address ?? null);
  const deviceDisplay = displayAuditDeviceName(row.device_name, row.user_agent ?? null);
  const metadataDisplay = stringifyMetadata(row.metadata);
  const metaObj =
    row.metadata && typeof row.metadata === "object"
      ? (row.metadata as Record<string, unknown>)
      : null;
  const changedSectionLabels = Array.isArray(metaObj?.changedSections)
    ? (metaObj!.changedSections as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const changeSummary = getMetadataChanges(row.metadata);
  const changedItems = changeSummary.filter((item) => item.type === "changed");
  const addedItems = changeSummary.filter((item) => item.type === "added");
  const removedItems = changeSummary.filter((item) => item.type === "removed");

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Audit", href: "/audit" },
          { label: "System Audit Detail" },
        ]}
        backFallbackHref="/audit"
        title="System Audit Detail"
        icon="shield-check"
        description="Review the full system activity audit record."
      />

      <div className="space-y-5">
        <SectionCard title="Activity Summary">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Actor Name" value={actor.name} />
            <Field label="Actor Email" value={actor.email} />
            <Field label="Action" value={formatActionLabel(row.action)} />
            <Field label="Date / Time" value={formatDateTime(row.created_at)} />
          </div>
        </SectionCard>

        <div className="grid gap-5 lg:grid-cols-2">
          <SectionCard title="Target & Result">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Module" value={moduleValue} />
              <Field label="Target" value={resolvedTarget.display} />
              <div className="sm:col-span-2">
                <Field label="Action Description" value={actionDescription} />
              </div>
              <Field
                label="Success"
                value={
                  <StatusBadge tone={row.success ? "success" : "danger"}>
                    {row.success ? "Success" : "Failed"}
                  </StatusBadge>
                }
              />
              <Field label="Failure Reason" value={failureReason} />
            </div>
          </SectionCard>

          <SectionCard title="Network & Device">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="IP Address" value={ipDisplay} />
              <Field label="Device Name" value={deviceDisplay} />
              <div className="space-y-1 sm:col-span-2">
                <p className="text-muted-foreground text-xs font-medium">User Agent</p>
                <div className="text-foreground bg-muted/30 border-border break-words whitespace-pre-wrap rounded-md border p-3 text-sm leading-relaxed">
                  {row.user_agent?.trim() ? row.user_agent : "—"}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Change Summary"
        >
          {changedSectionLabels.length > 0 ? (
            <div className="mb-4 space-y-1 text-sm">
              <p className="font-medium text-foreground">Changed sections</p>
              <ul className="text-muted-foreground list-inside list-disc">
                {changedSectionLabels.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {changeSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No detailed field changes were recorded for this action.
            </p>
          ) : (
            <div className="space-y-3 text-sm">
              {changedItems.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium text-blue-700 dark:text-blue-300">Changed</p>
                  {changedItems.map((item, index) => (
                    <p key={`changed-${index}`} className="text-foreground break-words">
                      • {changeLine(item)}
                    </p>
                  ))}
                </div>
              ) : null}
              {addedItems.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">Added</p>
                  {addedItems.map((item, index) => (
                    <p key={`added-${index}`} className="text-foreground break-words">
                      • {changeLine(item)}
                    </p>
                  ))}
                </div>
              ) : null}
              {removedItems.length > 0 ? (
                <div className="space-y-1">
                  <p className="font-medium text-rose-700 dark:text-rose-300">Removed</p>
                  {removedItems.map((item, index) => (
                    <p key={`removed-${index}`} className="text-foreground break-words">
                      • {changeLine(item)}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          {process.env.NODE_ENV !== "production" && metadataDisplay ? (
            <details className="mt-4 rounded-md border border-border bg-muted/20 p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Technical Details
              </summary>
              <pre className="text-foreground mt-2 overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs leading-relaxed">
                {metadataDisplay}
              </pre>
            </details>
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}
