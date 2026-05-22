import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/get-session";
import { getLicenseStatus, type LicenseStatus } from "@/lib/license";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";
import { isViewerRole, normalizeUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.user) redirect(LOGIN_SESSION_EXPIRED_HREF);

  const viewOnly = isViewerRole(session.user.role);
  const role = normalizeUserRole(session.user.role);
  const mustChangePassword = session.user.mustChangePassword === true;
  const canOpenLicenseSettings = role === "administrator";

  let licenseIndicator: SidebarLicenseIndicator | null = null;
  if (role !== "member") {
    const license = await getLicenseStatus();
    const { text, fullText, tone } = getSidebarLicenseBadge(license.status, {
      daysRemaining: license.daysRemaining,
      clockTamperDetected: license.clockTamperDetected,
    });

    licenseIndicator = {
      href: canOpenLicenseSettings ? "/settings/license" : null,
      text,
      fullText,
      tone,
    };
  }

  return (
    <AppShell
      user={session.user}
      viewOnly={viewOnly}
      mustChangePassword={mustChangePassword}
      licenseIndicator={licenseIndicator}
    >
      {children}
    </AppShell>
  );
}

function getSidebarLicenseBadge(
  status: LicenseStatus,
  values: {
    daysRemaining: number | null;
    clockTamperDetected: boolean;
  },
): Pick<SidebarLicenseIndicator, "text" | "fullText" | "tone"> {
  if (values.clockTamperDetected) {
    return { text: "Invalid", fullText: "Invalid licence status due to server clock mismatch.", tone: "danger" };
  }

  if (status === "permanent") {
    return { text: "Licensed", fullText: "Permanent licence.", tone: "success" };
  }

  if (status === "suspended") {
    return { text: "Suspended", fullText: "Licence is suspended.", tone: "danger" };
  }

  if (status === "expired") {
    return { text: "Expired", fullText: "Licence is expired.", tone: "danger" };
  }

  if (status === "invalid") {
    return { text: "Invalid", fullText: "Licence configuration is invalid.", tone: "danger" };
  }

  if (status === "trial_grace") {
    const overdueDays = Math.max(1, Math.abs(values.daysRemaining ?? 0));
    return {
      text: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      fullText: `Licence expired ${overdueDays} day${overdueDays === 1 ? "" : "s"} ago. Grace period active.`,
      tone: "danger",
    };
  }

  if (status === "active" || status === "trial_active") {
    if (values.daysRemaining == null) {
      return { text: "Licensed", fullText: "Licensed. Active licence with no expiry.", tone: "success" };
    }
    const days = Math.max(0, values.daysRemaining);
    if (days > 60) {
      return { text: "Licensed", fullText: "Licensed. More than 60 days remaining.", tone: "success" };
    }
    return {
      text: `Expiring in ${days} day${days === 1 ? "" : "s"}`,
      fullText: `Expiring in ${days} day${days === 1 ? "" : "s"}.`,
      tone: "caution",
    };
  }

  return { text: "Invalid", fullText: "Licence configuration is invalid.", tone: "danger" };
}
