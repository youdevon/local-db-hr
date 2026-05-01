import type { SessionUser } from "@/lib/session";

import { HeaderActions } from "@/components/header-actions";

export function TopHeader({ user }: { user: SessionUser }) {
  return (
    <header className="border-border bg-sidebar/95 supports-backdrop-filter:backdrop-blur-xs sticky top-0 z-30 shrink-0 border-b">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6 lg:px-8">
        <div className="min-w-0">
          <div className="flex flex-col gap-0.5">
            <span className="text-foreground truncate text-lg font-semibold tracking-tight">
              Local DB HR
            </span>
            <span className="text-muted-foreground hidden text-xs sm:inline">
              HR Administration Portal
            </span>
          </div>
        </div>
        <HeaderActions user={user} />
      </div>
    </header>
  );
}
