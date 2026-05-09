import "server-only";

import { createSystemAuditLog, getAuditRequestContext } from "@/lib/audit";

export type InstallAuditActor = {
  actorUserId: string;
  actorEmail: string | null;
  actorName: string | null;
};

export async function auditUpdateInstallRequested(
  actor: InstallAuditActor,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { ip, userAgent, deviceLabel } = await getAuditRequestContext();
  await createSystemAuditLog({
    actorUserId: actor.actorUserId,
    actorEmail: actor.actorEmail,
    actorName: actor.actorName,
    module: "Global Settings",
    action: "update_install_requested",
    targetType: "settings",
    targetLabel: "Settings: Licence & Updates",
    success: true,
    ipAddress: ip,
    deviceName: deviceLabel,
    userAgent,
    metadata,
  });
}
