import { redirect } from "next/navigation";

import { getSession } from "@/lib/get-session";
import { normalizeUserRole } from "@/lib/roles";

/**
 * Alias route for dashboard access; keeps "/" as canonical home for staff roles.
 */
export default async function DashboardAliasPage() {
  const session = await getSession();
  const role = normalizeUserRole(session.user?.role);
  if (role === "member") redirect("/profile");
  redirect("/");
}
