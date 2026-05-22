"use client";

import { ShieldAlert } from "lucide-react";
import Link from "next/link";

export function PasswordChangeRequiredBanner() {
  return (
    <div
      className="border-amber-500/50 bg-amber-500/10 text-amber-950 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-50 mb-4 flex gap-3 rounded-lg border px-4 py-3 text-sm"
      role="alert"
    >
      <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-200" aria-hidden />
      <div className="space-y-1">
        <p className="font-medium">Temporary setup password in use</p>
        <p>
          You signed in with the default administrator credentials from installation. Change your password
          immediately on your{" "}
          <Link href="/profile?changePassword=required" className="font-medium underline underline-offset-2">
            profile page
          </Link>{" "}
          before using the rest of the application.
        </p>
      </div>
    </div>
  );
}
