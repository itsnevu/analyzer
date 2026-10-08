import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Same attributes as the login cookie: a "__Host-" cookie is only replaced by a Secure one.
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  return res;
}
