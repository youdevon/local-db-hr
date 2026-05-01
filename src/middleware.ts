import { getIronSession } from "iron-session";
import type { IronSession } from "iron-session";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import {
  canAccessRoute,
  normalizeUserRole,
  viewerWriteBlockedRedirectTarget,
} from "@/lib/roles";
import { LOGIN_SESSION_EXPIRED_HREF, SESSION_COOKIE_NAME, sessionOptions, type SessionData } from "@/lib/session";

/**
 * Members may only access /profile (server-side). Other authenticated routes redirect to /profile.
 * Unauthenticated access to app routes redirects to login with a session-expired hint (cookie cleared when invalid).
 * Viewers are redirected away from disallowed write routes (defense in depth with page-level checks).
 * `/employee/*` aliases to `/employees/*` for compatibility with alternate URLs.
 */
export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname === "/login" || pathname.startsWith("/login/")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const redirectExpired = () =>
    NextResponse.redirect(new URL(LOGIN_SESSION_EXPIRED_HREF, request.url));

  let session: IronSession<SessionData>;
  let activeResponse: NextResponse;

  try {
    activeResponse = NextResponse.next();
    session = await getIronSession<SessionData>(request, activeResponse, sessionOptions);
  } catch {
    const res = redirectExpired();
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  if (!session.user?.userId) {
    const res = redirectExpired();
    const bound = await getIronSession<SessionData>(request, res, sessionOptions);
    bound.destroy();
    await bound.save();
    return res;
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
      return NextResponse.redirect(new URL(target, request.url));
    }
    return NextResponse.redirect(new URL("/unauthorized", request.url));
  }

  if (role !== "member") {
    return activeResponse;
  }

  const allowed = pathname === "/profile" || pathname.startsWith("/profile/");

  if (allowed) {
    return activeResponse;
  }

  return NextResponse.redirect(new URL("/profile", request.url));
}

export const config = {
  matcher: [
    /*
     * Exclude static assets and Next internals; run for all application routes.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
