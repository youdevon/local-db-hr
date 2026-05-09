"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

import { Button, buttonVariants } from "@/components/ui/button";

type LeaveTransactionsPageActionsProps = {
  employeeId: string;
  contractId: string;
  breakdownView: boolean;
  canCreateLeave: boolean;
};

export function LeaveTransactionsPageActions({
  employeeId,
  contractId,
  breakdownView,
  canCreateLeave,
}: LeaveTransactionsPageActionsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const setQuery = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, value);
        }
      }
      const qs = next.toString();
      router.push(qs ? `/leave/transactions?${qs}` : `/leave/transactions`);
    },
    [router, searchParams],
  );

  const addLeaveHref = `/leave/new?employeeId=${encodeURIComponent(employeeId)}${
    contractId ? `&contractId=${encodeURIComponent(contractId)}` : ""
  }`;

  const showViewToggle = Boolean(employeeId && contractId);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {canCreateLeave && employeeId ? (
        <Link href={addLeaveHref} className={buttonVariants({ className: "h-10 rounded-md text-sm font-medium" })}>
          Add Leave
        </Link>
      ) : null}
      {showViewToggle ? (
        <Button
          type="button"
          variant="outline"
          className="h-10 rounded-md text-sm font-medium"
          onClick={() => {
            setQuery({ view: breakdownView ? null : "breakdown" });
          }}
        >
          {breakdownView ? "Standard View" : "Breakdown View"}
        </Button>
      ) : null}
    </div>
  );
}
