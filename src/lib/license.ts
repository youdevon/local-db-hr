import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const LICENSE_SETTINGS_KEY = "license_settings" as const;

export type LicenseType = "trial" | "active" | "permanent" | "expired" | "suspended";
export type LicenseStatus =
  | "trial_active"
  | "trial_grace"
  | "active"
  | "permanent"
  | "expired"
  | "suspended"
  | "invalid";

export type LicenseSettings = {
  organizationName: string;
  productName: "Local DB HR";
  licenseType: LicenseType;
  licenseStatus: LicenseStatus;
  issuedAt: string | null;
  expiresAt: string | null;
  gracePeriodDays: number;
  activatedAt: string | null;
  licenceId: string | null;
  notes: string | null;
  licenseKey: string | null;
  maxUsers: number | null;
  maxEmployees: number | null;
  issuedBy: string | null;
  lastValidCheckAt: string | null;
  lastCheckedAt: string | null;
  clockTamperDetectedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComputedLicenseStatus = {
  configured: boolean;
  settings: LicenseSettings | null;
  nowIso: string;
  status: LicenseStatus;
  accessAllowed: boolean;
  inGracePeriod: boolean;
  daysRemaining: number | null;
  graceDaysRemaining: number | null;
  hardStopDateIso: string | null;
  clockTamperDetected: boolean;
  message: string;
};

export function getLicenseStatusLabel(status: LicenseStatus): string {
  if (status === "trial_active") return "Trial Active";
  if (status === "trial_grace") return "Grace Period";
  if (status === "active") return "Active";
  if (status === "permanent") return "Permanent";
  if (status === "expired") return "Expired";
  if (status === "suspended") return "Suspended";
  return "Invalid";
}

async function writeLicenseAuditLog(params: {
  action: string;
  success: boolean;
  failureReason?: string | null;
  metadata?: unknown;
}) {
  const metadataJson = params.metadata == null ? null : JSON.stringify(params.metadata);
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.system_audit_logs (
        module, action, target_type, target_label, success, failure_reason, metadata
      )
      VALUES (
        'License',
        ${params.action},
        'settings',
        'Settings: License',
        ${params.success},
        ${params.failureReason ?? null},
        ${metadataJson}::jsonb
      )
    `,
  );
}

function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function normalizeType(value: unknown): LicenseType {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "trial";
  if (raw === "active" || raw === "permanent" || raw === "expired" || raw === "suspended") return raw;
  return "trial";
}

function normalizeStatus(value: unknown): LicenseStatus {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : "invalid";
  if (
    raw === "trial_active" ||
    raw === "trial_grace" ||
    raw === "active" ||
    raw === "permanent" ||
    raw === "expired" ||
    raw === "suspended" ||
    raw === "invalid"
  ) {
    return raw;
  }
  return "invalid";
}

function toInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.round(parsed);
  if (rounded < min) return min;
  if (rounded > max) return max;
  return rounded;
}

export function maskLicenseKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length <= 12) return "****";
  return `${trimmed.slice(0, 8)}…${trimmed.slice(-4)}`;
}

export async function getDatabaseNow(): Promise<Date> {
  const rows = await prisma.$queryRaw<Array<{ now: Date }>>(Prisma.sql`
    SELECT NOW() AS now
  `);
  return rows[0]?.now ?? new Date();
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function diffDays(start: Date, end: Date): number {
  const startUtc = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endUtc = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.floor((endUtc - startUtc) / (1000 * 60 * 60 * 24));
}

export function getHardStopDate(expiresAt: string | null, gracePeriodDays: number): string | null {
  const expires = parseDate(expiresAt);
  if (!expires) return null;
  return addDays(expires, gracePeriodDays).toISOString();
}

export function getDaysRemaining(nowIso: string, expiresAt: string | null): number | null {
  const now = parseDate(nowIso);
  const expires = parseDate(expiresAt);
  if (!now || !expires) return null;
  return diffDays(now, expires);
}

export function getGraceDaysRemaining(nowIso: string, hardStopDateIso: string | null): number | null {
  const now = parseDate(nowIso);
  const hardStop = parseDate(hardStopDateIso);
  if (!now || !hardStop) return null;
  return diffDays(now, hardStop);
}

function calculateMessage(status: LicenseStatus, result: Pick<ComputedLicenseStatus, "daysRemaining" | "graceDaysRemaining" | "hardStopDateIso">): string {
  if (status === "permanent") return "Permanent licence";
  if (status === "active") {
    if (result.daysRemaining == null) return "Licence active";
    return result.daysRemaining >= 0 ? `${result.daysRemaining} days remaining` : "Licence active";
  }
  if (status === "trial_active") {
    return result.daysRemaining == null ? "Trial active" : `Trial: ${Math.max(0, result.daysRemaining)} days remaining`;
  }
  if (status === "trial_grace") {
    const grace = result.graceDaysRemaining == null ? "Grace period active" : `Grace period: ${Math.max(0, result.graceDaysRemaining)} days remaining`;
    return grace;
  }
  if (status === "suspended") return "Licence suspended";
  if (status === "expired") return "Licence expired";
  return "Licence invalid";
}

function calculateLicenseStatusCore(settings: LicenseSettings, now: Date, clockTamperDetected: boolean): Omit<ComputedLicenseStatus, "configured" | "settings" | "nowIso"> {
  const expires = parseDate(settings.expiresAt);
  const hardStopDateIso = getHardStopDate(settings.expiresAt, settings.gracePeriodDays);
  const daysRemaining = getDaysRemaining(now.toISOString(), settings.expiresAt);
  const graceDaysRemaining = getGraceDaysRemaining(now.toISOString(), hardStopDateIso);

  let status: LicenseStatus = settings.licenseStatus;
  let accessAllowed = false;
  let inGracePeriod = false;

  if (clockTamperDetected) {
    status = "invalid";
    accessAllowed = false;
    inGracePeriod = false;
  } else if (settings.licenseType === "permanent") {
    status = "permanent";
    accessAllowed = true;
  } else if (settings.licenseType === "suspended") {
    status = "suspended";
    accessAllowed = false;
  } else if (settings.licenseType === "active") {
    if (!expires || now <= expires) {
      status = "active";
      accessAllowed = true;
    } else {
      status = "expired";
      accessAllowed = false;
    }
  } else if (settings.licenseType === "trial") {
    if (!expires) {
      status = "invalid";
      accessAllowed = false;
    } else if (now <= expires) {
      status = "trial_active";
      accessAllowed = true;
    } else {
      const hardStop = parseDate(hardStopDateIso);
      if (hardStop && now <= hardStop) {
        status = "trial_grace";
        accessAllowed = true;
        inGracePeriod = true;
      } else {
        status = "expired";
        accessAllowed = false;
      }
    }
  } else {
    status = "invalid";
    accessAllowed = false;
  }

  return {
    status,
    accessAllowed,
    inGracePeriod,
    daysRemaining,
    graceDaysRemaining,
    hardStopDateIso,
    clockTamperDetected,
    message: calculateMessage(status, { daysRemaining, graceDaysRemaining, hardStopDateIso }),
  };
}

function parseStoredSettings(raw: Record<string, unknown>): LicenseSettings {
  const nowIso = new Date().toISOString();
  return {
    organizationName: (typeof raw.organizationName === "string" ? raw.organizationName : "").trim() || "Organization",
    productName: "Local DB HR",
    licenseType: normalizeType(raw.licenseType),
    licenseStatus: normalizeStatus(raw.licenseStatus),
    issuedAt: toIso(parseDate(typeof raw.issuedAt === "string" ? raw.issuedAt : null)),
    expiresAt: toIso(parseDate(typeof raw.expiresAt === "string" ? raw.expiresAt : null)),
    gracePeriodDays: toInt(raw.gracePeriodDays, 14, 0, 365),
    activatedAt: toIso(parseDate(typeof raw.activatedAt === "string" ? raw.activatedAt : null)),
    licenceId: typeof raw.licenceId === "string" ? raw.licenceId.trim() || null : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    licenseKey: typeof raw.licenseKey === "string" ? raw.licenseKey.trim() || null : null,
    maxUsers: raw.maxUsers == null ? null : toInt(raw.maxUsers, 0, 0, 100000),
    maxEmployees: raw.maxEmployees == null ? null : toInt(raw.maxEmployees, 0, 0, 10000000),
    issuedBy: typeof raw.issuedBy === "string" ? raw.issuedBy.trim() || null : null,
    lastValidCheckAt: toIso(parseDate(typeof raw.lastValidCheckAt === "string" ? raw.lastValidCheckAt : null)),
    lastCheckedAt: toIso(parseDate(typeof raw.lastCheckedAt === "string" ? raw.lastCheckedAt : null)),
    clockTamperDetectedAt: toIso(parseDate(typeof raw.clockTamperDetectedAt === "string" ? raw.clockTamperDetectedAt : null)),
    createdAt: toIso(parseDate(typeof raw.createdAt === "string" ? raw.createdAt : null)) ?? nowIso,
    updatedAt: toIso(parseDate(typeof raw.updatedAt === "string" ? raw.updatedAt : null)) ?? nowIso,
  };
}

export async function getLicenseSettings(): Promise<LicenseSettings | null> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(Prisma.sql`
    SELECT setting_value
    FROM public.app_settings
    WHERE setting_key = ${LICENSE_SETTINGS_KEY}
    LIMIT 1
  `);

  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return null;
  return parseStoredSettings(raw as Record<string, unknown>);
}

export async function getDefaultLicenseSettings(): Promise<LicenseSettings> {
  const now = await getDatabaseNow();
  const organizationName = "Organization";
  return {
    organizationName,
    productName: "Local DB HR",
    licenseType: "trial",
    licenseStatus: "trial_active",
    issuedAt: now.toISOString(),
    expiresAt: addDays(now, 90).toISOString(),
    gracePeriodDays: 14,
    activatedAt: null,
    licenceId: null,
    notes: null,
    licenseKey: null,
    maxUsers: null,
    maxEmployees: null,
    issuedBy: "D3 Services",
    lastValidCheckAt: null,
    lastCheckedAt: null,
    clockTamperDetectedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

export async function saveLicenseSettings(
  input: Omit<LicenseSettings, "createdAt" | "updatedAt" | "productName">,
): Promise<LicenseSettings> {
  const now = await getDatabaseNow();
  const existing = await getLicenseSettings();
  const createdAt = existing?.createdAt ?? now.toISOString();
  const next: LicenseSettings = {
    ...input,
    productName: "Local DB HR",
    createdAt,
    updatedAt: now.toISOString(),
  };

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (setting_key, setting_value, description)
      VALUES (
        ${LICENSE_SETTINGS_KEY},
        ${JSON.stringify(next)}::jsonb,
        'Licence and activation settings for this installation.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );

  return next;
}

export function isInGracePeriod(status: ComputedLicenseStatus): boolean {
  return status.status === "trial_grace";
}

export function isLicenseAccessAllowed(status: ComputedLicenseStatus): boolean {
  return status.accessAllowed;
}

async function maybeLogStatusTransition(previous: LicenseStatus | null, next: LicenseStatus, settings: LicenseSettings) {
  if (previous === next) return;
  await writeLicenseAuditLog({
    action: "license_status_changed",
    success: true,
    metadata: {
      previousStatus: previous,
      nextStatus: next,
      expiresAt: settings.expiresAt,
      hardStopDate: getHardStopDate(settings.expiresAt, settings.gracePeriodDays),
      maskedLicenseKey: maskLicenseKey(settings.licenseKey),
    },
  });
}

export async function getLicenseStatus(): Promise<ComputedLicenseStatus> {
  const now = await getDatabaseNow();
  const settings = await getLicenseSettings();

  if (!settings) {
    return {
      configured: false,
      settings: null,
      nowIso: now.toISOString(),
      status: "invalid",
      accessAllowed: false,
      inGracePeriod: false,
      daysRemaining: null,
      graceDaysRemaining: null,
      hardStopDateIso: null,
      clockTamperDetected: false,
      message: "No licence has been configured for this installation.",
    };
  }

  const toleranceMs = 5 * 60 * 1000;
  const previousValid = parseDate(settings.lastValidCheckAt);
  const clockTamperDetected =
    previousValid != null && now.getTime() + toleranceMs < previousValid.getTime();

  const computed = calculateLicenseStatusCore(settings, now, clockTamperDetected);
  const nextSettings: LicenseSettings = {
    ...settings,
    licenseStatus: computed.status,
    lastCheckedAt: now.toISOString(),
    lastValidCheckAt: clockTamperDetected ? settings.lastValidCheckAt : now.toISOString(),
    clockTamperDetectedAt: clockTamperDetected ? (settings.clockTamperDetectedAt ?? now.toISOString()) : null,
    updatedAt: now.toISOString(),
  };

  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE public.app_settings
      SET setting_value = ${JSON.stringify(nextSettings)}::jsonb, updated_at = NOW()
      WHERE setting_key = ${LICENSE_SETTINGS_KEY}
    `,
  );

  if (clockTamperDetected && settings.clockTamperDetectedAt == null) {
    await writeLicenseAuditLog({
      action: "license_clock_tamper_detected",
      success: false,
      failureReason: "The server date/time appears to be incorrect.",
      metadata: {
        previousLastValidCheckAt: settings.lastValidCheckAt,
        currentServerTime: now.toISOString(),
      },
    });
  }

  await maybeLogStatusTransition(settings.licenseStatus, computed.status, nextSettings);

  return {
    configured: true,
    settings: nextSettings,
    nowIso: now.toISOString(),
    ...computed,
    message: clockTamperDetected
      ? "The server date/time appears to be incorrect. Please correct the server date and time to continue."
      : computed.message,
  };
}

export async function assertLicenseAllowsAccess(): Promise<void> {
  const status = await getLicenseStatus();
  if (!status.configured || !status.accessAllowed) {
    throw new Error(
      status.clockTamperDetected
        ? "The server date/time appears to be incorrect. Please correct the server date and time to continue."
        : "Licence expired. This action is not available until the application is activated.",
    );
  }
}

