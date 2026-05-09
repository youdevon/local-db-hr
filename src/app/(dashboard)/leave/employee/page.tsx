import { redirect } from "next/navigation";

/**
 * Breadcrumb target for the “Employee” segment (Leave / Employee / …).
 * The leave hub lists employees; there is no separate directory at this path.
 */
export default function LeaveEmployeeIndexPage() {
  redirect("/leave");
}
