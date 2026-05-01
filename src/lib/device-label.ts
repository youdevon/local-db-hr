/**
 * Derives a short, human-readable device label from User-Agent (server-side).
 * Does not attempt to read OS hostname.
 */
export function getDeviceLabel(userAgent: string | null): string {
  if (!userAgent || !userAgent.trim()) return "Unknown Device";

  const ua = userAgent;

  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS Device";
  if (/Android/i.test(ua)) return "Android Device";

  const isWindows = /Windows NT|Win64|Windows/i.test(ua);
  if (isWindows) {
    if (/\bEdg\b|Edge\//i.test(ua)) return "Edge on Windows PC";
    if (/Chrome\//i.test(ua) && !/\bEdg\b/i.test(ua)) return "Chrome on Windows PC";
    return "Windows PC";
  }

  if (/Macintosh|Mac OS X/i.test(ua)) return "Mac Device";
  if (/Linux/i.test(ua)) return "Linux Device";

  return "Unknown Device";
}
