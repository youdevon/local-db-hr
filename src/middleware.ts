import { getIronSession } from "iron-session";
import type { IronSession } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  canAccessRoute,
  normalizeUserRole,
  viewerWriteBlockedRedirectTarget,
} from "@/lib/roles";
import { getLicenseStatus } from "@/lib/license";
import {
  getSessionExpiryReason,
  LOGIN_SESSION_EXPIRED_HREF,
  SESSION_COOKIE_CLEAR_OPTIONS,
  SESSION_COOKIE_NAME,
  sessionOptions,
  type SessionData,
} from "@/lib/session";
import { getSessionSettings } from "@/lib/security-settings";

function setNoStoreHeaders(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

function authLog(message: string, meta?: Record<string, unknown>) {
  console.info(`[auth-middleware] ${message}`, meta ?? {});
}

function normalizeMiddlewarePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

/**
 * Members may only access /profile (server-side). Other authenticated routes redirect to /profile.
 * Unauthenticated access to app routes redirects to login with a session-expired hint (cookie cleared when invalid).
 * Viewers are redirected away from disallowed write routes (defense in depth with page-level checks).
 * `/employee/*` aliases to `/employees/*` for compatibility with alternate URLs.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const normalizedPath = normalizeMiddlewarePath(pathname);
  const isLoginRoute = pathname === "/login" || pathname.startsWith("/login/");
  const isLicenseExpiredRoute = pathname === "/license-expired" || pathname.startsWith("/license-expired/");
  const isPublicRoute = isLoginRoute || isLicenseExpiredRoute;
  const isApiRoute = pathname.startsWith("/api/");
  const isAuthApiRoute = pathname === "/api/auth/logout" || pathname === "/api/auth/session";
  const isWriteMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());

  /** GET /logout — clear cookie and redirect to login (parity with common /logout UX). */
  if (normalizedPath === "/logout") {
    const res = setNoStoreHeaders(NextResponse.redirect(new URL("/login", request.url)));
    res.cookies.set(SESSION_COOKIE_NAME, "", {
      ...SESSION_COOKIE_CLEAR_OPTIONS,
      expires: new Date(0),
    });
    authLog("logout path: clearing session cookie and redirecting to login");
    return res;
  }

  if (isPublicRoute) {
    return setNoStoreHeaders(NextResponse.next());
  }
  if (isApiRoute && isAuthApiRoute) {
    return NextResponse.next();
  }
  if (isApiRoute && !isWriteMethod) {
    return NextResponse.next();
  }

  const redirectExpired = () => {
    const res = setNoStoreHeaders(NextResponse.redirect(new URL(LOGIN_SESSION_EXPIRED_HREF, request.url)));
    res.cookies.set(SESSION_COOKIE_NAME, "", {
      ...SESSION_COOKIE_CLEAR_OPTIONS,
      expires: new Date(0),
    });
    authLog("redirecting to login with expired reason", { path: pathname });
    return res;
  };

  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  authLog("received request", {
    path: pathname,
    hasSessionCookie: Boolean(sessionCookie),
  });
  if (!sessionCookie) {
    return redirectExpired();
  }

  let session: IronSession<SessionData>;
  let activeResponse: NextResponse;

  try {
    activeResponse = setNoStoreHeaders(NextResponse.next());
    session = await getIronSession<SessionData>(request, activeResponse, sessionOptions);
  } catch {
    authLog("failed to parse session cookie", { path: pathname, hasSessionCookie: true });
    return redirectExpired();
  }

  if (!session.user?.userId) {
    authLog("session missing user payload", { path: pathname });
    return redirectExpired();
  }

  const now = Date.now();
  const sessionSettings = await getSessionSettings();
  const expiryReason = getSessionExpiryReason(
    session,
    {
      inactivityTimeoutSeconds: sessionSettings.idleTimeoutMinutes * 60,
      absoluteTimeoutSeconds: sessionSettings.absoluteSessionHours * 60 * 60,
    },
    now,
  );
  if (expiryReason) {
    authLog("session expired", { path: pathname, reason: expiryReason });
    return redirectExpired();
  }

  // Refresh activity timestamp periodically to enforce inactivity timeout
  // without mutating the cookie on every request.
  const lastActivityAt = session.lastActivityAt ?? 0;
  const refreshIntervalMs = Math.min(60 * 1000, Math.max(15 * 1000, sessionSettings.idleTimeoutMinutes * 1000));
  if (!lastActivityAt || now - lastActivityAt >= refreshIntervalMs) {
    session.lastActivityAt = now;
    await session.save();
  }

  // Singular /employee/... → /employees/... (same query string)
  if (pathname === "/employee" || pathname.startsWith("/employee/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/employees" + pathname.slice("/employee".length);
    return NextResponse.redirect(url);
  }

  const role = normalizeUserRole(session.user.role);

  if (role === "viewer" && !canAccessRoute(session.user.role, pathname)) {
    const target = viewerWriteBlockedRedirectTarget(pathname);
    if (target) {
      return setNoStoreHeaders(NextResponse.redirect(new URL(target, request.url)));
    }
    return setNoStoreHeaders(NextResponse.redirect(new URL("/unauthorized", request.url)));
  }

  /*
   * Global Settings (including Licence & Activation) is administrator-only. Allow admins through
   * before licence checks so /settings/license can be fixed when the licence is missing or expired.
   * Non-admins receive /unauthorized (not /license-expired) for clearer denial.
   */
  if (!isApiRoute && normalizedPath.startsWith("/settings")) {
    if (role === "administrator") {
      return activeResponse;
    }
    if (role === "member") {
      return setNoStoreHeaders(NextResponse.redirect(new URL("/profile", request.url)));
    }
    return setNoStoreHeaders(NextResponse.redirect(new URL("/unauthorized", request.url)));
  }

  const licenseStatus = await getLicenseStatus();
  const licenseBlocksNormalUse = !licenseStatus.configured || !licenseStatus.accessAllowed;

  if (isApiRoute && !isAuthApiRoute) {
    if (isWriteMethod && licenseBlocksNormalUse) {
      return NextResponse.json(
        {
          success: false,
          message: licenseStatus.clockTamperDetected
            ? "The server date/time appears to be incorrect. Please correct the server date and time to continue."
            : "Licence expired. This action is not available until the application is activated.",
        },
        { status: 423 },
      );
    }
    return NextResponse.next();
  }

  if (role !== "member") {
    if (licenseBlocksNormalUse) {
      return setNoStoreHeaders(NextResponse.redirect(new URL("/license-expired", request.url)));
    }
    return activeResponse;
  }

  if (pathname.startsWith("/dashboard/details")) {
    return setNoStoreHeaders(NextResponse.redirect(new URL("/", request.url)));
  }

  const memberAllowed =
    pathname === "/" ||
    pathname === "/dashboard" ||
    pathname.startsWith("/profile");

  if (memberAllowed) {
    if (licenseBlocksNormalUse) {
      return setNoStoreHeaders(NextResponse.redirect(new URL("/license-expired", request.url)));
    }
    return activeResponse;
  }

  return setNoStoreHeaders(NextResponse.redirect(new URL("/", request.url)));
}

export const config = {
  runtime: "nodejs",
  matcher: [
    /*
     * Exclude static assets and Next internals; run for all application routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
