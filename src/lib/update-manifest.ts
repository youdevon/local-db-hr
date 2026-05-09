import { z } from "zod";

import { isVersionNewer } from "@/lib/version-compare";

export const EXPECTED_APP_NAME = "Local DB HR" as const;

export const UPDATE_CHECK_OFFLINE_MESSAGE =
  "Unable to check for updates. This server may be offline. You can still update manually using an approved release package." as const;

const optionalUrlString = z
  .union([z.string().url(), z.literal(""), z.null()])
  .optional()
  .transform((v) => {
    if (v == null || v === "") return null;
    return v;
  });

export const updateManifestSchema = z.object({
  appName: z.literal(EXPECTED_APP_NAME),
  latestVersion: z.string().min(1),
  releaseTag: z.string().optional(),
  releaseDate: z.string().optional(),
  updateChannel: z.string().optional(),
  minimumSupportedVersion: z.string().optional(),
  requiresDatabaseMigration: z.boolean().optional(),
  requiresDockerRebuild: z.boolean().optional(),
  releaseUrl: optionalUrlString,
  downloadUrl: optionalUrlString,
  notes: z.array(z.string()).optional(),
});

export type UpdateManifest = z.infer<typeof updateManifestSchema>;

export type ManifestValidationFailure =
  | { ok: false; error: string }
  | { ok: true; manifest: UpdateManifest };

export function validateUpdateManifestJson(data: unknown): ManifestValidationFailure {
  const parsed = updateManifestSchema.safeParse(data);
  if (!parsed.success) {
    return {
      ok: false,
      error: "The update manifest is invalid or does not match the expected format.",
    };
  }
  return { ok: true, manifest: parsed.data };
}

export type UpdateCheckApiBody = {
  installedVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  releaseTag: string | null;
  releaseDate: string | null;
  releaseUrl: string | null;
  downloadUrl: string | null;
  notes: string[];
  requiresDatabaseMigration: boolean | null;
  requiresDockerRebuild: boolean | null;
  checkedAt: string;
  error: string | null;
};

export function buildUpdateCheckResult(params: {
  installedVersion: string;
  manifest: UpdateManifest | null;
  manifestError: string | null;
  fetchFailed: boolean;
}): UpdateCheckApiBody {
  const checkedAt = new Date().toISOString();
  if (params.fetchFailed) {
    return {
      installedVersion: params.installedVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseTag: null,
      releaseDate: null,
      releaseUrl: null,
      downloadUrl: null,
      notes: [],
      requiresDatabaseMigration: null,
      requiresDockerRebuild: null,
      checkedAt,
      error: UPDATE_CHECK_OFFLINE_MESSAGE,
    };
  }

  if (params.manifestError || !params.manifest) {
    return {
      installedVersion: params.installedVersion,
      latestVersion: null,
      updateAvailable: false,
      releaseTag: null,
      releaseDate: null,
      releaseUrl: null,
      downloadUrl: null,
      notes: [],
      requiresDatabaseMigration: null,
      requiresDockerRebuild: null,
      checkedAt,
      error: params.manifestError ?? "The update manifest could not be validated.",
    };
  }

  const m = params.manifest;
  const updateAvailable = isVersionNewer(m.latestVersion, params.installedVersion);

  return {
    installedVersion: params.installedVersion,
    latestVersion: m.latestVersion,
    updateAvailable,
    releaseTag: m.releaseTag ?? null,
    releaseDate: m.releaseDate ?? null,
    releaseUrl: m.releaseUrl ?? null,
    downloadUrl: m.downloadUrl ?? null,
    notes: m.notes ?? [],
    requiresDatabaseMigration: m.requiresDatabaseMigration ?? null,
    requiresDockerRebuild: m.requiresDockerRebuild ?? null,
    checkedAt,
    error: null,
  };
}

export type FetchUpdateManifestFailure = "network" | "http_error" | "invalid_json";

export async function fetchUpdateManifest(
  manifestUrl: string,
  timeoutMs: number = 15_000,
): Promise<{ ok: true; data: unknown } | { ok: false; reason: FetchUpdateManifestFailure }> {
  try {
    const res = await fetch(manifestUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      return { ok: false, reason: "http_error" };
    }
    const text = await res.text();
    try {
      const data = JSON.parse(text) as unknown;
      return { ok: true, data };
    } catch {
      return { ok: false, reason: "invalid_json" };
    }
  } catch {
    return { ok: false, reason: "network" };
  }
}
