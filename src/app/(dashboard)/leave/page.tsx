import type { Metadata } from "next";

import { LeaveClient } from "./leave-client";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { getSession } from "@/lib/get-session";
import { canPerformAction, normalizeUserRole, VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE } from "@/lib/roles";
import { getLeaveWarningSettings } from "@/lib/leave-warning-settings";
import { getLeaveSearchRowsFromDatabase } from "@/lib/server/leave-search";

export const metadata: Metadata = {
  title: "Leave",
};

export default async function LeavePage() {
  const [rows, leaveWarningSettings, session] = await Promise.all([
    getLeaveSearchRowsFromDatabase(),
    getLeaveWarningSettings(),
    getSession(),
  ]);
  const role = normalizeUserRole(session.user?.role);
  return (
    <>
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_MUTATE_HR_MESSAGE} />
      <LeaveClient
        rows={rows}
        leaveWarningSettings={leaveWarningSettings}
        canCreate={canPerformAction(role, "leave.create")}
      />
    </>
  );
}
