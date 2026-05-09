import "server-only";

import { prisma } from "@/lib/prisma";

/** Target label for system_audit_logs.target_label when target_type is employee */
export async function getEmployeeAuditTargetLabel(employeeId: string): Promise<string> {
  const e = await prisma.employees.findUnique({
    where: { id: employeeId },
    select: { first_name: true, last_name: true },
  });
  const name = [e?.first_name?.trim(), e?.last_name?.trim()].filter(Boolean).join(" ").trim();
  return name.length ? `Employee: ${name}` : "Employee: Unknown";
}
