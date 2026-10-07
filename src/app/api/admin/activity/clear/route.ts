import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-articles";
import { clearAdminLog, logAdmin } from "@/lib/admin-log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Deletes activity entries older than `days` (default 90, at least 7): { days?: number }. The clearing itself is logged. */
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let body: { days?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    /* no body: the default */
  }
  const days = typeof body.days === "number" && Number.isFinite(body.days) ? Math.floor(body.days) : 90;
  if (days < 7) return NextResponse.json({ error: "Keep at least the last 7 days." }, { status: 422 });
  const deleted = clearAdminLog(days);
  logAdmin(req, "activity.clear", `${deleted} entries`, `older than ${days} days`);
  return NextResponse.json({ ok: true, deleted, days });
}
