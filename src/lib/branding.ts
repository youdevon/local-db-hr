import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const BRANDING_SETTINGS_KEY = "branding_settings" as const;
export const DEFAULT_COMPANY_NAME = "Local DB HR" as const;
export const BRANDING_UPLOAD_PUBLIC_PREFIX = "/uploads/branding/" as const;

export type BrandingSettings = {
  companyName: string | null;
  logoUrl: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
};

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIso(value: unknown): string | null {
  const text = normalizeText(value);
  if (!text) return null;
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeLogoUrl(value: unknown): string | null {
  return null;
}

function parseBrandingSettings(value: unknown): BrandingSettings {
  if (!value || typeof value !== "object") {
    return { companyName: null, logoUrl: null, updatedAt: null, updatedBy: null };
  }
  const data = value as Record<string, unknown>;
  return {
    companyName: normalizeText(data.companyName),
    logoUrl: normalizeLogoUrl(data.logoUrl),
    updatedAt: normalizeIso(data.updatedAt),
    updatedBy: normalizeText(data.updatedBy),
  };
}

export function resolveLogoUrlWithVersion(settings: BrandingSettings): string | null {
  void settings;
  return null;
}

export function resolveCompanyName(settings: BrandingSettings): string | null {
  return settings.companyName;
}

export function resolveBrandDisplayName(settings: BrandingSettings): string {
  return settings.companyName?.trim() || DEFAULT_COMPANY_NAME;
}

async function persistSanitizedBrandingSettings(
  original: BrandingSettings,
  sanitized: BrandingSettings,
): Promise<void> {
  if (
    original.companyName === sanitized.companyName &&
    original.logoUrl === sanitized.logoUrl &&
    original.updatedBy === sanitized.updatedBy
  ) {
    return;
  }

  const payload = {
    companyName: sanitized.companyName,
    logoUrl: null,
    logoDarkUrl: null,
    updatedAt: new Date().toISOString(),
    updatedBy: sanitized.updatedBy,
  };

  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (setting_key, setting_value, description)
      VALUES (
        ${BRANDING_SETTINGS_KEY},
        ${JSON.stringify(payload)}::jsonb,
        'Global branding configuration including company name and logo.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
      Prisma.sql`
        SELECT setting_value
        FROM public.app_settings
        WHERE setting_key = ${BRANDING_SETTINGS_KEY}
        LIMIT 1
      `,
    );
    const parsed = parseBrandingSettings(rows[0]?.setting_value);

    const sanitized: BrandingSettings = {
      companyName: parsed.companyName?.trim() || DEFAULT_COMPANY_NAME,
      logoUrl: null,
      updatedAt: parsed.updatedAt,
      updatedBy: parsed.updatedBy,
    };

    await persistSanitizedBrandingSettings(parsed, sanitized).catch(() => undefined);
    return sanitized;
  } catch {
    return { companyName: DEFAULT_COMPANY_NAME, logoUrl: null, updatedAt: null, updatedBy: null };
  }
}
