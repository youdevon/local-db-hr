import fs from "fs";
import path from "path";
import { spawn } from "child_process";

import { NextResponse } from "next/server";

import { auditUpdateInstallRequested } from "@/lib/update-install-audit";
import {
  acquireUpdateInstallLock,
  releaseUpdateInstallLock,
} from "@/lib/update-install-lock";
import type { UpdateInstallConfigJson } from "@/lib/update-install-config";
import { getUpdateCheckSettings } from "@/lib/update-check-settings";
import { fetchUpdateManifest, validateUpdateManifestJson } from "@/lib/update-manifest";
import { isTrustedGithubReleaseDownloadUrl } from "@/lib/trusted-download-url";
import { getSession } from "@/lib/get-session";
import { getInstalledAppVersion } from "@/lib/version-server";
import { getUpdateInstallPaths, resolveInstallProjectRoot } from "@/lib/update-install-paths";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import { meetsMinimumSupportedVersion, isVersionNewer } from "@/lib/version-compare";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const session = await getSession();
  const user = session.user;
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeUserRole(user.role);
  if (!canPerformAction(role, "settings.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rootResult = resolveInstallProjectRoot();
  if (!rootResult.ok) {
    return NextResponse.json({ error: rootResult.error }, { status: 503 });
  }

  const projectRoot = rootResult.root;
  const paths = getUpdateInstallPaths(projectRoot);
  const installedVersion = getInstalledAppVersion();
  const { manifestUrl } = await getUpdateCheckSettings();

  const fetched = await fetchUpdateManifest(manifestUrl);
  if (!fetched.ok) {
    return NextResponse.json(
      { error: "Cannot reach update manifest. Try again when the server has network access." },
      { status: 503 },
    );
  }

  const validation = validateUpdateManifestJson(fetched.data);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const manifest = validation.manifest;

  if (!manifest.downloadUrl?.trim()) {
    return NextResponse.json({ error: "Manifest has no download URL." }, { status: 400 });
  }

  if (!isTrustedGithubReleaseDownloadUrl(manifest.downloadUrl)) {
    return NextResponse.json(
      { error: "Download URL is not an approved GitHub URL for this repository." },
      { status: 400 },
    );
  }

  if (!isVersionNewer(manifest.latestVersion, installedVersion)) {
    return NextResponse.json(
      { error: "No newer version is available according to the manifest." },
      { status: 400 },
    );
  }

  const minimum = manifest.minimumSupportedVersion?.trim();
  if (minimum) {
    if (!meetsMinimumSupportedVersion(installedVersion, minimum)) {
      return NextResponse.json(
        {
          error: `This installation (${installedVersion}) is below the minimum supported version (${minimum}) for this update.`,
        },
        { status: 400 },
      );
    }
  }

  const lockAcquire = acquireUpdateInstallLock(paths.lockFilePath);
  if (!lockAcquire.ok) {
    return NextResponse.json({ error: lockAcquire.reason }, { status: 409 });
  }

  fs.mkdirSync(paths.updateStagingDir, { recursive: true });
  fs.mkdirSync(paths.updatePackagesDir, { recursive: true });
  fs.mkdirSync(paths.backupsUpdatesDir, { recursive: true });

  const config: UpdateInstallConfigJson = {
    projectRoot,
    targetVersion: manifest.latestVersion,
    releaseTag: manifest.releaseTag?.trim() || `v${manifest.latestVersion.replace(/^v/, "")}`,
    downloadUrl: manifest.downloadUrl,
    expectedAppName: manifest.appName,
    minimumSupportedVersion: minimum || null,
    installedVersionAtStart: installedVersion,
    actorUserId: user.userId,
    actorEmail: user.email ?? null,
    actorName: user.name ?? null,
    paths: {
      updatePackagesDir: paths.updatePackagesDir,
      updateStagingDir: paths.updateStagingDir,
      backupsUpdatesDir: paths.backupsUpdatesDir,
      logFilePath: paths.logFilePath,
    },
    lockFilePath: paths.lockFilePath,
    statusFilePath: paths.statusFilePath,
  };

  const configPath = path.join(paths.updateStagingDir, `install-config-${Date.now()}.json`);
  const scriptPath = path.join(projectRoot, "scripts", "install-update.sh");

  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), { encoding: "utf8", mode: 0o600 });

    await auditUpdateInstallRequested(
      {
        actorUserId: user.userId,
        actorEmail: user.email ?? null,
        actorName: user.name ?? null,
      },
      {
        installedVersion,
        targetVersion: manifest.latestVersion,
        releaseTag: config.releaseTag,
        downloadUrl: manifest.downloadUrl,
        manifestUrl,
      },
    );

    const initialStatus = {
      phase: "preparing_update",
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      finishedAt: null as string | null,
      success: null as boolean | null,
      error: null as string | null,
      backupPath: null as string | null,
      targetVersion: manifest.latestVersion,
      installedVersionAtStart: installedVersion,
      logFileRelative: "update-staging/install-update.log",
    };
    fs.writeFileSync(paths.statusFilePath, JSON.stringify(initialStatus, null, 2), { encoding: "utf8" });

    if (!fs.existsSync(scriptPath)) {
      releaseUpdateInstallLock(paths.lockFilePath);
      return NextResponse.json({ error: "Install script is missing on the server." }, { status: 500 });
    }

    const child = spawn("bash", [scriptPath, configPath], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        DBHR_PROJECT_ROOT: projectRoot,
        DBHR_AUDIT_ACTOR_USER_ID: user.userId,
        DBHR_AUDIT_ACTOR_EMAIL: user.email ?? "",
        DBHR_AUDIT_ACTOR_NAME: user.name ?? "",
      },
    });

    child.unref();

    if (!child.pid) {
      releaseUpdateInstallLock(paths.lockFilePath);
      return NextResponse.json({ error: "Failed to start install process." }, { status: 500 });
    }

    fs.writeFileSync(paths.lockFilePath, `${child.pid}\n${Date.now()}`, { encoding: "utf8" });

    return NextResponse.json({
      accepted: true,
      message:
        "Update has started. The app may restart; refresh after a few minutes and verify the installed version. Detailed logs are written under update-staging/install-update.log.",
      statusEndpoint: "/api/system/install-update/status",
      targetVersion: manifest.latestVersion,
      logHint: paths.logFilePath,
    });
  } catch (e) {
    releaseUpdateInstallLock(paths.lockFilePath);
    console.error("[install-update]", e);
    return NextResponse.json({ error: "Failed to start the update installation." }, { status: 500 });
  }
}
