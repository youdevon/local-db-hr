import "server-only";

import fs from "fs";
import path from "path";

import { APP_CONFIG } from "@/lib/app-config";

/**
 * Installed application version for server-side use (API, settings pages).
 * Prefers explicit env, then VERSION.txt on disk, then APP_CONFIG.
 */
export function getInstalledAppVersion(): string {
  const env = process.env.APP_VERSION?.trim() || process.env.NEXT_PUBLIC_APP_VERSION?.trim();
  if (env) {
    return env.startsWith("v") ? env : `v${env}`;
  }

  try {
    const versionPath = path.join(process.cwd(), "VERSION.txt");
    const raw = fs.readFileSync(versionPath, "utf8");
    const line = raw.split(/\r?\n/).find((l) => /^\s*Version\s*:/i.test(l));
    if (line) {
      const m = line.match(/Version\s*:\s*v?([\w.-]+)/i);
      if (m?.[1]) {
        const v = m[1].trim();
        return v.startsWith("v") ? v : `v${v}`;
      }
    }
  } catch {
    // VERSION.txt may be absent in some dev layouts; fall through.
  }

  const v = APP_CONFIG.version.trim();
  return v.startsWith("v") ? v : `v${v}`;
}
