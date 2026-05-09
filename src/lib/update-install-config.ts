import type { UpdateInstallPaths } from "@/lib/update-install-paths";

export type UpdateInstallConfigJson = {
  projectRoot: string;
  targetVersion: string;
  releaseTag: string;
  downloadUrl: string;
  expectedAppName: string;
  minimumSupportedVersion: string | null;
  installedVersionAtStart: string;
  actorUserId: string;
  actorEmail: string | null;
  actorName: string | null;
  paths: Pick<UpdateInstallPaths, "updatePackagesDir" | "updateStagingDir" | "backupsUpdatesDir" | "logFilePath">;
  lockFilePath: string;
  statusFilePath: string;
};
