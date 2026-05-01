import type { Metadata } from "next";
import { Prisma } from "@prisma/client";

import { UsersManagementClient } from "@/components/settings/users-management-client";
import { getSession } from "@/lib/get-session";
import type { ManagedEmployeeOption, ManagedUserRow } from "@/lib/managed-user";
import { prisma } from "@/lib/prisma";
import { normalizeUserRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "User Accounts",
};

export default async function SettingsUsersPage() {
  const session = await getSession();
  const currentUserId = session.user!.userId;

  let rows: ManagedUserRow[] = [];
  let employeeOptions: ManagedEmployeeOption[] = [];

  try {
    const [users, employees, employeeIds] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          id: string;
          email: string;
          is_active: boolean;
          is_locked: boolean;
          last_login_at: Date | null;
          full_name: string | null;
          initials: string | null;
          role: string | null;
          department: string | null;
          employee_id: string | null;
          linked_employee_name: string | null;
          linked_employee_file_number: string | null;
          linked_employee_department: string | null;
          linked_employee_position: string | null;
        }>
      >(Prisma.sql`
        SELECT
          u.id::text AS id,
          u.email,
          u.is_active,
          u.is_locked,
          u.last_login_at,
          p.full_name,
          p.initials,
          p.role,
          p.department,
          p.employee_id::text AS employee_id,
          trim(e.first_name || ' ' || e.last_name) AS linked_employee_name,
          e.file_number AS linked_employee_file_number,
          e.department AS linked_employee_department,
          e.position AS linked_employee_position
        FROM public.users u
        LEFT JOIN public.user_profiles p
          ON p.user_id = u.id
        LEFT JOIN public.employees e
          ON e.id = p.employee_id
        ORDER BY u.created_at DESC NULLS LAST, u.email ASC
      `),
      prisma.$queryRaw<
        Array<{
          id: string;
          first_name: string;
          last_name: string;
          file_number: string;
          mobile_number: string | null;
          home_number: string | null;
          work_email: string | null;
          personal_email: string | null;
          department: string | null;
          position: string | null;
          attached_user_id: string | null;
        }>
      >(Prisma.sql`
        SELECT
          e.id::text AS id,
          e.first_name,
          e.last_name,
          e.file_number,
          e.mobile_number,
          e.home_number,
          e.work_email,
          e.personal_email,
          e.department,
          e.position,
          p.user_id::text AS attached_user_id
        FROM public.employees e
        LEFT JOIN public.user_profiles p
          ON p.employee_id = e.id
        ORDER BY e.last_name ASC, e.first_name ASC
      `),
      prisma.$queryRaw<Array<{ employee_id: string; id_number: string }>>(Prisma.sql`
        SELECT employee_id::text AS employee_id, id_number
        FROM public.employee_identifications
      `),
    ]);

    const idMap = new Map<string, string[]>();
    employeeIds.forEach((row) => {
      const list = idMap.get(row.employee_id) ?? [];
      list.push(row.id_number);
      idMap.set(row.employee_id, list);
    });

    rows = users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.full_name ?? "—",
      initials: u.initials ?? null,
      role: normalizeUserRole(u.role),
      department: u.department ?? null,
      employeeId: u.employee_id ?? null,
      linkedEmployeeName: u.linked_employee_name ?? null,
      linkedEmployeeFileNumber: u.linked_employee_file_number ?? null,
      linkedEmployeeDepartment: u.linked_employee_department ?? null,
      linkedEmployeePosition: u.linked_employee_position ?? null,
      isActive: u.is_active,
      isLocked: u.is_locked,
      lastLoginAt: u.last_login_at?.toISOString() ?? null,
    }));
    employeeOptions = employees.map((employee) => {
      const fullName = `${employee.first_name} ${employee.last_name}`.trim();
      return {
        id: employee.id,
        fullName,
        fileNumber: employee.file_number,
        mobileNumber: employee.mobile_number ?? "—",
        homeNumber: employee.home_number ?? "—",
        workEmail: employee.work_email ?? "—",
        personalEmail: employee.personal_email ?? "—",
        position: employee.position ?? "—",
        department: employee.department ?? "—",
        attachedUserId: employee.attached_user_id ?? null,
        searchText: [
          employee.first_name,
          employee.last_name,
          fullName,
          employee.file_number,
          employee.mobile_number ?? "",
          employee.home_number ?? "",
          employee.work_email ?? "",
          employee.personal_email ?? "",
          ...(idMap.get(employee.id) ?? []),
        ]
          .join(" ")
          .toLowerCase(),
      };
    });
  } catch {
    rows = [];
    employeeOptions = [];
  }

  return (
    <UsersManagementClient
      initialUsers={rows}
      currentUserId={currentUserId}
      employeeOptions={employeeOptions}
    />
  );
}
