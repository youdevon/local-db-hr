import { getDeviceLabel } from "@/lib/device-label";
import { normalizeIpAddress } from "@/lib/ip-address";

/** Prefer stored device_name; otherwise derive from User-Agent. */
export function displayAuditDeviceName(
  deviceName: string | null | undefined,
  userAgent: string | null | undefined,
): string {
  const stored = deviceName?.trim();
  if (stored) return stored;
  return getDeviceLabel(userAgent ?? null);
}

/** Normalize IP for table/detail display. */
export function displayAuditIp(ip: string | null | undefined): string {
  const n = normalizeIpAddress(typeof ip === "string" ? ip : ip == null ? null : String(ip));
  return n ?? "—";
}
