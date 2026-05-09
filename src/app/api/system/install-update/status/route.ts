import fs from "fs";

import { NextResponse } from "next/server";

import { getSession } from "@/lib/get-session";
import { getUpdateInstallPaths, resolveInstallProjectRoot } from "@/lib/update-install-paths";
import { canPerformAction, normalizeUserRole } from "@/lib/roles";
import type { InstallStatusFile } from "@/lib/update-install-status";

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

  const rootResult = resolveInstallProjectRoot();
  if (!rootResult.ok) {
    return NextResponse.json(
      {
        phase: "idle",
        error: rootResult.error,
        installedVersionAtStart: null,
        targetVersion: null,
        backupPath: null,
        success: null,
        finishedAt: null,
      },
      { status: 200 },
    );
  }

  const paths = getUpdateInstallPaths(rootResult.root);
  if (!fs.existsSync(paths.statusFilePath)) {
    return NextResponse.json({
      phase: "idle",
      startedAt: null,
      updatedAt: null,
      finishedAt: null,
      success: null,
      error: null,
      backupPath: null,
      targetVersion: null,
      installedVersionAtStart: null,
      logFileRelative: null,
    });
  }

  try {
    const raw = fs.readFileSync(paths.statusFilePath, "utf8");
    const data = JSON.parse(raw) as InstallStatusFile;
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Could not read install status." }, { status: 500 });
  }
}
