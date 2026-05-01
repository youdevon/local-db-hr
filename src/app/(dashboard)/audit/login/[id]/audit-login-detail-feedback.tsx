"use client";

import { useEffect, useRef } from "react";

import { notifyError } from "@/lib/notify";

export function AuditLoginDetailFeedback({
  loadError,
  children,
}: {
  loadError: boolean;
  children: React.ReactNode;
}) {
  const reported = useRef(false);

  useEffect(() => {
    if (loadError && !reported.current) {
      reported.current = true;
      notifyError("Failed to load audit log.");
    }
  }, [loadError]);

  return <>{children}</>;
}
