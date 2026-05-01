"use client";

import { BackLink } from "@/components/back-link";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/breadcrumbs";
import { cn } from "@/lib/utils";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Cake,
  CalendarCheck,
  CalendarPlus,
  Calculator,
  CalendarClock,
  CalendarDays,
  ContactRound,
  FileCheck2,
  FileClock,
  FilePenLine,
  FilePlus2,
  FileText,
  FileWarning,
  FolderKanban,
  History,
  LayoutDashboard,
  Settings,
  ShieldAlert,
  ShieldCheck,
  UserCircle,
  UserCog,
  UserPlus,
  UserCheck,
  UserRound,
  UserRoundPen,
  Users,
} from "lucide-react";

export type { BreadcrumbItem };

const PAGE_HEADER_ICONS = {
  dashboard: LayoutDashboard,
  "layout-dashboard": LayoutDashboard,
  users: Users,
  cake: Cake,
  "file-clock": FileClock,
  "file-warning": FileWarning,
  "folder-kanban": FolderKanban,
  alert: AlertTriangle,
  "shield-alert": ShieldAlert,
  "user-check": UserCheck,
  chart: BarChart3,
  "user-plus": UserPlus,
  "user-round": UserRound,
  "user-round-pen": UserRoundPen,
  "contact-round": ContactRound,
  "calendar-clock": CalendarClock,
  "calendar-check": CalendarCheck,
  "calendar-plus": CalendarPlus,
  "file-text": FileText,
  "file-plus-2": FilePlus2,
  "file-check": FileCheck2,
  "file-pen-line": FilePenLine,
  history: History,
  "calendar-days": CalendarDays,
  "bar-chart-3": BarChart3,
  "shield-check": ShieldCheck,
  "user-circle": UserCircle,
  settings: Settings,
  calculator: Calculator,
  "user-cog": UserCog,
  "bell-ring": BellRing,
} as const;

type PageHeaderIconKey = keyof typeof PAGE_HEADER_ICONS;

type PageHeaderProps = {
  /** When true, breadcrumb row and Back link are hidden (e.g. Dashboard). */
  hideBreadcrumbNav?: boolean;
  breadcrumbItems?: BreadcrumbItem[];
  /** Parent route if browser history cannot go back; defaults to second-to-last breadcrumb href or "/". */
  backFallbackHref?: string;
  title: string;
  description?: string;
  icon?: PageHeaderIconKey;
  className?: string;
  actions?: React.ReactNode;
};

function resolveBackFallback(
  items: BreadcrumbItem[] | undefined,
  explicit?: string,
): string {
  if (explicit) return explicit;
  if (items && items.length >= 2) {
    const parent = items[items.length - 2];
    if (parent?.href) return parent.href;
  }
  return "/";
}

export function PageHeader({
  hideBreadcrumbNav = false,
  breadcrumbItems,
  backFallbackHref,
  title,
  description,
  icon,
  className,
  actions,
}: PageHeaderProps) {
  const items = breadcrumbItems ?? [];
  const showNav = !hideBreadcrumbNav && items.length > 0;
  const fallback = resolveBackFallback(items, backFallbackHref);
  const Icon = icon ? PAGE_HEADER_ICONS[icon] : null;

  return (
    <header className={cn("space-y-4", className)}>
      {showNav ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Breadcrumbs items={items} className="min-w-0 flex-1" />
          <div className="shrink-0 sm:pl-4">
            <BackLink fallbackHref={fallback} />
          </div>
        </div>
      ) : null}

      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {Icon ? (
              <div className="bg-muted text-foreground mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border">
                <Icon className="h-5 w-5" />
              </div>
            ) : null}
            <div className="min-w-0 space-y-1">
              <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
              {description ? (
                <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">{description}</p>
              ) : null}
            </div>
          </div>
        </div>
        {actions ? (
          <div className="flex w-full shrink-0 flex-wrap items-stretch gap-3 sm:w-auto sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>
    </header>
  );
}
