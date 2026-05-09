"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
const SESSION_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const LOGOUT_SENT_KEY = "local_db_hr_timeout_logout_sent";
const LOGIN_SESSION_EXPIRED_HREF = "/login?reason=session-expired";

async function postInactivityLogoutOnce(): Promise<void> {
  if (window.sessionStorage.getItem(LOGOUT_SENT_KEY) === "1") return;
  window.sessionStorage.setItem(LOGOUT_SENT_KEY, "1");
  await fetch("/api/auth/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason: "inactivity_timeout" }),
    cache: "no-store",
    keepalive: true,
  }).catch(() => undefined);
}

export function SessionTimeoutGuard() {
  const router = useRouter();
  const pathname = usePathname();
  const inactivityTimerRef = useRef<number | null>(null);
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (pathname?.startsWith("/login")) return;

    const redirectToExpiredLogin = () => {
      if (redirectedRef.current) return;
      redirectedRef.current = true;
      router.replace(LOGIN_SESSION_EXPIRED_HREF);
    };

    const handleInactivityTimeout = async () => {
      await postInactivityLogoutOnce();
      redirectToExpiredLogin();
    };

    const scheduleInactivityTimer = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      inactivityTimerRef.current = window.setTimeout(() => {
        void handleInactivityTimeout();
      }, INACTIVITY_TIMEOUT_MS);
    };

    const onActivity = () => {
      if (!redirectedRef.current) {
        scheduleInactivityTimer();
      }
    };

    const onVisibilityChange = async () => {
      if (document.visibilityState === "visible" && !redirectedRef.current) {
        const response = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
        if (!response || response.status === 401) {
          await postInactivityLogoutOnce();
          redirectToExpiredLogin();
          return;
        }
        scheduleInactivityTimer();
      }
    };

    const checkServerSession = async () => {
      if (redirectedRef.current) return;
      const response = await fetch("/api/auth/session", { cache: "no-store" }).catch(() => null);
      if (!response || response.status === 401) {
        await postInactivityLogoutOnce();
        redirectToExpiredLogin();
      }
    };

    const events: Array<keyof WindowEventMap> = [
      "mousemove",
      "mousedown",
      "keydown",
      "touchstart",
      "scroll",
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, onActivity, { passive: true });
    }
    const visibilityHandler = () => {
      void onVisibilityChange();
    };
    document.addEventListener("visibilitychange", visibilityHandler);

    const interval = window.setInterval(() => {
      void checkServerSession();
    }, SESSION_CHECK_INTERVAL_MS);

    scheduleInactivityTimer();

    return () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
      }
      window.clearInterval(interval);
      for (const eventName of events) {
        window.removeEventListener(eventName, onActivity);
      }
      document.removeEventListener("visibilitychange", visibilityHandler);
    };
  }, [pathname, router]);

  return null;
}
