export type ParsedSemverStyle = {
  major: number;
  minor: number;
  patch: number;
  prerelease: string | null;
};

/** Strip a leading "v" / "V" for parsing. */
export function stripVersionPrefix(version: string): string {
  const t = version.trim();
  if (t.toLowerCase().startsWith("v")) return t.slice(1).trim();
  return t;
}

/**
 * Parse versions like 0.12.0-beta, 1.0.0, v0.11.1-beta.
 * Returns null if the string does not match the expected pattern.
 */
export function parseSemverStyle(version: string): ParsedSemverStyle | null {
  const s = stripVersionPrefix(version);
  const m = s.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);
  if (!m) return null;
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4]?.trim() ? m[4].trim() : null,
  };
}

function comparePrerelease(a: string | null, b: string | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  const ap = a.split(".");
  const bp = b.split(".");
  const len = Math.max(ap.length, bp.length);
  for (let i = 0; i < len; i++) {
    const ai = ap[i];
    const bi = bp[i];
    if (ai === undefined) return -1;
    if (bi === undefined) return 1;

    const an = /^\d+$/.test(ai) ? Number(ai) : null;
    const bn = /^\d+$/.test(bi) ? Number(bi) : null;

    if (an !== null && bn !== null) {
      if (an !== bn) return an - bn;
      continue;
    }
    if (an !== null) return -1;
    if (bn !== null) return 1;
    if (ai !== bi) return ai < bi ? -1 : 1;
  }
  return 0;
}

/**
 * Semver-style ordering: core numeric parts first, then prerelease (release beats prerelease).
 * @returns negative if a < b, 0 if equal, positive if a > b. Non-parseable values compare as 0 (equal).
 */
export function compareSemverStyle(a: string, b: string): number {
  const pa = parseSemverStyle(a);
  const pb = parseSemverStyle(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;
  return comparePrerelease(pa.prerelease, pb.prerelease);
}

/** True when `latest` is strictly newer than `installed` (both must parse; otherwise false). */
export function isVersionNewer(latest: string, installed: string): boolean {
  if (!parseSemverStyle(latest) || !parseSemverStyle(installed)) return false;
  return compareSemverStyle(latest, installed) > 0;
}

/**
 * True when the running installation is at least `minimumSupportedVersion`
 * (required for applying this update). Both values must parse as semver-style.
 */
export function meetsMinimumSupportedVersion(installed: string, minimumSupportedVersion: string): boolean {
  const a = parseSemverStyle(installed);
  const b = parseSemverStyle(minimumSupportedVersion);
  if (!a || !b) return false;
  return compareSemverStyle(installed, minimumSupportedVersion) >= 0;
}
