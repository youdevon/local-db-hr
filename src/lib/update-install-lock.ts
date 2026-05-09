import "server-only";

import fs from "fs";

/**
 * Prevents concurrent installs. Lock file may contain `starting` or a process id (install script).
 */
export function isStaleUpdateLock(lockPath: string): boolean {
  if (!fs.existsSync(lockPath)) return true;
  const st = fs.statSync(lockPath);
  const ageMs = Date.now() - st.mtimeMs;
  const rawFirst = fs.readFileSync(lockPath, "utf8").trim().split(/\r?\n/)[0] ?? "";

  if (rawFirst === "starting") {
    return ageMs > 15 * 60 * 1000;
  }
  if (ageMs > 4 * 60 * 60 * 1000) {
    return true;
  }

  const pid = Number(rawFirst);
  if (!Number.isFinite(pid) || pid <= 0) {
    return ageMs > 15 * 60 * 1000;
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch {
    return true;
  }
}

export type AcquireLockResult = { ok: true } | { ok: false; reason: string };

export function acquireUpdateInstallLock(lockPath: string): AcquireLockResult {
  if (fs.existsSync(lockPath)) {
    if (!isStaleUpdateLock(lockPath)) {
      return { ok: false, reason: "An update is already running or lock file is present." };
    }
    fs.unlinkSync(lockPath);
  }
  try {
    fs.writeFileSync(lockPath, `starting\n${Date.now()}`, { flag: "wx" });
    return { ok: true };
  } catch (e) {
    const err = e as NodeJS.ErrnoException;
    if (err.code === "EEXIST") {
      return { ok: false, reason: "An update is already running or lock file is present." };
    }
    throw e;
  }
}

export function releaseUpdateInstallLock(lockPath: string): void {
  try {
    if (fs.existsSync(lockPath)) {
      fs.unlinkSync(lockPath);
    }
  } catch {
    // ignore
  }
}
