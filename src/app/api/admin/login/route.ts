import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { authConfigProblem, checkPassword, createSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/auth";
import { clientIp, isBlocked, reset, take, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Wrong passwords allowed per address, and in total, before login pauses.
const PER_IP = { limit: 5, windowMs: 15 * 60_000 };
const TOTAL = { limit: 50, windowMs: 60 * 60_000 };

export async function POST(req: Request) {
  const problem = authConfigProblem();
  if (problem) {
    return NextResponse.json({ error: `Admin login is disabled on this server. ${problem}` }, { status: 503 });
  }

  const ipKey = `login:${clientIp(req)}`;
  for (const [key, rule] of [[ipKey, PER_IP], ["login:all", TOTAL]] as const) {
    const blocked = isBlocked(key, rule.limit);
    if (!blocked.ok) {
      return tooMany(`Too many wrong passwords. Try again in ${Math.ceil(blocked.retryAfter / 60)} minutes.`, blocked.retryAfter);
    }
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  if (typeof body.password !== "string" || !checkPassword(body.password)) {
    take(ipKey, PER_IP.limit, PER_IP.windowMs);
    take("login:all", TOTAL.limit, TOTAL.windowMs);
    // Slows down guessing without bothering a person who mistyped.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: "Wrong password." }, { status: 401 });
  }

  reset(ipKey);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, createSession(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  logAdmin(req, "login");
  return res;
}
