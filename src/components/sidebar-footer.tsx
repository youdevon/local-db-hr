import { SidebarFooterTray } from "@/components/sidebar-footer-tray";

export function SidebarFooter({ collapsed = false }: { collapsed?: boolean }) {
  return <SidebarFooterTray collapsed={collapsed} />;
}
