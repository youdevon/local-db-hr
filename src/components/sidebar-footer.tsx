import {
  SidebarFooterTray,
  type SidebarLicenseIndicator,
} from "@/components/sidebar-footer-tray";

export function SidebarFooter({
  collapsed = false,
  licenseIndicator = null,
}: {
  collapsed?: boolean;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  return <SidebarFooterTray collapsed={collapsed} licenseIndicator={licenseIndicator} />;
}
