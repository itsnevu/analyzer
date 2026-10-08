import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/auth";

/**
 * A gate in front of the whole admin area. Every admin page and API route
 * checks the session itself too; this second check means a page or route that
 * forgets to (or a new one added later) is still closed to anyone without a
 * valid session, whatever URL they type.
 *
 * Open without a session: the login page and the login/logout endpoints.
 * Pages redirect to the login page; API routes answer 401.
 */

const OPEN = new Set(["/admin/login", "/api/admin/login", "/api/admin/logout"]);

/** "/admin/login/" and "/admin/login" are the same page. */
function normalize(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export function proxy(request: NextRequest) {
  const path = normalize(request.nextUrl.pathname);
  if (OPEN.has(path)) return NextResponse.next();

  if (verifySession(request.cookies.get(SESSION_COOKIE)?.value)) {
    const res = NextResponse.next();
    // Admin pages and data never go into a shared or browser cache.
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, nofollow" };
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers });
  }
  // A fixed target, never one taken from the request, so this cannot become an open redirect.
  const res = NextResponse.redirect(new URL("/admin/login", request.url), 307);
  for (const [k, v] of Object.entries(headers)) res.headers.set(k, v);
  return res;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin", "/api/admin/:path*"],
};
