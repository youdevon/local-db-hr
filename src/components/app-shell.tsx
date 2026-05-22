"use client";

import { motion } from "framer-motion";

import { MainFooter } from "@/components/main-footer";
import { PageContainer } from "@/components/page-container";
import { PasswordChangeRequiredBanner } from "@/components/password-change-required-banner";
import { SessionTimeoutGuard } from "@/components/session-timeout-guard";
import { Sidebar } from "@/components/sidebar";
import type { SidebarLicenseIndicator } from "@/components/sidebar-footer-tray";
import { TopHeader } from "@/components/top-header";
import type { SessionUser } from "@/lib/session";

export function AppShell({
  user,
  children,
  viewOnly = false,
  mustChangePassword = false,
  licenseIndicator = null,
}: {
  user: SessionUser;
  children: React.ReactNode;
  viewOnly?: boolean;
  mustChangePassword?: boolean;
  licenseIndicator?: SidebarLicenseIndicator | null;
}) {
  return (
    <div className="bg-background text-foreground flex h-svh min-h-0 overflow-hidden">
      <SessionTimeoutGuard />
      <div className="hidden h-svh min-h-0 shrink-0 lg:block">
        <Sidebar role={user.role} licenseIndicator={licenseIndicator} />
      </div>
      <div className="flex h-svh min-h-0 min-w-0 flex-1 flex-col">
        <TopHeader user={user} licenseIndicator={licenseIndicator} />
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <motion.main
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="min-h-0 flex-1 overflow-y-auto"
          >
            <PageContainer>
              {mustChangePassword ? <PasswordChangeRequiredBanner /> : null}
              {viewOnly ? (
                <p
                  className="border-border bg-muted/30 text-muted-foreground mb-4 rounded-lg border px-3 py-2 text-sm"
                  role="status"
                >
                  You have view-only access. You can review records and export reports, but you cannot make changes.
                </p>
              ) : null}
              {children}
            </PageContainer>
          </motion.main>
          <MainFooter />
        </div>
      </div>
    </div>
  );
}
