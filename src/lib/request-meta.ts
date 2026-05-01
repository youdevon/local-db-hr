import { headers } from "next/headers";

import { getDeviceLabel } from "@/lib/device-label";
import { normalizeIpAddress } from "@/lib/ip-address";

export async function getRequestMeta(): Promise<{
  ip: string | null;
  userAgent: string | null;
  deviceLabel: string | null;
}> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const rawIp =
    forwarded?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    h.get("cf-connecting-ip") ??
    null;
  const ip = normalizeIpAddress(rawIp);
  const userAgent = h.get("user-agent");
  return {
    ip,
    userAgent,
    deviceLabel: getDeviceLabel(userAgent),
  };
}
