import type { LucideIcon } from "lucide-react";
import {
  Building2,
  ClipboardList,
  FileText,
  LayoutDashboard,
  NotebookPen,
  Palmtree,
  ScrollText,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import { canAccessRoute, normalizeUserRole } from "@/lib/roles";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export const sidebarNav: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/contracts", label: "Contracts", icon: FileText },
  { href: "/note-monitor", label: "Note Monitor", icon: NotebookPen },
  { href: "/leave", label: "Leave", icon: Palmtree },
  { href: "/reports", label: "Reports", icon: ClipboardList },
  { href: "/audit", label: "Audit", icon: ScrollText },
  { href: "/profile", label: "Profile", icon: UserCircle },
  { href: "/settings", label: "Global Settings", icon: Settings },
];

export function getSidebarNavForRole(roleInput: string | null | undefined): NavItem[] {
  const role = normalizeUserRole(roleInput);
  return sidebarNav.filter((item) => canAccessRoute(role, item.href));
}

export const brandIcon = Building2;
