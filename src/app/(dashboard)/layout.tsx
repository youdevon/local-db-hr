import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { SessionTimeoutProvider } from "@/components/session-timeout-provider";
import { getSession } from "@/lib/get-session";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";
import { isViewerRole } from "@/lib/roles";

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

  return (
    <SessionTimeoutProvider timeoutMinutes={20}>
      <AppShell user={session.user} viewOnly={viewOnly}>
        {children}
      </AppShell>
    </SessionTimeoutProvider>
  );
}
