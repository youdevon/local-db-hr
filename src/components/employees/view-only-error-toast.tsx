"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { notifyError } from "@/lib/notify";
import { VIEW_ONLY_ERROR_PARAM, VIEW_ONLY_ERROR_VALUE } from "@/lib/roles";

function ViewOnlyErrorToastInner({ message }: { message: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const shownRef = useRef(false);

  useEffect(() => {
    if (shownRef.current) return;
    if (searchParams.get(VIEW_ONLY_ERROR_PARAM) !== VIEW_ONLY_ERROR_VALUE) return;
    shownRef.current = true;
    notifyError(message);
    const next = new URLSearchParams(searchParams.toString());
    next.delete(VIEW_ONLY_ERROR_PARAM);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [searchParams, message, pathname, router]);

  return null;
}

/** Shows a toast when `?error=view-only` is present, then strips the query param. */
export function ViewOnlyErrorToast({ message }: { message: string }) {
  return (
    <Suspense fallback={null}>
      <ViewOnlyErrorToastInner message={message} />
    </Suspense>
  );
}
