import "server-only";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";

export type UpdateCheckAuditMetadata = {
  adminUserId: string;
  adminEmail: string | null;
  installedVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  manifestUrl: string;
  errorMessage: string | null;
};

export async function auditUpdateCheckStarted(meta: Pick<UpdateCheckAuditMetadata, "adminUserId" | "adminEmail" | "installedVersion" | "manifestUrl">) {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: meta.adminUserId,
    actorEmail: meta.adminEmail,
    module: "Global Settings",
    action: "update_check_started",
    targetType: "settings",
    targetLabel: "Settings: Licence & Updates",
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    metadata: {
      installedVersion: meta.installedVersion,
      manifestUrl: meta.manifestUrl,
    },
  });
}

export async function auditUpdateCheckSuccessful(meta: UpdateCheckAuditMetadata) {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: meta.adminUserId,
    actorEmail: meta.adminEmail,
    module: "Global Settings",
    action: "update_check_successful",
    targetType: "settings",
    targetLabel: "Settings: Licence & Updates",
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    metadata: {
      installedVersion: meta.installedVersion,
      latestVersion: meta.latestVersion,
      updateAvailable: meta.updateAvailable,
      manifestUrl: meta.manifestUrl,
    },
  });

  if (meta.updateAvailable) {
    await createSystemAuditLog({
      actorUserId: meta.adminUserId,
      actorEmail: meta.adminEmail,
      module: "Global Settings",
      action: "update_available",
      targetType: "settings",
      targetLabel: "Settings: Licence & Updates",
      success: true,
      ipAddress: ip,
      deviceName: deviceLabel,
      userAgent,
      metadata: {
        installedVersion: meta.installedVersion,
        latestVersion: meta.latestVersion,
        manifestUrl: meta.manifestUrl,
      },
    });
  }
}

export async function auditUpdateCheckFailed(meta: UpdateCheckAuditMetadata) {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: meta.adminUserId,
    actorEmail: meta.adminEmail,
    module: "Global Settings",
    action: "update_check_failed",
    targetType: "settings",
    targetLabel: "Settings: Licence & Updates",
    success: false,
    failureReason: meta.errorMessage ?? "Update check failed",
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    metadata: {
      installedVersion: meta.installedVersion,
      latestVersion: meta.latestVersion,
      updateAvailable: meta.updateAvailable,
      manifestUrl: meta.manifestUrl,
      errorMessage: meta.errorMessage,
    },
  });
}
