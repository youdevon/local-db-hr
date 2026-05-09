import { EmployeeQualificationsTabClient } from "@/components/employees/employee-qualifications-tab-client";
import type { EmployeeQualificationsBundle } from "@/lib/server/employee-qualifications-bundle";

type Props = {
  bundle: EmployeeQualificationsBundle | null;
};

/**
 * Read-only self-service view of the signed-in employee’s qualifications (same data as HR module).
 */
export function ProfileQualificationsTab({ bundle }: Props) {
  if (!bundle) {
    return (
      <p className="text-muted-foreground text-sm">
        No employee record is linked, or qualifications could not be loaded.
      </p>
    );
  }

  return (
    <EmployeeQualificationsTabClient
      employeeId={bundle.employeeId}
      initialBundle={bundle}
      allowEdit={false}
    />
  );
}
