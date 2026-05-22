import { APP_CONFIG } from "@/lib/app-config";

export function getAppVersion(): string {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || APP_CONFIG.version || "v0.13.1-beta";

  if (version.startsWith("v")) {
    return version;
  }

  return `v${version}`;
}

export function getVersionLabel(): string {
  return `Version ${getAppVersion()}`;
}
