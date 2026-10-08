import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { isAdminToken } from "@/lib/session-cutoff";
import { isCrossSiteWrite } from "@/lib/request-origin";
import { adminTFromRequest } from "@/lib/admin-lang";

/**
 * A gate in front of the whole admin area. Every admin page and API route
 * checks the session itself too; this second check means a page or route that
 * forgets to (or a new one added later) is still closed to anyone without a
 * valid session, whatever URL they type. It also runs for the framework's own
 * page-data (RSC) requests, which can render a page without its layouts.
 *
 * Open without a session: the login page and the login/logout endpoints.
 * Pages redirect to the login page; API routes answer 401. A change (POST,
 * PUT, PATCH, DELETE) sent from another site is refused even with a session.
 */

const OPEN = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

/** "/admin/login/" and "/admin/login" are the same page. */
function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

const NO_STORE = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };

export function proxy(request: NextRequest) {
  const path = normalize(request.nextUrl.pathname);

  if (isCrossSiteWrite(request)) {
    return NextResponse.json({ error: adminTFromRequest(request)("Requests from other sites are not accepted.") }, { status: 403, headers: NO_STORE });
  }
  if (OPEN.has(path)) return NextResponse.next();

  if (isAdminToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    const res = NextResponse.next();
    // Admin pages and data never go into a shared or browser cache.
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: adminTFromRequest(request)("Unauthorized") }, { status: 401, headers: NO_STORE });
  }
  // A fixed target, never one taken from the request, so this cannot become an open redirect.
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 307);
  for (const [k, v] of Object.entries(NO_STORE)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
