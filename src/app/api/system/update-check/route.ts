import { NextResponse } from "next/server";

import {
  auditUpdateCheckFailed,
  auditUpdateCheckStarted,
  auditUpdateCheckSuccessful,
} from "@/lib/update-check-audit";
import { getUpdateCheckSettings } from "@/lib/update-check-settings";
import {
  buildUpdateCheckResult,
  fetchUpdateManifest,
  validateUpdateManifestJson,
} from "@/lib/update-manifest";
import { getSession } from "@/lib/get-session";
import { getInstalledAppVersion } from "@/lib/version-server";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const session = await getSession();
  const user = session.user;
  if (!user?.userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = normalizeUserRole(user.role);
  if (!canPerformAction(role, "settings.edit")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const installedVersion = getInstalledAppVersion();
  const { manifestUrl } = await getUpdateCheckSettings();

  await auditUpdateCheckStarted({
    adminUserId: user.userId,
    adminEmail: user.email ?? null,
    installedVersion,
    manifestUrl,
  });

  const fetched = await fetchUpdateManifest(manifestUrl);
  if (!fetched.ok) {
    if (fetched.reason === "invalid_json") {
      const err = "The update manifest response was not valid JSON.";
      const body = buildUpdateCheckResult({
        installedVersion,
        manifest: null,
        manifestError: err,
        fetchFailed: false,
      });
      await auditUpdateCheckFailed({
        adminUserId: user.userId,
        adminEmail: user.email ?? null,
        installedVersion,
        latestVersion: null,
        updateAvailable: false,
        manifestUrl,
        errorMessage: err,
      });
      return NextResponse.json(body);
    }

    const body = buildUpdateCheckResult({
      installedVersion,
      manifest: null,
      manifestError: null,
      fetchFailed: true,
    });

    await auditUpdateCheckFailed({
      adminUserId: user.userId,
      adminEmail: user.email ?? null,
      installedVersion,
      latestVersion: null,
      updateAvailable: false,
      manifestUrl,
      errorMessage: body.error,
    });

    return NextResponse.json(body);
  }

  const validation = validateUpdateManifestJson(fetched.data);
  if (!validation.ok) {
    const body = buildUpdateCheckResult({
      installedVersion,
      manifest: null,
      manifestError: validation.error,
      fetchFailed: false,
    });
    await auditUpdateCheckFailed({
      adminUserId: user.userId,
      adminEmail: user.email ?? null,
      installedVersion,
      latestVersion: null,
      updateAvailable: false,
      manifestUrl,
      errorMessage: validation.error,
    });
    return NextResponse.json(body);
  }

  const body = buildUpdateCheckResult({
    installedVersion,
    manifest: validation.manifest,
    manifestError: null,
    fetchFailed: false,
  });

  await auditUpdateCheckSuccessful({
    adminUserId: user.userId,
    adminEmail: user.email ?? null,
    installedVersion,
    latestVersion: body.latestVersion,
    updateAvailable: body.updateAvailable,
    manifestUrl,
    errorMessage: null,
  });

  return NextResponse.json(body);
}
