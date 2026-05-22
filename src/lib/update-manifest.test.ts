import { describe, expect, it, vi, afterEach } from "vitest";

import {
  buildUpdateCheckResult,
  EXPECTED_APP_NAME,
  fetchUpdateManifest,
  validateUpdateManifestJson,
} from "./update-manifest";

const validManifest = {
  appName: EXPECTED_APP_NAME,
  latestVersion: "0.13.1-beta",
  releaseTag: "v0.13.1-beta",
  releaseDate: "2026-05-22",
  updateChannel: "beta",
  minimumSupportedVersion: "0.11.0-beta",
  requiresDatabaseMigration: true,
  requiresDockerRebuild: true,
  releaseUrl: "https://github.com/youdevon/local-db-hr/releases/tag/v0.13.1-beta",
  downloadUrl: "https://github.com/youdevon/local-db-hr/archive/refs/tags/v0.13.1-beta.zip",
  notes: ["Note a", "Note b"],
};

describe("validateUpdateManifestJson", () => {
  it("accepts a well-formed manifest", () => {
    const r = validateUpdateManifestJson(validManifest);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifest.latestVersion).toBe("0.13.1-beta");
  });

  it("rejects wrong app name", () => {
    const r = validateUpdateManifestJson({ ...validManifest, appName: "Other App" });
    expect(r.ok).toBe(false);
  });

  it("rejects invalid JSON shapes", () => {
    const r = validateUpdateManifestJson({ appName: EXPECTED_APP_NAME });
    expect(r.ok).toBe(false);
  });
});

describe("buildUpdateCheckResult", () => {
  it("marks update available when latest is newer", () => {
    const parsed = validateUpdateManifestJson(validManifest);
    if (!parsed.ok) throw new Error("fixture manifest invalid");
    const body = buildUpdateCheckResult({
      installedVersion: "v0.11.0-beta",
      manifest: parsed.manifest,
      manifestError: null,
      fetchFailed: false,
    });
    expect(body.updateAvailable).toBe(true);
    expect(body.latestVersion).toBe("0.13.1-beta");
    expect(body.error).toBeNull();
    expect(body.notes).toHaveLength(2);
  });

  it("returns friendly offline messaging when fetch failed", () => {
    const body = buildUpdateCheckResult({
      installedVersion: "v0.11.0-beta",
      manifest: null,
      manifestError: null,
      fetchFailed: true,
    });
    expect(body.error).toMatch(/offline/i);
    expect(body.latestVersion).toBeNull();
    expect(body.updateAvailable).toBe(false);
  });

  it("surfaces manifest validation errors", () => {
    const body = buildUpdateCheckResult({
      installedVersion: "v0.11.0-beta",
      manifest: null,
      manifestError: "bad manifest",
      fetchFailed: false,
    });
    expect(body.error).toBe("bad manifest");
  });
});

describe("fetchUpdateManifest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns invalid_json when body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => "not json",
      }),
    );
    const r = await fetchUpdateManifest("https://example.com/manifest.json", 5000);
    expect(r).toEqual({ ok: false, reason: "invalid_json" });
  });

  it("returns network when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const r = await fetchUpdateManifest("https://example.com/manifest.json", 5000);
    expect(r).toEqual({ ok: false, reason: "network" });
  });
});
