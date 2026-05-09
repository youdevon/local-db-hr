import type { SessionUser } from "@/lib/session";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";

import { AppBrand } from "@/components/app-brand";
import { HeaderActions } from "@/components/header-actions";
import { NavDatabaseIcon } from "@/components/nav-database-icon";

export function TopHeader({
  user,
  licenseIndicator = null,
}: {
  user: SessionUser;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  return (
    <header className="border-border bg-sidebar/95 supports-backdrop-filter:backdrop-blur-xs sticky top-0 z-30 shrink-0 border-b">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <NavDatabaseIcon />
          <AppBrand className="min-w-0 max-w-[min(18rem,52vw)] sm:max-w-xs lg:max-w-sm" />
        </div>
        <HeaderActions user={user} licenseIndicator={licenseIndicator} />
      </div>
    </header>
  );
}
