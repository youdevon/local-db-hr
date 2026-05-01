"use client";

import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

type BackLinkProps = {
  fallbackHref?: string;
  className?: string;
};

const btnClass =
  "text-muted-foreground hover:text-primary inline-flex items-center gap-1 rounded-md text-sm font-medium transition-colors focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus:outline-none";

export function BackLink({ fallbackHref = "/", className }: BackLinkProps) {
  const router = useRouter();

  function handleBack() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
      return;
    }
    router.push(fallbackHref);
  }

  return (
    <button type="button" onClick={handleBack} className={cn(btnClass, className)}>
      <span aria-hidden="true">←</span>
      <span>Back</span>
    </button>
  );
}
