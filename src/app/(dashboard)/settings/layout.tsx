import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";
import { LOGIN_SESSION_EXPIRED_HREF } from "@/lib/session";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session.user) redirect(LOGIN_SESSION_EXPIRED_HREF);
  const role = normalizeUserRole(session.user.role);
  if (role !== "administrator") {
    redirect(role === "member" ? "/profile" : "/unauthorized");
  }
  return <>{children}</>;
}
