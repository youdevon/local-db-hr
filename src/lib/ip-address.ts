/**
 * Normalizes client IP strings for storage and display (prefer IPv4 where possible).
 */
export function normalizeIpAddress(input: string | null): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  const first = trimmed.split(",")[0]?.trim() ?? trimmed;

  let cand = first;
  if (cand.startsWith("[") && cand.endsWith("]")) {
    cand = cand.slice(1, -1);
  }

  if (cand === "::1") return "127.0.0.1";

  const lower = cand.toLowerCase();
  if (lower.startsWith("::ffff:")) {
    const v4 = cand.slice(7);
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(v4)) return v4;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(cand)) return cand;

  return cand;
}
