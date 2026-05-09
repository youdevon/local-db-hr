export const INSTALL_PHASES = [
  "preparing_update",
  "downloading_package",
  "validating_package",
  "backup_started",
  "backup_completed",
  "installing_files",
  "rebuilding_application",
  "database_migration_started",
  "restarting_application",
  "verifying_update",
  "completed",
  "failed",
] as const;

export type InstallPhase = (typeof INSTALL_PHASES)[number];

export type InstallStatusFile = {
  phase: InstallPhase | string;
  startedAt: string;
  updatedAt: string;
  finishedAt: string | null;
  success: boolean | null;
  error: string | null;
  backupPath: string | null;
  targetVersion: string | null;
  installedVersionAtStart: string | null;
  logFileRelative: string | null;
};
