import "server-only";

import fs from "fs";
import path from "path";

export type UpdateInstallPaths = {
  projectRoot: string;
  updatePackagesDir: string;
  updateStagingDir: string;
  backupsUpdatesDir: string;
  lockFilePath: string;
  statusFilePath: string;
  logFilePath: string;
};

export type ResolveInstallRootResult =
  | { ok: true; root: string }
  | { ok: false; error: string };

/**
 * Resolve the filesystem root used for installs and backups.
 * When running inside Docker without a bind-mounted host checkout, set DB_HR_PROJECT_ROOT.
 */
export function resolveInstallProjectRoot(): ResolveInstallRootResult {
  const explicit = process.env.DB_HR_PROJECT_ROOT?.trim();
  if (explicit) {
    return { ok: true, root: path.resolve(explicit) };
  }
  try {
    if (fs.existsSync("/.dockerenv")) {
      return {
        ok: false,
        error:
          "Server-side install requires DB_HR_PROJECT_ROOT pointing at the host project directory (read-write bind mount).",
      };
    }
  } catch {
    // ignore
  }
  return { ok: true, root: process.cwd() };
}

export function getUpdateInstallPaths(projectRoot: string): UpdateInstallPaths {
  const updatePackagesDir =
    process.env.DB_HR_UPDATE_PACKAGES_DIR?.trim() || path.join(projectRoot, "update-packages");
  const updateStagingDir =
    process.env.DB_HR_UPDATE_STAGING_DIR?.trim() || path.join(projectRoot, "update-staging");
  const backupsUpdatesDir =
    process.env.DB_HR_BACKUPS_UPDATES_DIR?.trim() || path.join(projectRoot, "backups", "updates");

  return {
    projectRoot,
    updatePackagesDir,
    updateStagingDir,
    backupsUpdatesDir,
    lockFilePath: path.join(updateStagingDir, ".update-install.lock"),
    statusFilePath: path.join(updateStagingDir, "install-status.json"),
    logFilePath: path.join(updateStagingDir, "install-update.log"),
  };
}
