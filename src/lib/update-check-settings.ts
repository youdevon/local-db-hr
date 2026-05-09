import "server-only";

import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export const UPDATE_CHECK_SETTINGS_KEY = "update_check" as const;

export const DEFAULT_UPDATE_MANIFEST_URL =
  "https://raw.githubusercontent.com/youdevon/local-db-hr/Licensed-Upgrades/update-manifest.json" as const;

export type UpdateCheckSettings = {
  manifestUrl: string;
};

const DEFAULT_SETTINGS: UpdateCheckSettings = {
  manifestUrl: DEFAULT_UPDATE_MANIFEST_URL,
};

function normalizeManifestUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  if (!t) return null;
  try {
    const u = new URL(t);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

export async function getUpdateCheckSettings(): Promise<UpdateCheckSettings> {
  const rows = await prisma.$queryRaw<Array<{ setting_value: unknown }>>(
    Prisma.sql`
      SELECT setting_value
      FROM public.app_settings
      WHERE setting_key = ${UPDATE_CHECK_SETTINGS_KEY}
      LIMIT 1
    `,
  );

  const raw = rows[0]?.setting_value;
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;
  const data = raw as Partial<UpdateCheckSettings>;
  const manifestUrl = normalizeManifestUrl(data.manifestUrl);
  return {
    manifestUrl: manifestUrl ?? DEFAULT_SETTINGS.manifestUrl,
  };
}

export async function saveUpdateCheckSettings(settings: UpdateCheckSettings): Promise<void> {
  await prisma.$executeRaw(
    Prisma.sql`
      INSERT INTO public.app_settings (
        setting_key,
        setting_value,
        description
      )
      VALUES (
        ${UPDATE_CHECK_SETTINGS_KEY},
        ${JSON.stringify(settings)}::jsonb,
        'Update check manifest URL and related settings for licensed deployments.'
      )
      ON CONFLICT (setting_key)
      DO UPDATE SET
        setting_value = EXCLUDED.setting_value,
        description = EXCLUDED.description,
        updated_at = NOW()
    `,
  );
}
