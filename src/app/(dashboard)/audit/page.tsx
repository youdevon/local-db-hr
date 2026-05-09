import type { Metadata } from "next";
import { Prisma } from "@prisma/client";

import { displayAuditIp } from "@/lib/audit-display";
import { getAuditLogScopeFilter } from "@/lib/audit-retention";
import { PageHeader } from "@/components/page-header";
import { prisma } from "@/lib/prisma";

import { CombinedAuditTrailClient, type CombinedAuditRow } from "./combined-audit-trail-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Audit",
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
    logout: "Logout",
    failed_login: "Failed Login",
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

function formatModuleLabel(module: string | null | undefined): string {
  const m = (module ?? "").trim();
  if (!m || m === "—") return "—";
  const key = m.toLowerCase();
  const map: Record<string, string> = {
    qualifications: "Qualifications",
    employee_profile: "Employee Profile",
    authentication: "Authentication",
  };
  return map[key] ?? (m.charAt(0).toUpperCase() + m.slice(1));
}

function formatSystemActionLabel(value: string | null | undefined): string {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) return "—";
  const known: Record<string, string> = {
    session_timeout: "Session Timeout",
    logged_out: "Logged Out",
    created_employee: "Created Employee",
    edited_employee: "Edited Employee",
    deleted_employee: "Deleted Employee",
    deactivated_employee: "Deactivated Employee",
    archived_employee: "Archived Employee",
    uploaded_employee_document: "Uploaded Employee Document",
    removed_employee_document: "Removed Employee Document",
    created_contract: "Created Contract",
    edited_contract: "Edited Contract",
    deleted_contract: "Deleted Contract",
    cancelled_contract: "Cancelled Contract",
    terminated_contract: "Terminated Contract",
    added_contract_allowance: "Added Contract Allowance",
    edited_contract_allowance: "Edited Contract Allowance",
    removed_contract_allowance: "Removed Contract Allowance",
    changed_contract_status: "Changed Contract Status",
    created_leave_record: "Created Leave Record",
    edited_leave_record: "Edited Leave Record",
    approved_leave: "Approved Leave",
    rejected_leave: "Rejected Leave",
    cancelled_leave: "Cancelled Leave",
    deleted_leave_record: "Deleted Leave Record",
    adjusted_leave_balance: "Adjusted Leave Balance",
    generated_report: "Generated Report",
    exported_report: "Exported Report",
    viewed_report: "Viewed Report",
    updated_gratuity_settings: "Updated Gratuity Settings",
    updated_audit_retention_settings: "Updated Audit Retention Settings",
    updated_global_settings: "Updated Global Settings",
    updated_role_permissions: "Updated Role Permissions",
    updated_application_setting: "Updated Application Setting",
    created_user: "Created User Account",
    edited_user: "Edited User",
    changed_user_role: "Changed User Role",
    deleted_user: "Deleted User",
    deactivated_user: "Deactivated User",
    reset_user_password: "Reset User Password",
    unlocked_user_account: "Unlocked User Account",
    changed_password: "Changed Password",
    updated_profile: "Updated Profile",
    updated_settings: "Updated Settings",
    qualification_created: "Qualification Created",
    qualification_updated: "Qualification Updated",
    qualification_deleted: "Qualification Deleted",
    qualification_archived: "Qualification Archived",
    qualification_batch_created: "Qualification Batch Created",
    qualification_evidence_attached: "Qualification Evidence Attached",
    qualification_evidence_removed: "Qualification Evidence Removed",
    employee_profile_updated: "Employee Profile Updated",
    self_service_profile_update: "Employee Profile Updated",
  };
  if (known[normalized]) return known[normalized];
  return normalized
    .split("_")
    .map((part) => (part ? `${part[0]!.toUpperCase()}${part.slice(1)}` : ""))
    .join(" ")
    .trim();
}

export default async function AuditPage() {
  let rows: CombinedAuditRow[] = [];
  const activeFilter = getAuditLogScopeFilter("active");

  try {
    type CombinedAuditDbRow = {
      id: string;
      source_type: "login" | "system";
      created_at: Date | null;
      who_attempted_it: string | null;
      action: string | null;
      action_raw: string | null;
      audit_summary: string | null;
      target: string | null;
      module: string | null;
      success: boolean;
      failure_reason: string | null;
      ip_address: string | null;
      device_name: string | null;
    };

    const logs = await prisma.$queryRaw<CombinedAuditDbRow[]>(
      Prisma.sql`
        SELECT
          id::text AS id,
          'login' AS source_type,
          created_at,
          COALESCE(NULLIF(email_attempted, ''), 'Unknown') AS who_attempted_it,
          action,
          action AS action_raw,
          ''::text AS audit_summary,
          COALESCE(NULLIF(email_attempted, ''), '—') AS target,
          'Authentication' AS module,
          success,
          failure_reason,
          ip_address::text AS ip_address,
          device_name
        FROM public.login_audit_logs
        WHERE ${activeFilter}
        UNION ALL
        SELECT
          s.id::text AS id,
          'system' AS source_type,
          s.created_at,
          COALESCE(NULLIF(s.actor_name, ''), NULLIF(s.actor_email, ''), 'Unknown') AS who_attempted_it,
          s.action,
          s.action AS action_raw,
          COALESCE(NULLIF(trim(s.metadata->>'summary'), ''), '') AS audit_summary,
          CASE
            WHEN s.target_type = 'employee' AND e.id IS NOT NULL
              THEN 'Employee: ' || COALESCE(NULLIF(e.first_name, ''), 'Unknown') || ' ' || COALESCE(NULLIF(e.last_name, ''), '')
            WHEN s.target_type = 'contract' AND c.id IS NOT NULL
              THEN 'Contract: ' || COALESCE(NULLIF(c.minute_number, ''), NULLIF(c.contract_number, ''), 'No assigned number')
            WHEN s.target_type = 'user' AND u.id IS NOT NULL
              THEN 'User: ' || COALESCE(
                NULLIF(trim(COALESCE(ue.first_name, '') || ' ' || COALESCE(ue.last_name, '')), ''),
                NULLIF(p.full_name, ''),
                u.email,
                'Unknown'
              )
            WHEN s.target_type = 'user'
              THEN CASE
                WHEN s.target_label IS NOT NULL
                  AND btrim(s.target_label) <> ''
                  AND NOT (btrim(s.target_label) ~* '^User ID:\s*[0-9a-f-]{36}$')
                  THEN s.target_label
                ELSE 'User: Unknown'
              END
            ELSE COALESCE(NULLIF(s.target_label, ''), '—')
          END AS target,
          COALESCE(NULLIF(s.module, ''), '—') AS module,
          s.success,
          s.failure_reason,
          s.ip_address::text AS ip_address,
          s.device_name
        FROM public.system_audit_logs s
        LEFT JOIN public.employees e
          ON s.target_type = 'employee'
          AND s.target_id IS NOT NULL
          AND e.id::text = s.target_id::text
        LEFT JOIN public.contracts c
          ON s.target_type = 'contract'
          AND s.target_id IS NOT NULL
          AND c.id::text = s.target_id::text
        LEFT JOIN public.users u
          ON s.target_type = 'user'
          AND s.target_id IS NOT NULL
          AND u.id::text = s.target_id::text
        LEFT JOIN public.user_profiles p
          ON p.user_id = u.id
        LEFT JOIN public.employees ue
          ON ue.id = p.employee_id
        WHERE ${activeFilter}
        ORDER BY created_at DESC
        LIMIT 750
      `,
    );

    rows = logs.map((row) => ({
      id: row.id,
      sourceType: row.source_type,
      auditType: row.source_type === "login" ? "Login" : "System",
      createdAt: formatDateTime(row.created_at),
      createdAtIso: row.created_at ? row.created_at.toISOString() : "",
      whoAttemptedIt: row.who_attempted_it?.trim() || "Unknown",
      actionRaw: row.action_raw?.trim() || "",
      action:
        row.source_type === "login" ? formatActionLabel(row.action) : formatSystemActionLabel(row.action),
      target: row.target?.trim() || "—",
      summary: row.audit_summary?.trim() || "—",
      module: formatModuleLabel(row.module),
      success: row.success,
      failureReason: row.failure_reason?.trim() || "—",
      ipAddress: displayAuditIp(row.ip_address),
      deviceName: row.device_name?.trim() || "—",
    }));
  } catch {
    rows = [];
  }

  return (
    <div className="space-y-6">
      <PageHeader
        breadcrumbItems={[
          { label: "Dashboard", href: "/" },
          { label: "Audit" },
        ]}
        title="Audit"
        icon="shield-check"
        description="Review login activity and system changes across the application."
      />
      <CombinedAuditTrailClient rows={rows} />
    </div>
  );
}
