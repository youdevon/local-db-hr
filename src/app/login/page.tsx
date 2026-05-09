import { redirect } from "next/navigation";

import { AppBrand } from "@/components/app-brand";
import { FooterCopyrightLink } from "@/components/footer-copyright-link";
import { LoginForm } from "@/components/login-form";
import { getSession } from "@/lib/get-session";
import { getLoginNoticeSettings } from "@/lib/security-settings";
import { getVersionLabel } from "@/lib/version";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const session = await getSession();
  if (session.user) redirect("/dashboard");
  const loginNoticeSettings = await getLoginNoticeSettings();
  const params = await searchParams;
  const reason = params.reason;
  const wasSessionTimeout = reason === "session-timeout" || reason === "inactive";
  const wasSessionExpired = reason === "session-expired";

  return (
    <main className="bg-background text-foreground relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden px-6 py-10 lg:px-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-5%,color-mix(in_srgb,var(--primary)_14%,transparent)_0%,transparent_62%)] dark:bg-[radial-gradient(ellipse_85%_55%_at_50%_-5%,color-mix(in_srgb,var(--primary)_20%,transparent)_0%,transparent_62%)]"
      />
      <div className="relative z-[1] mx-auto w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex max-w-full items-center justify-center">
            <AppBrand
              className="h-auto min-h-10 w-full max-w-full justify-center px-1"
              textClassName="text-center text-2xl font-bold leading-tight sm:text-3xl"
              textElement="h1"
            />
          </div>
          <p className="text-muted-foreground mt-2 text-sm sm:text-[0.9375rem]">
            Secure HR Administration Portal
          </p>
          {wasSessionTimeout ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Your session expired due to inactivity. Please sign in again.
            </p>
          ) : null}
          {wasSessionExpired ? (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              Your session expired. Please sign in again.
            </p>
          ) : null}
        </div>

        <LoginForm loginNoticeSettings={loginNoticeSettings} />

        <footer className="text-muted-foreground mt-8 flex flex-col items-center gap-2 text-center text-xs">
          <FooterCopyrightLink className="leading-snug" />
          <span className="text-muted-foreground/90">{getVersionLabel()}</span>
        </footer>
      </div>
    </main>
  );
}
