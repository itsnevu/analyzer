import { NextResponse } from "next/server";
import { logAdmin } from "@/lib/admin-log";
import { authConfigProblem, checkPassword, checkTotp, createSession, SESSION_COOKIE, SESSION_MAX_AGE, totpEnabled } from "@/lib/auth";
import { limitKey, refund, reset, take, tooMany } from "@/lib/rate-limit";

export const runtime = "nodejs";

// Attempts allowed per address before login pauses. There is deliberately no site-wide limit: it would let
// anyone lock the owner out by sending wrong passwords, and a generated password cannot be guessed anyway.
const PER_IP = { limit: 5, windowMs: 15 * 60_000 };

export async function POST(req: Request) {
  const problem = authConfigProblem();
  if (problem) {
    return NextResponse.json({ error: `Admin login is disabled on this server. ${problem}` }, { status: 503 });
  }

  const ipKey = `login:${limitKey(req)}`;
  // Counted before the body is read, so many slow parallel requests cannot all slip past the limit.
  const allowed = take(ipKey, PER_IP.limit, PER_IP.windowMs);
  if (!allowed.ok) {
    return tooMany(`Too many wrong passwords. Try again in ${Math.ceil(allowed.retryAfter / 60)} minutes.`, allowed.retryAfter);
  }

  let body: { password?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  // The attempt was counted above, so a failure only waits.
  const failed = async (error: string) => {
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
      refund(ipKey);
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
