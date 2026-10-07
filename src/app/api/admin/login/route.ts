import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { authConfigProblem, checkPassword, checkTotp, createSession, SESSION_COOKIE, SESSION_MAX_AGE, totpEnabled } from "@/lib/auth";
import { clientIp, isBlocked, reset, take, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Wrong passwords (and wrong two-factor codes) allowed per address, and in total, before login pauses.
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

  let body: { password?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const failed = async (error: string) => {
    take(ipKey, PER_IP.limit, PER_IP.windowMs);
    take("login:all", TOTAL.limit, TOTAL.windowMs);
    // Slows down guessing without bothering a person who mistyped.
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error }, { status: 401 });
  };

  if (typeof body.password !== "string" || !checkPassword(body.password)) {
    return failed("Wrong password.");
  }

  if (totpEnabled()) {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    // The password was right: ask for the code without counting a failed attempt.
    if (!code) {
      return NextResponse.json({ error: "Enter the 6-digit code from your authenticator app.", needsCode: true }, { status: 401 });
    }
    if (!checkTotp(code)) {
      return failed("Wrong or expired code. Wait for the next code and try again.");
    }
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
