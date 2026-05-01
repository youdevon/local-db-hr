import type { Metadata } from "next";

import { EmployeesClient } from "./employees-client";
import { ViewOnlyErrorToast } from "@/components/employees/view-only-error-toast";
import { getSession } from "@/lib/get-session";
import {
  canCreateEmployees,
  VIEW_ONLY_CANNOT_CREATE_EMPLOYEE_MESSAGE,
  VIEWER_NOTICE_MESSAGES,
  VIEWER_NOTICE_PARAM,
} from "@/lib/roles";
import { getEmployeesForUi } from "@/lib/server/hr";
import { toDirectoryRow } from "@/lib/employees-directory";

export const metadata: Metadata = {
  title: "Employees",
};

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [employees, session] = await Promise.all([getEmployeesForUi(), getSession()]);
  const sp = (await (searchParams ?? Promise.resolve({}))) as Record<string, string | string[] | undefined>;
  const roleInput = session.user?.role ?? null;
  const rows = employees.map(toDirectoryRow);
  const noticeRaw = sp[VIEWER_NOTICE_PARAM];
  const viewerNotice =
    typeof noticeRaw === "string" && noticeRaw in VIEWER_NOTICE_MESSAGES ? noticeRaw : undefined;
  const viewerNoticeMessage = viewerNotice ? VIEWER_NOTICE_MESSAGES[viewerNotice] : undefined;

  return (
    <>
      <ViewOnlyErrorToast message={VIEW_ONLY_CANNOT_CREATE_EMPLOYEE_MESSAGE} />
      <EmployeesClient
        rows={rows}
        canCreate={canCreateEmployees(roleInput)}
        viewerNoticeMessage={viewerNoticeMessage}
      />
    </>
  );
}
