"use client";

import { useEffect, useMemo, useRef } from "react";

const LAST_ACTIVITY_KEY = "local_db_hr_last_activity";
const LOGOUT_BROADCAST_KEY = "local_db_hr_logout_broadcast";
const LOGOUT_BROADCAST_CHANNEL = "local_db_hr_auth_channel";
const DEFAULT_TIMEOUT_MINUTES = 20;
const ACTIVITY_WRITE_THROTTLE_MS = 30_000;
const ACTIVE_CHECK_INTERVAL_MS = 60_000;

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "pointerdown",
];

type SessionTimeoutProviderProps = {
  children: React.ReactNode;
  timeoutMinutes?: number;
};

function readLastActivity(now: number): number {
  const raw = window.localStorage.getItem(LAST_ACTIVITY_KEY);
  const parsed = raw ? Number(raw) : Number.NaN;
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  return now;
}

function isAppApiRequest(input: RequestInfo | URL): boolean {
  if (typeof input === "string") {
    return input.startsWith("/api/");
  }
  if (input instanceof URL) {
    return input.pathname.startsWith("/api/");
  }
  return new URL(input.url).pathname.startsWith("/api/");
}

export function SessionTimeoutProvider({
  children,
  timeoutMinutes = DEFAULT_TIMEOUT_MINUTES,
}: SessionTimeoutProviderProps) {
  const timeoutMs = useMemo(() => timeoutMinutes * 60 * 1000, [timeoutMinutes]);
  const logoutStartedRef = useRef(false);
  const lastWriteRef = useRef(0);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const originalFetchRef = useRef<typeof window.fetch | null>(null);

  const redirectToLogin = (reason: "session-timeout" | "session-expired") => {
    window.location.replace(`/login?reason=${reason}`);
  };

  const broadcastLogout = () => {
    const stamp = String(Date.now());
    window.localStorage.setItem(LOGOUT_BROADCAST_KEY, stamp);
    channelRef.current?.postMessage({ type: "logout", ts: stamp });
  };

  const logoutOnce = async (reason: "inactivity_timeout" | "session_expired") => {
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;

    try {
      await window.fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
        cache: "no-store",
      });
    } catch {
      // Redirect anyway, even if network is unavailable.
    } finally {
      broadcastLogout();
      redirectToLogin(reason === "inactivity_timeout" ? "session-timeout" : "session-expired");
    }
  };

  const writeActivity = (now: number, force = false) => {
    if (!force && now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) return;
    lastWriteRef.current = now;
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(now));
  };

  const checkSessionTimeout = async (opts?: { refreshActivityOnPass?: boolean }) => {
    if (logoutStartedRef.current) return true;
    const now = Date.now();
    const lastActivity = readLastActivity(now);
    const elapsed = now - lastActivity;

    if (elapsed >= timeoutMs) {
      await logoutOnce("inactivity_timeout");
      return true;
    }

    if (opts?.refreshActivityOnPass) {
      writeActivity(now, true);
    }
    return false;
  };

  useEffect(() => {
    const now = Date.now();
    const current = readLastActivity(now);
    lastWriteRef.current = current;

    if ("BroadcastChannel" in window) {
      channelRef.current = new BroadcastChannel(LOGOUT_BROADCAST_CHANNEL);
      channelRef.current.onmessage = (event: MessageEvent<{ type?: string }>) => {
        if (event.data?.type === "logout" && !logoutStartedRef.current) {
          logoutStartedRef.current = true;
          redirectToLogin("session-timeout");
        }
      };
    }

    const pingServerSession = async () => {
      if (logoutStartedRef.current || !originalFetchRef.current) return;
      try {
        const res = await originalFetchRef.current("/api/auth/session", {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
        });
        if (res.status === 401) {
          await logoutOnce("session_expired");
        }
      } catch {
        // Offline or transient errors — ignore.
      }
    };

    const handleActivity = () => {
      if (logoutStartedRef.current) return;
      writeActivity(Date.now());
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState !== "visible") return;
      void (async () => {
        await pingServerSession();
        if (!logoutStartedRef.current) {
          await checkSessionTimeout({ refreshActivityOnPass: true });
        }
      })();
    };

    const handlePageShow = () => {
      void (async () => {
        await pingServerSession();
        if (!logoutStartedRef.current) {
          await checkSessionTimeout({ refreshActivityOnPass: true });
        }
      })();
    };

    const handleOnline = () => {
      void (async () => {
        await pingServerSession();
        if (!logoutStartedRef.current) {
          await checkSessionTimeout({ refreshActivityOnPass: true });
        }
      })();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LOGOUT_BROADCAST_KEY && !logoutStartedRef.current) {
        logoutStartedRef.current = true;
        redirectToLogin("session-timeout");
      }
    };

    for (const eventName of ACTIVITY_EVENTS) {
      window.addEventListener(eventName, handleActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", handleVisibilityOrFocus);
    window.addEventListener("focus", handleVisibilityOrFocus);
    window.addEventListener("pageshow", handlePageShow);
    window.addEventListener("online", handleOnline);
    window.addEventListener("storage", handleStorage);

    originalFetchRef.current = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof window.fetch>) => {
      await checkSessionTimeout({ refreshActivityOnPass: false });
      const response = await (originalFetchRef.current as typeof window.fetch)(...args);
      if (
        !logoutStartedRef.current &&
        response.status === 401 &&
        isAppApiRequest(args[0])
      ) {
        void logoutOnce("session_expired");
      }
      return response;
    };

    const interval = window.setInterval(() => {
      void checkSessionTimeout({ refreshActivityOnPass: false });
    }, ACTIVE_CHECK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
      for (const eventName of ACTIVITY_EVENTS) {
        window.removeEventListener(eventName, handleActivity);
      }
      document.removeEventListener("visibilitychange", handleVisibilityOrFocus);
      window.removeEventListener("focus", handleVisibilityOrFocus);
      window.removeEventListener("pageshow", handlePageShow);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("storage", handleStorage);
      channelRef.current?.close();
      channelRef.current = null;
      if (originalFetchRef.current) {
        window.fetch = originalFetchRef.current;
      }
    };
  }, [timeoutMs]);

  return children;
}
