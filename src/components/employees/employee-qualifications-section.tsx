import { getEmployeeQualificationsBundle } from "@/lib/server/employee-qualifications-bundle";

import { EmployeeQualificationsTabClient } from "@/components/employees/employee-qualifications-tab-client";

type Props = {
  employeeId: string;
  allowEdit: boolean;
};

export async function EmployeeQualificationsSection({ employeeId, allowEdit }: Props) {
  const bundle = await getEmployeeQualificationsBundle(employeeId);
  return (
    <EmployeeQualificationsTabClient employeeId={employeeId} initialBundle={bundle} allowEdit={allowEdit} />
  );
}
