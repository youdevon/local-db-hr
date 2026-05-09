import { redirect } from "next/navigation";

export default async function LegacyEmployeeLeaveTransactionsPage({
  params,
}: {
  params: Promise<{ employeeId: string }>;
}) {
  const { employeeId } = await params;
  redirect(`/leave/transactions?employeeId=${encodeURIComponent(employeeId)}`);
}
